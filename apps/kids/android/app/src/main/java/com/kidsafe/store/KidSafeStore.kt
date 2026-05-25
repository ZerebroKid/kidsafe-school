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

    // -- Gate bypass + supervision (anti-loop / onboarding) ----------------
    const val GATE_BYPASS_KEY = "gate_bypass_key"        // "<pkg>|<class>" the gate just cleared
    const val GATE_BYPASS_UNTIL = "gate_bypass_until"    // millis epoch when the bypass expires
    const val SUPERVISION_UNTIL = "supervision_until"    // millis epoch the parent's wizard owns

    // -- Shared phone / Child Mode -----------------------------------------
    const val DEVICE_MODE = "device_mode"                // "shared" | "two_device" | null
    const val CHILD_MODE_ACTIVE = "child_mode_active"
    const val CHILD_MODE_STARTED_AT = "child_mode_started_at"
    const val CHILD_MODE_PROFILE_ID = "child_mode_profile_id"

    // -- Native live-pill resolver cache ------------------------------------
    //
    // `KidSafeForegroundService` polls `UsageStatsManager.queryEvents` every ~1.5s, resolves the
    // most recent non-launcher foreground package, and persists it here so the native Firestore
    // writer + heartbeat have a stable source of truth that survives RN engine death. We track
    // two slots:
    //   CURRENT_FG_PACKAGE / CURRENT_FG_AT — last resolved foreground package (may be null when
    //                                         only launcher activity is in view; consumers fall
    //                                         back to LAST_REAL_FG_PACKAGE).
    //   LAST_REAL_FG_PACKAGE / LAST_REAL_FG_AT — last non-launcher foreground package observed.
    //                                            Drives the "keep last real app" pill behavior.
    //   LAST_NATIVE_WRITE_AT — last successful Firestore write. JS uses this to decide whether
    //                          to skip its (secondary) coalesce write.
    const val CURRENT_FG_PACKAGE = "current_fg_package"
    const val CURRENT_FG_AT = "current_fg_at"
    const val LAST_REAL_FG_PACKAGE = "last_real_fg_package"
    const val LAST_REAL_FG_AT = "last_real_fg_at"
    const val LAST_NATIVE_WRITE_AT = "last_native_write_at"

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

    // -- Gate bypass --------------------------------------------------------
    //
    // After the user enters the correct PIN, we don't want `AppBlockerService` to immediately
    // re-launch `PinGateActivity` when the underlying Settings window resumes (which would fire
    // another `TYPE_WINDOW_STATE_CHANGED`). We tag a short bypass keyed on the *exact* window
    // (pkg|class) so unrelated tamper screens still get gated.

    fun setGateBypass(context: Context, pkg: String?, cls: String?, durationMs: Long) {
        val key = bypassKey(pkg, cls)
        prefs(context).edit()
            .putString(GATE_BYPASS_KEY, key)
            .putLong(GATE_BYPASS_UNTIL, System.currentTimeMillis() + durationMs)
            .apply()
    }

    fun isGateBypassed(context: Context, pkg: String?, cls: String?): Boolean {
        val p = prefs(context)
        val until = p.getLong(GATE_BYPASS_UNTIL, 0L)
        if (until <= System.currentTimeMillis()) return false
        val storedKey = p.getString(GATE_BYPASS_KEY, null) ?: return false
        val nowKey = bypassKey(pkg, cls)
        // Match by exact window OR by package alone — Settings sometimes routes the same screen
        // through a different inner activity (e.g. `SubSettings`) on resume.
        return storedKey == nowKey || (pkg != null && storedKey.startsWith("$pkg|"))
    }

    fun clearGateBypass(context: Context) {
        prefs(context).edit()
            .remove(GATE_BYPASS_KEY)
            .remove(GATE_BYPASS_UNTIL)
            .apply()
    }

    private fun bypassKey(pkg: String?, cls: String?): String =
        "${pkg ?: ""}|${cls ?: ""}"

    // -- Supervision window -------------------------------------------------
    //
    // When the parent is actively running the onboarding wizard, they are intentionally opening
    // Settings pages that would otherwise be considered "tamper". The wizard arms a supervision
    // window (default 3 min, auto-expiring) so the gate stops firing during setup. `FinalStep`
    // disarms it immediately, but the auto-expiry guarantees protection comes back even if the
    // parent abandons mid-onboarding.

    fun setSupervisionUntil(context: Context, untilMillis: Long) {
        prefs(context).edit().putLong(SUPERVISION_UNTIL, untilMillis).apply()
    }

    fun isUnderSupervision(context: Context): Boolean {
        val until = prefs(context).getLong(SUPERVISION_UNTIL, 0L)
        return until > System.currentTimeMillis()
    }

    fun clearSupervision(context: Context) {
        prefs(context).edit().remove(SUPERVISION_UNTIL).apply()
    }

    // -- Shared phone / Child Mode -----------------------------------------
    //
    // Shared mode means a single phone is used by both the parent and the child. We persist
    // the device mode plus a `CHILD_MODE_ACTIVE` flag so the native accessibility service can
    // make routing decisions even before the JS engine boots (post-reboot, OEM kill, etc.):
    //
    //   shared device, child mode OFF → AppBlockerService is a no-op (parent's own phone)
    //   shared device, child mode ON  → normal blocklist + schedule enforcement
    //   two-device                    → normal enforcement, regardless of these flags
    //
    // The JS layer (`ChildModeModule` + `childSyncEngine`) is the writer; native is the reader.

    fun isSharedDevice(context: Context): Boolean =
        prefs(context).getString(DEVICE_MODE, null) == "shared"

    fun setSharedDevice(context: Context, shared: Boolean) {
        prefs(context).edit()
            .putString(DEVICE_MODE, if (shared) "shared" else "two_device")
            .apply()
    }

    fun isChildModeActive(context: Context): Boolean =
        prefs(context).getBoolean(CHILD_MODE_ACTIVE, false)

    fun getChildModeProfileId(context: Context): String? =
        prefs(context).getString(CHILD_MODE_PROFILE_ID, null)

    fun getChildModeStartedAt(context: Context): Long =
        prefs(context).getLong(CHILD_MODE_STARTED_AT, 0L)

    fun setChildModeActive(context: Context, active: Boolean, profileId: String? = null) {
        val edit = prefs(context).edit().putBoolean(CHILD_MODE_ACTIVE, active)
        if (active) {
            edit.putLong(CHILD_MODE_STARTED_AT, System.currentTimeMillis())
            if (profileId != null) edit.putString(CHILD_MODE_PROFILE_ID, profileId)
        } else {
            edit.putLong(CHILD_MODE_STARTED_AT, 0L)
            // Keep the profile id around so a re-entry doesn't lose it; the parent can clear
            // it explicitly when switching modes.
        }
        edit.apply()
    }

    // -- Native live-pill resolver cache ------------------------------------

    fun getCurrentForegroundPackage(context: Context): String? =
        prefs(context).getString(CURRENT_FG_PACKAGE, null)

    fun getCurrentForegroundAt(context: Context): Long =
        prefs(context).getLong(CURRENT_FG_AT, 0L)

    fun setCurrentForegroundPackage(context: Context, pkg: String?, at: Long) {
        val edit = prefs(context).edit()
        if (pkg.isNullOrBlank()) {
            edit.remove(CURRENT_FG_PACKAGE).putLong(CURRENT_FG_AT, at)
        } else {
            edit.putString(CURRENT_FG_PACKAGE, pkg).putLong(CURRENT_FG_AT, at)
        }
        edit.apply()
    }

    fun getLastRealForegroundPackage(context: Context): String? =
        prefs(context).getString(LAST_REAL_FG_PACKAGE, null)

    fun getLastRealForegroundAt(context: Context): Long =
        prefs(context).getLong(LAST_REAL_FG_AT, 0L)

    fun setLastRealForegroundPackage(context: Context, pkg: String, at: Long) {
        prefs(context).edit()
            .putString(LAST_REAL_FG_PACKAGE, pkg)
            .putLong(LAST_REAL_FG_AT, at)
            .apply()
    }

    fun clearLastRealForegroundPackage(context: Context) {
        prefs(context).edit()
            .remove(LAST_REAL_FG_PACKAGE)
            .remove(LAST_REAL_FG_AT)
            .apply()
    }

    fun getLastNativeWriteAt(context: Context): Long =
        prefs(context).getLong(LAST_NATIVE_WRITE_AT, 0L)

    fun setLastNativeWriteAt(context: Context, at: Long) {
        prefs(context).edit().putLong(LAST_NATIVE_WRITE_AT, at).apply()
    }
}
