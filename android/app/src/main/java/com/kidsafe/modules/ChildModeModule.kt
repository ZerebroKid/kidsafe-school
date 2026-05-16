package com.kidsafe.modules

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.kidsafe.store.KidSafeStore

/**
 * JS bridge for the shared-phone "Child Mode" + device-mode flags.
 *
 * Two independent state slices, both persisted in [KidSafeStore] so native services can read
 * them without waiting for the JS engine to boot (post-reboot, after OEM kill, etc.):
 *
 *  - `sharedDevice`: set ONCE at signup when the parent picks "One shared phone". Tells
 *    `AppBlockerService` to treat the install as parent-owned when Child Mode is OFF.
 *  - `childModeActive`: flipped at runtime when the parent hands the phone to the child via
 *    "Start Child Mode" / "Exit Child Mode". Drives the kiosk routing in JS and the blocking
 *    enforcement gate in native.
 *
 * Two-device installs never call `setSharedDevice(true)` and behave exactly as before.
 */
class ChildModeModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = NAME

    /** Returns whether this install is currently in shared-phone mode. */
    @ReactMethod
    fun isSharedDevice(promise: Promise) {
        try {
            promise.resolve(KidSafeStore.isSharedDevice(reactApplicationContext))
        } catch (e: Exception) {
            promise.reject("E_CHILD_MODE", e)
        }
    }

    /** Persists the device-mode flag. Called once during signup and on mode-switch. */
    @ReactMethod
    fun setSharedDevice(shared: Boolean, promise: Promise) {
        try {
            KidSafeStore.setSharedDevice(reactApplicationContext, shared)
            if (!shared) {
                // Mode switched back to two-device: clear any lingering Child Mode state so
                // a stale flag from a previous shared session can't trap the user in a kiosk.
                KidSafeStore.setChildModeActive(reactApplicationContext, false)
            }
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("E_CHILD_MODE", e)
        }
    }

    /**
     * Returns true when the parent has flipped Child Mode on (or it persisted across a
     * reboot). `RootNavigator` polls this to decide whether to render the kiosk.
     */
    @ReactMethod
    fun isActive(promise: Promise) {
        try {
            promise.resolve(KidSafeStore.isChildModeActive(reactApplicationContext))
        } catch (e: Exception) {
            promise.reject("E_CHILD_MODE", e)
        }
    }

    /**
     * Flip Child Mode. The accompanying [profileId] is the shared-profile `childUid`
     * (`${parentUid}_shared`) so native code can mirror it back into Firestore if needed.
     */
    @ReactMethod
    fun setActive(active: Boolean, profileId: String?, promise: Promise) {
        try {
            KidSafeStore.setChildModeActive(reactApplicationContext, active, profileId)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("E_CHILD_MODE", e)
        }
    }

    /** Read the profile id stored alongside the active flag. */
    @ReactMethod
    fun getProfileId(promise: Promise) {
        try {
            promise.resolve(KidSafeStore.getChildModeProfileId(reactApplicationContext))
        } catch (e: Exception) {
            promise.reject("E_CHILD_MODE", e)
        }
    }

    /** Read when Child Mode was started (millis epoch, or 0 if not active). */
    @ReactMethod
    fun getStartedAt(promise: Promise) {
        try {
            promise.resolve(KidSafeStore.getChildModeStartedAt(reactApplicationContext).toDouble())
        } catch (e: Exception) {
            promise.reject("E_CHILD_MODE", e)
        }
    }

    companion object {
        const val NAME = "ChildMode"
    }
}
