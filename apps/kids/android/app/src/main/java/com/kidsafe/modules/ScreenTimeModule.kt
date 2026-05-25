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
import android.util.Log
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

            // Event-pairing instead of `queryUsageStats(INTERVAL_DAILY).sum { totalTimeInForeground }`.
            // The old bucket-sum was off by ~10x on Transsion/XOS because:
            //   1. INTERVAL_DAILY returns the full bucket totals (not clipped to [start, end])
            //   2. Multiple records per app per overlapping bucket get summed → double counting
            //   3. OEM buckets include ambient / split-screen / recents-preview time
            // Event pairing matches what Digital Wellbeing shows.
            val perPkgMs = queryForegroundMsPerPackage(usm, start, end)
            val ownPkg = reactApplicationContext.packageName
            val totalMs = perPkgMs.entries
                .filter { (pkg, _) -> !isSystemNoise(pkg, ownPkg) }
                .sumOf { it.value }
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

                // Event-pairing produces actual on-screen time per package — matches Digital
                // Wellbeing. See the long comment in `getTodayUsedMinutes` for why
                // `queryUsageStats(INTERVAL_DAILY)` inflated numbers by ~10x on XOS/HiOS.
                val perPackageMs = queryForegroundMsPerPackage(usm, startMs, endMs)
                    .filterKeys { !isSystemNoise(it, ownPkg) }

                val ranked = perPackageMs
                    .map { (pkg, ms) -> pkg to (ms / 1000 / 60).toInt() }
                    .filter { it.second >= 1 }
                    .sortedByDescending { it.second }
                    .take(cap)
                val totalMins = ranked.sumOf { it.second }

                // Diagnostic: lets us cross-check what the kernel reports against Digital
                // Wellbeing. Logged once per day in the requested window — cheap, and printed
                // only when JS calls getPerAppUsage (startup + every 10 min, not on every poll).
                Log.i(
                    TAG,
                    "perAppUsage day=$dateKey total=${totalMins}m top=${ranked.take(5)}",
                )

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

    /**
     * Walks `UsageEvents` in `[startMs - LOOKBACK_MS, endMs]` and returns the sum of every
     * package's actual foreground time clipped to `[startMs, endMs]`.
     *
     * Why we don't use `queryUsageStats(INTERVAL_DAILY).sum`:
     *  - The returned `totalTimeInForeground` is the **whole bucket**, not the slice within
     *    `[startMs, endMs]`. Querying "midnight → now" for today still returns the full daily
     *    bucket, and on OEMs that have not yet rolled the bucket (XOS, HiOS, MIUI) it includes
     *    yesterday's residue.
     *  - For multi-day windows `queryUsageStats` returns several records per package across
     *    overlapping buckets; summing them double-counts.
     *  - OEM aggregates include ambient / split-screen / recents-preview time that real users
     *    don't perceive as "screen time".
     *
     * The pairing algorithm:
     *  1. Look back `LOOKBACK_MS` before `startMs` so a session that began before the window
     *     can still be paired with its `MOVE_TO_BACKGROUND` inside the window.
     *  2. For every package, track an `openSince` timestamp set on `MOVE_TO_FOREGROUND` /
     *     `ACTIVITY_RESUMED`. On `MOVE_TO_BACKGROUND` / `ACTIVITY_PAUSED` / `ACTIVITY_STOPPED`,
     *     close the session and add `(pauseTs - openSince)` clipped to `[startMs, endMs]`.
     *  3. `SCREEN_NON_INTERACTIVE` / `KEYGUARD_SHOWN` / `DEVICE_SHUTDOWN` force-close every
     *     open session — protects against OEMs that drop the per-activity PAUSED when the
     *     screen turns off (common on Transsion).
     *  4. Sessions still open at the end of the loop are closed at `min(endMs, now)`.
     */
    private fun queryForegroundMsPerPackage(
        usm: UsageStatsManager,
        startMs: Long,
        endMs: Long,
    ): Map<String, Long> {
        val totals = HashMap<String, Long>()
        val openSince = HashMap<String, Long>()
        val events = try {
            usm.queryEvents(startMs - LOOKBACK_MS, endMs)
        } catch (_: Exception) {
            return totals
        }
        val event = UsageEvents.Event()

        fun closeSession(pkg: String, pauseTs: Long) {
            val openedAt = openSince.remove(pkg) ?: return
            val effStart = openedAt.coerceAtLeast(startMs)
            val effEnd = pauseTs.coerceAtMost(endMs)
            val delta = (effEnd - effStart).coerceAtLeast(0L)
            if (delta > 0L) {
                totals[pkg] = (totals[pkg] ?: 0L) + delta
            }
        }

        while (events.hasNextEvent()) {
            events.getNextEvent(event)
            val pkg = event.packageName ?: continue
            val ts = event.timeStamp
            when (event.eventType) {
                UsageEvents.Event.MOVE_TO_FOREGROUND -> {
                    // Idempotent: if the same package re-resumes (activity nav within the
                    // app) we keep the earliest openSince so we don't reset the timer.
                    if (!openSince.containsKey(pkg)) {
                        openSince[pkg] = ts
                    }
                }
                UsageEvents.Event.MOVE_TO_BACKGROUND -> closeSession(pkg, ts)
                else -> {
                    // Treat lifecycle "off" signals as a forced pause for every open session.
                    // The event-type constants for these are SDK 28+, so we compare by int
                    // to avoid a hard ApiRequirement on devices below that level.
                    val type = event.eventType
                    val isOffSignal = (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P && (
                        type == 16 || // SCREEN_NON_INTERACTIVE
                        type == 17    // KEYGUARD_SHOWN
                    )) || (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && type == 26) // DEVICE_SHUTDOWN
                    if (isOffSignal && openSince.isNotEmpty()) {
                        val snapshot = openSince.keys.toList()
                        for (openPkg in snapshot) {
                            closeSession(openPkg, ts)
                        }
                    }
                }
            }
        }

        // Window-end fallback: anything still "open" gets clipped to min(endMs, now). For
        // historical days (endMs < now) this means clipping at endMs. For today it clips at
        // now so a session that's still in foreground only counts up to "right now".
        if (openSince.isNotEmpty()) {
            val cutoff = endMs.coerceAtMost(System.currentTimeMillis())
            for (pkg in openSince.keys.toList()) {
                closeSession(pkg, cutoff)
            }
        }
        return totals
    }

    /**
     * Returns true for packages that should be excluded from "screen time": our own app, the
     * SystemUI shell, permission-controller (transient permission dialogs), and every known
     * launcher / home prefix. Matching is case-insensitive — XOS calls itself
     * `com.transsion.XOSLauncher` with mixed casing on Infinix.
     */
    private fun isSystemNoise(pkg: String, ownPkg: String): Boolean {
        if (pkg == ownPkg) return true
        if (pkg in ALWAYS_FILTERED) return true
        val normalized = pkg.lowercase()
        return LAUNCHER_PREFIXES.any { normalized == it || normalized.startsWith(it) }
    }

    companion object {
        const val NAME = "ScreenTime"
        private const val TAG = "KidSafe.ScreenTime"
        private const val ALARM_REQUEST_CODE = 3101

        /**
         * Look-back applied to every event-window query so sessions that began before
         * `startMs` can still be paired with their `MOVE_TO_BACKGROUND` inside the window. 24h
         * is enough for any realistic phone-use session.
         */
        private const val LOOKBACK_MS = 24L * 60L * 60L * 1000L

        /** Always excluded from per-app rollups regardless of casing or prefix. */
        private val ALWAYS_FILTERED = setOf(
            "com.android.systemui",
            "android",
            "com.google.android.permissioncontroller",
            "com.android.permissioncontroller",
        )

        /**
         * Launcher / home prefixes treated as "home screen visit" — not real app usage. Kept
         * in sync with the same list used by the live-pill resolver
         * (`KidSafeForegroundService.LAUNCHER_PREFIXES`) and the parent UI
         * (`CurrentAppPill.LAUNCHER_PREFIXES`). Add new OEM launchers here whenever a launcher
         * starts appearing in the chart.
         */
        private val LAUNCHER_PREFIXES = listOf(
            "com.android.launcher",
            "com.google.android.apps.nexuslauncher",
            "com.sec.android.app.launcher",
            "com.miui.home",
            "com.miui.launcher",
            "com.oppo.launcher",
            "com.bbk.launcher2",
            "com.realme.launcher",
            "com.oneplus.launcher",
            "net.oneplus.launcher",
            "com.transsion.xoslauncher",
            "com.transsion.launcher",
            "com.infinix.xlauncher",
        )

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
