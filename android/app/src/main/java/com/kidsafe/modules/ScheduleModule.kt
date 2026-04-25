package com.kidsafe.modules

import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.kidsafe.store.KidSafeStore

/**
 * JS bridge for the parent-configured app-allowlist schedule. The schedule is stored in
 * SharedPreferences (via [KidSafeStore]) so the AccessibilityService can evaluate it
 * without needing the JS engine to be alive — important right after boot or when the
 * RN app has been swiped away.
 */
class ScheduleModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = NAME

    /**
     * @param enabled    whether the schedule should be considered active at all
     * @param daysMask   bitmask of days the schedule applies to. Bit 0 = Sun .. bit 6 = Sat.
     * @param startMins  start time in minutes since local midnight (0..1439)
     * @param endMins    end time in minutes since local midnight (0..1439). If <= startMins
     *                   the window wraps past midnight (e.g. 21:00 → 07:00).
     * @param allowed    package names that remain usable while the window is active.
     */
    @ReactMethod
    fun setSchedule(
        enabled: Boolean,
        daysMask: Int,
        startMins: Int,
        endMins: Int,
        allowed: ReadableArray,
        promise: Promise,
    ) {
        try {
            val pkgs = (0 until allowed.size())
                .map { allowed.getString(it) ?: "" }
                .filter { it.isNotBlank() }
            KidSafeStore.setSchedule(
                reactApplicationContext,
                enabled,
                daysMask,
                startMins,
                endMins,
                pkgs,
            )
            Log.i(
                TAG,
                "Schedule updated enabled=$enabled days=0b${Integer.toBinaryString(daysMask)} " +
                    "start=$startMins end=$endMins allowed=${pkgs.size}",
            )
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("E_SCHEDULE", e)
        }
    }

    @ReactMethod
    fun isActiveNow(promise: Promise) {
        promise.resolve(KidSafeStore.isScheduleActiveNow(reactApplicationContext))
    }

    companion object {
        const val NAME = "Schedule"
        private const val TAG = "ScheduleModule"
    }
}
