package com.kidsafe.modules

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.text.TextUtils
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.kidsafe.blocker.AppBlockerService
import com.kidsafe.store.KidSafeStore

/**
 * JS bridge for the AppBlockerService. Lets JS:
 *   - update the cached blocklist (called whenever Firestore pushes a change)
 *   - check & request the Accessibility Service permission
 *   - check & request the overlay (`SYSTEM_ALERT_WINDOW`) permission
 */
class AppBlockerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = NAME

    @ReactMethod
    fun setBlockedPackages(packages: ReadableArray, promise: Promise) {
        try {
            val set = (0 until packages.size()).map { packages.getString(it) ?: "" }
                .filter { it.isNotBlank() }
                .toSet()
            KidSafeStore.setBlockedPackages(reactApplicationContext, set)
            Log.i(TAG, "Blocklist updated (${set.size}): ${set.joinToString(",")}")
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("E_APP_BLOCKER", e)
        }
    }

    @ReactMethod
    fun getBlockedPackages(promise: Promise) {
        val set = KidSafeStore.getBlockedPackages(reactApplicationContext)
        val array = Arguments.createArray()
        set.forEach { array.pushString(it) }
        promise.resolve(array)
    }

    @ReactMethod
    fun isAccessibilityServiceEnabled(promise: Promise) {
        promise.resolve(isAccessibilityEnabled(reactApplicationContext))
    }

    @ReactMethod
    fun openAccessibilitySettings(promise: Promise) {
        // Try OEM deep links first so the user lands on KidSafe's row directly. Fall back to the
        // generic accessibility list, then to the app's "App info" page so they can tap
        // "⋮ → Allow restricted settings" if Android 13+ has blocked the toggle.
        val pkg = reactApplicationContext.packageName
        val candidates = mutableListOf<Intent>()
        if (OemSettingsModule.detectOem() == OemSettingsModule.OEM_XIAOMI) {
            candidates += Intent("miui.intent.action.APP_PERM_EDITOR").apply {
                setClassName(
                    "com.miui.securitycenter",
                    "com.miui.permcenter.permissions.PermissionsEditorActivity",
                )
                putExtra("extra_pkgname", pkg)
            }
        }
        candidates += Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
        candidates += Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
            data = android.net.Uri.parse("package:$pkg")
        }

        for (intent in candidates) {
            try {
                intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
                reactApplicationContext.startActivity(intent)
                promise.resolve(null)
                return
            } catch (_: Exception) {
                // Try the next candidate
            }
        }
        promise.reject("E_APP_BLOCKER", "No accessibility settings activity found")
    }

    @ReactMethod
    fun canDrawOverlays(promise: Promise) {
        promise.resolve(Settings.canDrawOverlays(reactApplicationContext))
    }

    @ReactMethod
    fun openOverlaySettings(promise: Promise) {
        // Try the package-targeted intent first (lands directly on KidSafe's toggle on most
        // OEMs). If that throws — some HyperOS / ColorOS builds have rejected it — fall back to
        // the un-targeted "Display over other apps" list.
        val pkg = reactApplicationContext.packageName
        val candidates = listOf(
            Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                android.net.Uri.parse("package:$pkg"),
            ),
            Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION),
            Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = android.net.Uri.parse("package:$pkg")
            },
        )
        for (intent in candidates) {
            try {
                intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
                reactApplicationContext.startActivity(intent)
                promise.resolve(null)
                return
            } catch (_: Exception) {
                // Try next
            }
        }
        promise.reject("E_APP_BLOCKER", "No overlay settings activity found")
    }

    private fun isAccessibilityEnabled(context: Context): Boolean {
        // Some OEM skins (Infinix XOS, MIUI) leave stale service entries even when the master
        // accessibility switch is off, so we also consult `ACCESSIBILITY_ENABLED`.
        val master = Settings.Secure.getInt(
            context.contentResolver,
            Settings.Secure.ACCESSIBILITY_ENABLED,
            0,
        )
        if (master != 1) return false

        val expected = ComponentName(context, AppBlockerService::class.java)
        val setting = Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES,
        ) ?: return false

        val splitter = TextUtils.SimpleStringSplitter(':')
        splitter.setString(setting)
        while (splitter.hasNext()) {
            val entry = splitter.next().trim()
            val parsed = ComponentName.unflattenFromString(entry) ?: continue
            if (parsed == expected) return true
        }
        return false
    }

    companion object {
        const val NAME = "AppBlocker"
        private const val TAG = "AppBlockerModule"
    }
}
