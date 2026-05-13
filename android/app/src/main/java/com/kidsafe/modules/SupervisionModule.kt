package com.kidsafe.modules

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.kidsafe.store.KidSafeStore

/**
 * JS bridge for the "supervision window" used by the onboarding wizard.
 *
 * Why this exists:
 *   When the parent walks the child through onboarding, they intentionally tap "Open settings"
 *   for screens that the tamper-protection layer would normally gate behind the parent PIN
 *   (Accessibility, Usage access, Battery, Autostart, ...). The wizard arms a short supervision
 *   window before opening Settings; [com.kidsafe.blocker.AppBlockerService] honors it and
 *   suppresses the gate. The window auto-expires (default 3 min) so protection comes back even
 *   if the parent abandons mid-onboarding.
 */
class SupervisionModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = NAME

    /**
     * Arm supervision for the next [durationMs] milliseconds. Re-arming extends the window.
     * JS sends a Double because RN's bridge has no native Long; we coerce safely here.
     */
    @ReactMethod
    fun arm(durationMs: Double, promise: Promise) {
        try {
            val ms = durationMs.toLong().coerceIn(0L, MAX_DURATION_MS)
            val until = System.currentTimeMillis() + ms
            KidSafeStore.setSupervisionUntil(reactApplicationContext, until)
            promise.resolve(until.toDouble())
        } catch (e: Exception) {
            promise.reject("E_SUPERVISION", e)
        }
    }

    /** Disarm supervision immediately. Called from the FinalStep of onboarding. */
    @ReactMethod
    fun disarm(promise: Promise) {
        try {
            KidSafeStore.clearSupervision(reactApplicationContext)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("E_SUPERVISION", e)
        }
    }

    @ReactMethod
    fun isActive(promise: Promise) {
        try {
            promise.resolve(KidSafeStore.isUnderSupervision(reactApplicationContext))
        } catch (e: Exception) {
            promise.reject("E_SUPERVISION", e)
        }
    }

    companion object {
        const val NAME = "Supervision"
        // Hard cap at 30 minutes so a malformed JS call can't permanently disable the gate.
        private const val MAX_DURATION_MS = 30L * 60_000L
    }
}
