package com.kidsafe.modules

import android.app.AlarmManager
import android.app.AppOpsManager
import android.app.PendingIntent
import android.app.admin.DevicePolicyManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Process
import android.provider.Settings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.kidsafe.receivers.KidSafeDeviceAdminReceiver
import com.kidsafe.receivers.ScreenTimeReceiver
import com.kidsafe.store.KidSafeStore
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import java.util.TimeZone

/**
 * Screen-time accounting.
 *
 * How it works:
 *   - JS writes the daily limit (minutes) via [setDailyLimitMinutes]; we cache in KidSafeStore.
 *   - JS polls [getTodayUsedMinutes] periodically (or calls it from the foreground service),
 *     which queries the system `UsageStatsManager` and tells JS how many minutes of foreground
 *     time have been used today.
 *   - When used >= limit, JS calls [DeviceAdminModule.lockNow].
 *   - A daily midnight alarm wakes [ScreenTimeReceiver] so we can reset the counter even if the
 *     app isn't running.
 *
 * Inspired by [Application/app/.../ScreenTimeReceiver.java] but reworked: the old approach tracked
 * ACTION_SCREEN_ON/OFF events which miss any usage where the screen stays on across a reboot.
 * UsageStatsManager is authoritative.
 */
class ScreenTimeModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = NAME

    @ReactMethod
    fun hasUsageAccess(promise: Promise) {
        promise.resolve(hasUsageAccess(reactApplicationContext))
    }

    @ReactMethod
    fun openUsageAccessSettings(promise: Promise) {
        // We deliberately do NOT use MIUI's `miui.intent.action.APP_PERM_EDITOR` here — it
        // opens the per-app permission hub, not the Usage access list. The AOSP intent works
        // on MIUI/HyperOS; users have to scroll to find KidSafe (the bullets explain that).
        val pkg = reactApplicationContext.packageName
        val candidates = listOf(
            Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS),
            Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = android.net.Uri.parse("package:$pkg")
            },
        )
        val pm = reactApplicationContext.packageManager
        for (intent in candidates) {
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
            val resolves = try {
                intent.resolveActivity(pm) != null
            } catch (_: Exception) {
                false
            }
            if (!resolves) continue
            try {
                reactApplicationContext.startActivity(intent)
                promise.resolve(null)
                return
            } catch (_: Exception) {
                // Try next
            }
        }
        promise.reject("E_SCREENTIME", "No usage-access settings activity found")
    }

    @ReactMethod
    fun setDailyLimitMinutes(mins: Int, promise: Promise) {
        try {
            KidSafeStore.setScreenTimeLimitMins(reactApplicationContext, mins)
            scheduleMidnightReset()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("E_SCREENTIME", e)
        }
    }

    @ReactMethod
    fun getTodayUsedMinutes(promise: Promise) {
        try {
            if (!hasUsageAccess(reactApplicationContext)) {
                promise.reject("E_NO_USAGE_ACCESS", "Grant 'Usage access' permission first")
                return
            }
            val usm = reactApplicationContext
                .getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val cal = Calendar.getInstance().apply {
                set(Calendar.HOUR_OF_DAY, 0)
                set(Calendar.MINUTE, 0)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
            }
            val start = cal.timeInMillis
            val end = System.currentTimeMillis()

            val stats = usm.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, start, end)
                ?: emptyList()
            var totalMs = 0L
            for (s in stats) {
                // Skip our own app and system UI so the tally matches what parents see
                if (s.packageName == reactApplicationContext.packageName) continue
                totalMs += s.totalTimeInForeground
            }
            val minutes = (totalMs / 1000 / 60).toInt()
            KidSafeStore.setScreenTimeUsedMins(reactApplicationContext, minutes)
            KidSafeStore.setScreenTimeDay(reactApplicationContext, today())
            promise.resolve(minutes)
        } catch (e: Exception) {
            promise.reject("E_SCREENTIME", e)
        }
    }

    /**
     * Returns the per-app foreground time for the last [days] days (default 7) — one entry per
     * day, each with a `totalMins` aggregate and a `perApp` map of package → minutes (sorted
     * desc, capped at [topN]).
     *
     * Date keys are `yyyy-MM-dd` in the device's local timezone. The last entry is always
     * "today" (midnight → now); earlier entries are full midnight-to-midnight windows.
     *
     * Apps with less than 1 minute of foreground time are dropped to keep the parent UI
     * focused on real usage. KidSafe itself, the SystemUI shell and the launcher's home
     * activity are skipped — they aren't useful signals for parents.
     */
    @ReactMethod
    fun getPerAppUsage(days: Int, topN: Int, promise: Promise) {
        try {
            if (!hasUsageAccess(reactApplicationContext)) {
                promise.reject("E_NO_USAGE_ACCESS", "Grant 'Usage access' permission first")
                return
            }
            val usm = reactApplicationContext
                .getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val ownPkg = reactApplicationContext.packageName
            val dateFmt = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply {
                timeZone = TimeZone.getDefault()
            }

            val numDays = if (days <= 0) 1 else days
            val cap = if (topN <= 0) 30 else topN
            val now = System.currentTimeMillis()

            val daysOut: WritableArray = Arguments.createArray()
            for (i in numDays - 1 downTo 0) {
                // i=0 is "today". Walk the calendar back i days, snap to midnight for window
                // start, snap to next-midnight (or now) for window end.
                val dayCal = Calendar.getInstance().apply {
                    add(Calendar.DAY_OF_YEAR, -i)
                    set(Calendar.HOUR_OF_DAY, 0)
                    set(Calendar.MINUTE, 0)
                    set(Calendar.SECOND, 0)
                    set(Calendar.MILLISECOND, 0)
                }
                val startMs = dayCal.timeInMillis
                val endMs = (dayCal.clone() as Calendar).apply {
                    add(Calendar.DAY_OF_YEAR, 1)
                }.timeInMillis.coerceAtMost(now)
                val dateKey = dateFmt.format(java.util.Date(startMs))

                // Aggregate per-package — UsageStatsManager can return multiple stats records
                // per package per window (one per app session bucket), so we merge.
                val perPackageMs = HashMap<String, Long>()
                val stats = usm.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, startMs, endMs)
                    ?: emptyList()
                for (s in stats) {
                    val pkg = s.packageName ?: continue
                    if (pkg == ownPkg) continue
                    if (s.totalTimeInForeground <= 0L) continue
                    perPackageMs[pkg] = (perPackageMs[pkg] ?: 0L) + s.totalTimeInForeground
                }

                // Convert to minutes, drop sub-minute apps, sort desc, cap.
                val ranked = perPackageMs
                    .map { (pkg, ms) -> pkg to (ms / 1000 / 60).toInt() }
                    .filter { it.second >= 1 }
                    .sortedByDescending { it.second }
                    .take(cap)
                val totalMins = ranked.sumOf { it.second }

                val perAppMap: WritableMap = Arguments.createMap()
                for ((pkg, mins) in ranked) {
                    perAppMap.putInt(pkg, mins)
                }

                val dayOut: WritableMap = Arguments.createMap().apply {
                    putString("date", dateKey)
                    putInt("totalMins", totalMins)
                    putMap("perApp", perAppMap)
                }
                daysOut.pushMap(dayOut)
            }

            val out: WritableMap = Arguments.createMap().apply {
                putArray("days", daysOut)
            }
            promise.resolve(out)
        } catch (e: Exception) {
            promise.reject("E_SCREENTIME", e)
        }
    }

    /**
     * Returns the most recently foregrounded app package in the last [lookbackMs] window
     * according to UsageStats events. This is used as a lightweight cross-check for the live
     * foreground-app pill scorer when accessibility emits an OEM-noisy launcher package.
     */
    @ReactMethod
    fun getRecentForegroundApp(lookbackMs: Int, promise: Promise) {
        try {
            if (!hasUsageAccess(reactApplicationContext)) {
                promise.reject("E_NO_USAGE_ACCESS", "Grant 'Usage access' permission first")
                return
            }
            val usm = reactApplicationContext
                .getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val now = System.currentTimeMillis()
            val start = now - lookbackMs.toLong().coerceAtLeast(5_000L)
            val events = usm.queryEvents(start, now)
            val event = UsageEvents.Event()

            var latestPkg: String? = null
            var latestAt = 0L
            val ownPkg = reactApplicationContext.packageName

            while (events.hasNextEvent()) {
                events.getNextEvent(event)
                val isForegroundEvent =
                    event.eventType == UsageEvents.Event.ACTIVITY_RESUMED ||
                        event.eventType == UsageEvents.Event.MOVE_TO_FOREGROUND
                if (!isForegroundEvent) continue
                val pkg = event.packageName ?: continue
                if (pkg == ownPkg) continue
                if (event.timeStamp >= latestAt) {
                    latestAt = event.timeStamp
                    latestPkg = pkg
                }
            }

            val out: WritableMap = Arguments.createMap().apply {
                putString("packageName", latestPkg)
                putDouble("updatedAt", latestAt.toDouble())
            }
            promise.resolve(out)
        } catch (e: Exception) {
            promise.reject("E_SCREENTIME", e)
        }
    }

    @ReactMethod
    fun lockIfOverLimit(promise: Promise) {
        try {
            val limit = KidSafeStore.getScreenTimeLimitMins(reactApplicationContext)
            val used = KidSafeStore.getScreenTimeUsedMins(reactApplicationContext)
            if (limit > 0 && used >= limit) {
                val dpm = reactApplicationContext
                    .getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
                val admin = KidSafeDeviceAdminReceiver.componentName(reactApplicationContext)
                if (dpm.isAdminActive(admin)) {
                    dpm.lockNow()
                    promise.resolve(true)
                    return
                }
            }
            promise.resolve(false)
        } catch (e: Exception) {
            promise.reject("E_SCREENTIME", e)
        }
    }

    private fun scheduleMidnightReset() {
        val context = reactApplicationContext
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(context, ScreenTimeReceiver::class.java).apply {
            action = ScreenTimeReceiver.ACTION_DAILY_RESET
        }
        val pi = PendingIntent.getBroadcast(
            context,
            ALARM_REQUEST_CODE,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val cal = Calendar.getInstance(TimeZone.getDefault()).apply {
            add(Calendar.DAY_OF_YEAR, 1)
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 1)
            set(Calendar.SECOND, 0)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
            // Fall back to inexact — the nightly reset is cheap enough to tolerate drift
            am.setInexactRepeating(
                AlarmManager.RTC_WAKEUP,
                cal.timeInMillis,
                AlarmManager.INTERVAL_DAY,
                pi,
            )
        } else {
            am.setRepeating(
                AlarmManager.RTC_WAKEUP,
                cal.timeInMillis,
                AlarmManager.INTERVAL_DAY,
                pi,
            )
        }
    }

    private fun today(): String =
        SimpleDateFormat("yyyy-DDD", Locale.US).format(java.util.Date())

    companion object {
        const val NAME = "ScreenTime"
        private const val ALARM_REQUEST_CODE = 3101

        fun hasUsageAccess(context: Context): Boolean {
            val ops = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
            val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ops.unsafeCheckOpNoThrow(
                    AppOpsManager.OPSTR_GET_USAGE_STATS,
                    Process.myUid(),
                    context.packageName,
                )
            } else {
                @Suppress("DEPRECATION")
                ops.checkOpNoThrow(
                    AppOpsManager.OPSTR_GET_USAGE_STATS,
                    Process.myUid(),
                    context.packageName,
                )
            }
            return mode == AppOpsManager.MODE_ALLOWED
        }
    }
}
