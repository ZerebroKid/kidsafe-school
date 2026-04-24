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
        try {
            val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
            reactApplicationContext.startActivity(intent)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("E_APP_BLOCKER", e)
        }
    }

    @ReactMethod
    fun canDrawOverlays(promise: Promise) {
        promise.resolve(Settings.canDrawOverlays(reactApplicationContext))
    }

    @ReactMethod
    fun openOverlaySettings(promise: Promise) {
        try {
            val intent = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                android.net.Uri.parse("package:${reactApplicationContext.packageName}"),
            )
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
            reactApplicationContext.startActivity(intent)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("E_APP_BLOCKER", e)
        }
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
