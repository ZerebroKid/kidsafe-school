package com.kidsafe.store

import android.content.Context
import android.content.SharedPreferences
import java.util.Calendar

/**
 * Simple SharedPreferences-backed cache that the native receivers and services read from.
 * The React Native layer keeps this cache in sync with Firestore (it is the authoritative source),
 * so that native code — which runs before the JS engine is alive (boot, package install, etc.) —
 * can still make decisions without waiting for JS.
 *
 * We deliberately keep this minimal: only flags and short lists that native Kotlin needs.
 */
object KidSafeStore {
    private const val PREFS = "kidsafe_prefs"

    const val ROLE = "role"                          // "parent" | "child" | null
    const val CHILD_UID = "child_uid"                // Firestore uid, needed by services
    const val PARENT_UID = "parent_uid"
    const val DEVICE_ADMIN_ACTIVE = "device_admin_active"
    const val LOCKED = "locked"                      // immediate lock flag
    const val BLOCKED_PACKAGES = "blocked_packages"  // semicolon-joined list
    const val SCREEN_TIME_LIMIT_MINS = "screen_time_limit_mins"
    const val SCREEN_TIME_USED_MINS = "screen_time_used_mins"
    const val SCREEN_TIME_DAY = "screen_time_day"    // yyyy-DDD
    const val GEOFENCE_CENTER_LAT = "gf_lat"
    const val GEOFENCE_CENTER_LNG = "gf_lng"
    const val GEOFENCE_RADIUS_M = "gf_radius"
    const val GEOFENCE_ACTIVE = "gf_active"
    const val SCHEDULE_ENABLED = "sch_enabled"
    const val SCHEDULE_DAYS_MASK = "sch_days_mask"     // bit 0 = Sun .. bit 6 = Sat
    const val SCHEDULE_START_MINS = "sch_start"
    const val SCHEDULE_END_MINS = "sch_end"
    const val SCHEDULE_ALLOWED = "sch_allowed"          // semicolon-joined list

    private fun prefs(context: Context): SharedPreferences =
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun getRole(context: Context): String? = prefs(context).getString(ROLE, null)
    fun setRole(context: Context, role: String?) {
        prefs(context).edit().putString(ROLE, role).apply()
    }

    fun getChildUid(context: Context): String? = prefs(context).getString(CHILD_UID, null)
    fun setChildUid(context: Context, uid: String?) {
        prefs(context).edit().putString(CHILD_UID, uid).apply()
    }

    fun setDeviceAdminActive(context: Context, active: Boolean) {
        prefs(context).edit().putBoolean(DEVICE_ADMIN_ACTIVE, active).apply()
    }

    fun isDeviceAdminActive(context: Context): Boolean =
        prefs(context).getBoolean(DEVICE_ADMIN_ACTIVE, false)

    fun getBlockedPackages(context: Context): Set<String> {
        val raw = prefs(context).getString(BLOCKED_PACKAGES, "") ?: ""
        return if (raw.isBlank()) emptySet() else raw.split(";").toSet()
    }

    fun setBlockedPackages(context: Context, packages: Collection<String>) {
        prefs(context).edit().putString(BLOCKED_PACKAGES, packages.joinToString(";")).apply()
    }

    fun isLocked(context: Context): Boolean = prefs(context).getBoolean(LOCKED, false)
    fun setLocked(context: Context, locked: Boolean) {
        prefs(context).edit().putBoolean(LOCKED, locked).apply()
    }

    fun getScreenTimeLimitMins(context: Context): Int =
        prefs(context).getInt(SCREEN_TIME_LIMIT_MINS, 0)

    fun setScreenTimeLimitMins(context: Context, mins: Int) {
        prefs(context).edit().putInt(SCREEN_TIME_LIMIT_MINS, mins).apply()
    }

    fun getScreenTimeUsedMins(context: Context): Int =
        prefs(context).getInt(SCREEN_TIME_USED_MINS, 0)

    fun setScreenTimeUsedMins(context: Context, mins: Int) {
        prefs(context).edit().putInt(SCREEN_TIME_USED_MINS, mins).apply()
    }

    fun getScreenTimeDay(context: Context): String? =
        prefs(context).getString(SCREEN_TIME_DAY, null)

    fun setScreenTimeDay(context: Context, day: String) {
        prefs(context).edit().putString(SCREEN_TIME_DAY, day).apply()
    }

    fun setGeofence(context: Context, lat: Double, lng: Double, radius: Float, active: Boolean) {
        prefs(context).edit()
            .putFloat(GEOFENCE_CENTER_LAT, lat.toFloat())
            .putFloat(GEOFENCE_CENTER_LNG, lng.toFloat())
            .putFloat(GEOFENCE_RADIUS_M, radius)
            .putBoolean(GEOFENCE_ACTIVE, active)
            .apply()
    }

    fun getGeofenceActive(context: Context): Boolean =
        prefs(context).getBoolean(GEOFENCE_ACTIVE, false)

    // -- Scheduler ----------------------------------------------------------

    fun setSchedule(
        context: Context,
        enabled: Boolean,
        daysMask: Int,
        startMins: Int,
        endMins: Int,
        allowed: Collection<String>,
    ) {
        prefs(context).edit()
            .putBoolean(SCHEDULE_ENABLED, enabled)
            .putInt(SCHEDULE_DAYS_MASK, daysMask)
            .putInt(SCHEDULE_START_MINS, startMins)
            .putInt(SCHEDULE_END_MINS, endMins)
            .putString(SCHEDULE_ALLOWED, allowed.joinToString(";"))
            .apply()
    }

    fun getScheduleAllowed(context: Context): Set<String> {
        val raw = prefs(context).getString(SCHEDULE_ALLOWED, "") ?: ""
        return if (raw.isBlank()) emptySet() else raw.split(";").toSet()
    }

    /**
     * Returns true if the parent-configured schedule window covers "now" in the
     * device's local time. Handles windows that wrap past midnight (e.g. 21:00 → 07:00)
     * by inspecting the previous day's day-of-week bit.
     *
     * Reads SharedPreferences cheaply enough to call from `onAccessibilityEvent`.
     */
    fun isScheduleActiveNow(context: Context): Boolean {
        val p = prefs(context)
        if (!p.getBoolean(SCHEDULE_ENABLED, false)) return false
        val daysMask = p.getInt(SCHEDULE_DAYS_MASK, 0)
        if (daysMask == 0) return false
        val start = p.getInt(SCHEDULE_START_MINS, 0)
        val end = p.getInt(SCHEDULE_END_MINS, 0)

        val cal = Calendar.getInstance()
        // Calendar.DAY_OF_WEEK: SUNDAY=1..SATURDAY=7; convert to 0..6 (Sun..Sat).
        val dow = cal.get(Calendar.DAY_OF_WEEK) - 1
        val nowMins = cal.get(Calendar.HOUR_OF_DAY) * 60 + cal.get(Calendar.MINUTE)

        return if (start <= end) {
            (daysMask shr dow and 1) == 1 && nowMins in start until end
        } else {
            // Wraps midnight: window is [start..1440) on day X plus [0..end) on day X+1.
            val fromStartToday = (daysMask shr dow and 1) == 1 && nowMins >= start
            val prevDow = (dow + 6) % 7
            val intoEndFromYday = (daysMask shr prevDow and 1) == 1 && nowMins < end
            fromStartToday || intoEndFromYday
        }
    }
}
