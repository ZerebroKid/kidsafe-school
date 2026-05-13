package com.kidsafe.modules

import android.app.AlarmManager
import android.app.AppOpsManager
import android.app.PendingIntent
import android.app.admin.DevicePolicyManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Process
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
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
