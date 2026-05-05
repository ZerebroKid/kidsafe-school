package com.kidsafe.store

import android.content.Context
import android.content.SharedPreferences
import android.util.Base64
import java.security.MessageDigest
import java.security.SecureRandom
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

    // -- Parent PIN (uninstall protection) ----------------------------------
    const val PARENT_PIN_HASH = "parent_pin_hash"        // base64(sha256(salt || pin))
    const val PARENT_PIN_SALT = "parent_pin_salt"        // base64(16 random bytes)
    const val PARENT_PIN_FAIL_COUNT = "parent_pin_fail_count"
    const val PARENT_PIN_LOCKED_UNTIL = "parent_pin_locked_until" // millis epoch

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

    // -- Parent PIN ---------------------------------------------------------
    //
    // We store SHA-256(salt || pin) plus the salt. SHA-256 is not a "password hash" in the strict
    // bcrypt/Argon2 sense, but for a 4-6 digit numeric PIN that lives only on-device behind a
    // hardware lockscreen, with rate-limited attempts, it's adequate and avoids pulling in extra
    // crypto libs. The lockout schedule is the real defense against brute force.

    private const val MAX_FAILS_BEFORE_LOCKOUT = 5
    private const val LOCKOUT_BASE_MS = 30_000L     // 30 seconds first lockout
    private const val LOCKOUT_MAX_MS = 10 * 60_000L // 10 minute cap

    fun hasPin(context: Context): Boolean {
        val p = prefs(context)
        return !p.getString(PARENT_PIN_HASH, null).isNullOrBlank() &&
            !p.getString(PARENT_PIN_SALT, null).isNullOrBlank()
    }

    fun setPin(context: Context, pin: String) {
        val salt = ByteArray(16).also { SecureRandom().nextBytes(it) }
        val hash = sha256(salt + pin.toByteArray(Charsets.UTF_8))
        prefs(context).edit()
            .putString(PARENT_PIN_SALT, Base64.encodeToString(salt, Base64.NO_WRAP))
            .putString(PARENT_PIN_HASH, Base64.encodeToString(hash, Base64.NO_WRAP))
            .putInt(PARENT_PIN_FAIL_COUNT, 0)
            .putLong(PARENT_PIN_LOCKED_UNTIL, 0L)
            .apply()
    }

    fun clearPin(context: Context) {
        prefs(context).edit()
            .remove(PARENT_PIN_HASH)
            .remove(PARENT_PIN_SALT)
            .remove(PARENT_PIN_FAIL_COUNT)
            .remove(PARENT_PIN_LOCKED_UNTIL)
            .apply()
    }

    /**
     * Returns 0 when entry is allowed, otherwise milliseconds remaining in the current lockout.
     */
    fun pinLockoutRemainingMs(context: Context): Long {
        val until = prefs(context).getLong(PARENT_PIN_LOCKED_UNTIL, 0L)
        val now = System.currentTimeMillis()
        return if (until > now) until - now else 0L
    }

    /**
     * Compares [pin] against the stored salted hash. On success, resets fail counter & lockout.
     * On failure, increments the counter and — once it crosses [MAX_FAILS_BEFORE_LOCKOUT] —
     * starts an exponentially growing lockout (30s, 60s, 120s, ... capped at 10 minutes).
     */
    fun verifyPin(context: Context, pin: String): Boolean {
        val p = prefs(context)
        if (pinLockoutRemainingMs(context) > 0) return false

        val saltStr = p.getString(PARENT_PIN_SALT, null) ?: return false
        val expected = p.getString(PARENT_PIN_HASH, null) ?: return false
        val salt = Base64.decode(saltStr, Base64.NO_WRAP)
        val actual = Base64.encodeToString(
            sha256(salt + pin.toByteArray(Charsets.UTF_8)),
            Base64.NO_WRAP,
        )

        return if (constantTimeEquals(actual, expected)) {
            p.edit()
                .putInt(PARENT_PIN_FAIL_COUNT, 0)
                .putLong(PARENT_PIN_LOCKED_UNTIL, 0L)
                .apply()
            true
        } else {
            val fails = p.getInt(PARENT_PIN_FAIL_COUNT, 0) + 1
            val edit = p.edit().putInt(PARENT_PIN_FAIL_COUNT, fails)
            if (fails >= MAX_FAILS_BEFORE_LOCKOUT) {
                // Lockout doubles each round above the threshold (30s, 60s, 120s...).
                val multiplier = 1L shl (fails - MAX_FAILS_BEFORE_LOCKOUT).coerceAtMost(10)
                val duration = (LOCKOUT_BASE_MS * multiplier).coerceAtMost(LOCKOUT_MAX_MS)
                edit.putLong(PARENT_PIN_LOCKED_UNTIL, System.currentTimeMillis() + duration)
            }
            edit.apply()
            false
        }
    }

    private fun sha256(input: ByteArray): ByteArray =
        MessageDigest.getInstance("SHA-256").digest(input)

    private fun constantTimeEquals(a: String, b: String): Boolean {
        if (a.length != b.length) return false
        var diff = 0
        for (i in a.indices) diff = diff or (a[i].code xor b[i].code)
        return diff == 0
    }
}
