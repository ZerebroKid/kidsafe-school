package com.kidsafe.modules

import android.content.ComponentName
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * OEM-aware deep links into system settings pages.
 *
 * Stock Android exposes coarse intents like `Settings.ACTION_ACCESSIBILITY_SETTINGS` that drop the
 * user at a long unsorted list. OEM skins (MIUI/HyperOS, ColorOS, Funtouch, One UI) add their own
 * activities that land directly on KidSafe's permission page. This module tries the OEM-specific
 * deep link first, falls back to the generic `Settings.ACTION_*`, and finally to the app's own
 * "App info" page so the user is never marooned at a 404.
 *
 * Important: every OEM intent here is undocumented. Activity class names change between OS
 * versions, so each `open*` method takes a *list* of candidates and picks the first one the system
 * accepts.
 */
class OemSettingsModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = NAME

    @ReactMethod
    fun getOem(promise: Promise) {
        promise.resolve(detectOem())
    }

    /** "App info" page for KidSafe. Used so users can tap "⋮ → Allow restricted settings". */
    @ReactMethod
    fun openAppDetailsSettings(promise: Promise) {
        val ok = tryStart(listOf(appDetailsIntent()))
        finish(promise, ok, "openAppDetailsSettings")
    }

    /** Autostart / "Background autostart" / "Startup manager" — Xiaomi/Oppo/Vivo specific. */
    @ReactMethod
    fun openAutostartSettings(promise: Promise) {
        val candidates = mutableListOf<Intent>()
        when (detectOem()) {
            OEM_XIAOMI -> {
                candidates += componentIntent(
                    "com.miui.securitycenter",
                    "com.miui.permcenter.autostart.AutoStartManagementActivity",
                )
                candidates += Intent("miui.intent.action.OP_AUTO_START").apply {
                    addCategory(Intent.CATEGORY_DEFAULT)
                }
            }
            OEM_OPPO -> {
                candidates += componentIntent(
                    "com.coloros.safecenter",
                    "com.coloros.safecenter.permission.startup.StartupAppListActivity",
                )
                candidates += componentIntent(
                    "com.coloros.safecenter",
                    "com.coloros.safecenter.startupapp.StartupAppListActivity",
                )
                candidates += componentIntent(
                    "com.oppo.safe",
                    "com.oppo.safe.permission.startup.StartupAppListActivity",
                )
            }
            OEM_VIVO -> {
                candidates += componentIntent(
                    "com.iqoo.secure",
                    "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity",
                )
                candidates += componentIntent(
                    "com.vivo.permissionmanager",
                    "com.vivo.permissionmanager.activity.BgStartUpManagerActivity",
                )
            }
            OEM_HUAWEI -> {
                candidates += componentIntent(
                    "com.huawei.systemmanager",
                    "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity",
                )
            }
            OEM_SAMSUNG -> {
                // Samsung doesn't expose an "autostart" toggle — battery optimization is the
                // closest equivalent. Skip directly to that.
                candidates += ignoreBatteryOptimizationIntent()
            }
            else -> { /* fall through to generic */ }
        }
        candidates += appDetailsIntent()
        val ok = tryStart(candidates)
        finish(promise, ok, "openAutostartSettings")
    }

    /** Battery optimization exemption — "Unrestricted" / "No restrictions". */
    @ReactMethod
    fun openBatteryUnrestricted(promise: Promise) {
        val candidates = mutableListOf<Intent>()
        when (detectOem()) {
            OEM_XIAOMI -> {
                candidates += componentIntent(
                    "com.miui.powerkeeper",
                    "com.miui.powerkeeper.ui.HiddenAppsConfigActivity",
                )
            }
            OEM_SAMSUNG -> {
                candidates += componentIntent(
                    "com.samsung.android.lool",
                    "com.samsung.android.sm.ui.battery.BatteryActivity",
                )
            }
            else -> { /* fall through to generic */ }
        }
        candidates += ignoreBatteryOptimizationIntent()
        candidates += Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
        candidates += appDetailsIntent()
        val ok = tryStart(candidates)
        finish(promise, ok, "openBatteryUnrestricted")
    }

    /**
     * Xiaomi-only: lands on KidSafe's "Other permissions" page, which is where toggles like
     * "Display pop-up windows while running in the background" and "Show on Lock screen" live.
     */
    @ReactMethod
    fun openMiuiOtherPermissions(promise: Promise) {
        val pkg = reactApplicationContext.packageName
        val candidates = mutableListOf<Intent>()
        candidates += Intent("miui.intent.action.APP_PERM_EDITOR").apply {
            setClassName(
                "com.miui.securitycenter",
                "com.miui.permcenter.permissions.PermissionsEditorActivity",
            )
            putExtra("extra_pkgname", pkg)
        }
        candidates += Intent("miui.intent.action.APP_PERM_EDITOR").apply {
            setClassName(
                "com.miui.securitycenter",
                "com.miui.permcenter.permissions.AppPermissionsEditorActivity",
            )
            putExtra("extra_pkgname", pkg)
        }
        candidates += appDetailsIntent()
        val ok = tryStart(candidates)
        finish(promise, ok, "openMiuiOtherPermissions")
    }

    // -- Helpers --------------------------------------------------------------

    private fun appDetailsIntent(): Intent =
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
            data = Uri.parse("package:${reactApplicationContext.packageName}")
        }

    private fun ignoreBatteryOptimizationIntent(): Intent =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                data = Uri.parse("package:${reactApplicationContext.packageName}")
            }
        } else {
            appDetailsIntent()
        }

    private fun componentIntent(pkg: String, cls: String): Intent =
        Intent().apply { component = ComponentName(pkg, cls) }

    private fun tryStart(intents: List<Intent>): Boolean {
        for (intent in intents) {
            try {
                intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
                reactApplicationContext.startActivity(intent)
                return true
            } catch (e: Exception) {
                Log.d(TAG, "Intent rejected: ${intent.component ?: intent.action} (${e.message})")
            }
        }
        return false
    }

    private fun finish(promise: Promise, ok: Boolean, label: String) {
        if (ok) promise.resolve(null)
        else promise.reject("E_OEM_SETTINGS", "No activity found for $label")
    }

    companion object {
        const val NAME = "OemSettings"
        private const val TAG = "OemSettingsModule"

        const val OEM_XIAOMI = "xiaomi"
        const val OEM_SAMSUNG = "samsung"
        const val OEM_OPPO = "oppo"
        const val OEM_VIVO = "vivo"
        const val OEM_HUAWEI = "huawei"
        const val OEM_GENERIC = "generic"

        fun detectOem(): String {
            val mfr = (Build.MANUFACTURER ?: "").lowercase()
            val brand = (Build.BRAND ?: "").lowercase()
            return when {
                mfr.contains("xiaomi") || brand.contains("xiaomi") ||
                    brand.contains("redmi") || brand.contains("poco") -> OEM_XIAOMI
                mfr.contains("samsung") || brand.contains("samsung") -> OEM_SAMSUNG
                mfr.contains("oppo") || brand.contains("oppo") ||
                    brand.contains("realme") -> OEM_OPPO
                mfr.contains("vivo") || brand.contains("vivo") ||
                    brand.contains("iqoo") -> OEM_VIVO
                mfr.contains("huawei") || brand.contains("huawei") ||
                    brand.contains("honor") -> OEM_HUAWEI
                else -> OEM_GENERIC
            }
        }
    }
}
