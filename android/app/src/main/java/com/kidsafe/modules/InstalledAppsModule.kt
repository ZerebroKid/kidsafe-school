package com.kidsafe.modules

import android.content.Context
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.util.Base64
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import java.io.ByteArrayOutputStream

/**
 * Returns the list of user-installed apps on the child device. The JS layer then syncs this list
 * to Firestore (`children/{childUid}/apps/{packageName}`) so the parent can see and block them.
 *
 * Inspired by the original [Application/app/.../AppInstalledReceiver.java] which enumerated apps
 * and pushed them to Firebase Realtime DB directly.
 */
class InstalledAppsModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = NAME

    /**
     * Lists launcher-visible, non-system apps plus a few system apps we deliberately include
     * (browsers, camera, store) since those are what parents typically want to block.
     *
     * Returns an array of `{ packageName, appName, icon? }`. Icons are base64 PNGs but only
     * included if [includeIcons] is true (expensive — only do it on first sync).
     */
    @ReactMethod
    fun list(includeIcons: Boolean, promise: Promise) {
        try {
            val pm = reactApplicationContext.packageManager
            val apps = pm.getInstalledApplications(PackageManager.GET_META_DATA)
            val array: WritableArray = Arguments.createArray()

            for (info in apps) {
                if (!shouldInclude(pm, info)) continue
                val map: WritableMap = Arguments.createMap()
                map.putString("packageName", info.packageName)
                map.putString("appName", pm.getApplicationLabel(info).toString())
                if (includeIcons) {
                    try {
                        val icon = pm.getApplicationIcon(info.packageName)
                        map.putString("icon", drawableToBase64(icon))
                    } catch (_: Exception) {
                        // ignore — still return the app entry without icon
                    }
                }
                array.pushMap(map)
            }
            promise.resolve(array)
        } catch (e: Exception) {
            promise.reject("E_INSTALLED_APPS", e)
        }
    }

    private fun shouldInclude(pm: PackageManager, info: ApplicationInfo): Boolean {
        // Skip KidSafe itself
        if (info.packageName == reactApplicationContext.packageName) return false
        // Non-system apps: always include
        if ((info.flags and ApplicationInfo.FLAG_SYSTEM) == 0) return true
        // System apps that have a launcher icon (i.e. the user actually uses them): include
        return pm.getLaunchIntentForPackage(info.packageName) != null
    }

    private fun drawableToBase64(drawable: Drawable): String {
        val bitmap: Bitmap = if (drawable is BitmapDrawable && drawable.bitmap != null) {
            drawable.bitmap
        } else {
            val w = drawable.intrinsicWidth.coerceAtLeast(1)
            val h = drawable.intrinsicHeight.coerceAtLeast(1)
            Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888).also {
                val canvas = Canvas(it)
                drawable.setBounds(0, 0, canvas.width, canvas.height)
                drawable.draw(canvas)
            }
        }
        val stream = ByteArrayOutputStream()
        // Compress so the base64 payload stays small (< ~5KB per icon)
        Bitmap.createScaledBitmap(bitmap, 96, 96, true)
            .compress(Bitmap.CompressFormat.PNG, 85, stream)
        return "data:image/png;base64," + Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP)
    }

    companion object {
        const val NAME = "InstalledApps"
    }
}
