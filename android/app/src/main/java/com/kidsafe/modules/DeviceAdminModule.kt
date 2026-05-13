package com.kidsafe.modules

import android.app.admin.DevicePolicyManager
import android.content.Context
import android.content.Intent
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.kidsafe.receivers.KidSafeDeviceAdminReceiver

/**
 * JS <-> Kotlin bridge for device-admin features: lockNow, activation, status.
 *
 * Called from `src/modules/native.ts` -> `DeviceAdmin.lockNow()` on the child app. Triggered from a
 * Firestore listener when the parent toggles `children/{uid}.lockState.locked`.
 */
class DeviceAdminModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = NAME

    private val dpm: DevicePolicyManager
        get() = reactApplicationContext.getSystemService(Context.DEVICE_POLICY_SERVICE)
            as DevicePolicyManager

    @ReactMethod
    fun isActive(promise: Promise) {
        try {
            val component = KidSafeDeviceAdminReceiver.componentName(reactApplicationContext)
            promise.resolve(dpm.isAdminActive(component))
        } catch (e: Exception) {
            promise.reject("E_DEVICE_ADMIN", e)
        }
    }

    /**
     * Opens the system screen that asks the user to grant device-admin rights to KidSafe.
     * Resolves as soon as the intent is fired (JS should poll [isActive] or wait for focus change).
     *
     * The primary intent (ACTION_ADD_DEVICE_ADMIN) lands the user directly on the "Activate this
     * device admin app?" screen. On stripped-down OEM builds it can fail to resolve — in that case
     * we walk a fallback chain so the user always lands somewhere they can grant the permission:
     *
     *   1. ACTION_ADD_DEVICE_ADMIN                  -> direct activation page
     *   2. Settings.ACTION_SECURITY_SETTINGS        -> Security page (Device admin apps lives here)
     *   3. Settings.ACTION_SETTINGS                 -> root Settings as last resort
     *
     * The promise resolves with the path string ("primary" / "security_fallback" /
     * "settings_fallback") so JS can branch UI copy or telemetry on it later.
     */
    @ReactMethod
    fun requestActivation(promise: Promise) {
        try {
            val component = KidSafeDeviceAdminReceiver.componentName(reactApplicationContext)
            val pm = reactApplicationContext.packageManager

            val primary = Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN).apply {
                putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, component)
                putExtra(
                    DevicePolicyManager.EXTRA_ADD_EXPLANATION,
                    "KidSafe needs device-admin rights so your parent can lock this device remotely and so the app can't be uninstalled without approval.",
                )
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            if (primary.resolveActivity(pm) != null) {
                reactApplicationContext.startActivity(primary)
                promise.resolve("primary")
                return
            }

            val securityFallback = Intent(Settings.ACTION_SECURITY_SETTINGS).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            if (securityFallback.resolveActivity(pm) != null) {
                reactApplicationContext.startActivity(securityFallback)
                promise.resolve("security_fallback")
                return
            }

            val rootFallback = Intent(Settings.ACTION_SETTINGS).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            if (rootFallback.resolveActivity(pm) != null) {
                reactApplicationContext.startActivity(rootFallback)
                promise.resolve("settings_fallback")
                return
            }

            promise.reject(
                "E_DEVICE_ADMIN",
                "No system activity could handle the device-admin activation intent on this device.",
            )
        } catch (e: Exception) {
            promise.reject("E_DEVICE_ADMIN", e)
        }
    }

    @ReactMethod
    fun lockNow(promise: Promise) {
        try {
            val component = KidSafeDeviceAdminReceiver.componentName(reactApplicationContext)
            if (!dpm.isAdminActive(component)) {
                promise.reject("E_NOT_ADMIN", "Device admin is not active")
                return
            }
            dpm.lockNow()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("E_DEVICE_ADMIN", e)
        }
    }

    companion object {
        const val NAME = "DeviceAdmin"
    }
}
