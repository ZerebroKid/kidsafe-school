package com.kidsafe.security

import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

/**
 * Pure detection logic for "the child is trying to disable / uninstall KidSafe" screens.
 *
 * Lives outside [com.kidsafe.blocker.AppBlockerService] so it can be unit-tested in isolation
 * and easily extended with new OEM activity hints. Every check is conservative — when in doubt
 * we return null so the user isn't gated needlessly on unrelated Settings screens.
 *
 * The contract: [shouldGate] reads cheap fields off [event] / [root] and returns the matching
 * [TamperKind] when the foreground window is one of the KidSafe-targeted Settings pages.
 */
object TamperWatcher {

    /** Categories of tamper attempt — used for telemetry and PIN-screen copy. */
    enum class TamperKind(val telemetryName: String, val displayLabel: String) {
        APP_INFO("app_info", "Uninstall / Force stop"),
        DEVICE_ADMIN("device_admin", "Disable device admin"),
        ACCESSIBILITY("accessibility", "Disable accessibility"),
        BATTERY("battery", "Battery optimization"),
        AUTOSTART("autostart", "Autostart / Background"),
    }

    fun shouldGate(
        event: AccessibilityEvent,
        root: AccessibilityNodeInfo?,
        ourPackage: String,
        ourLabel: String,
    ): TamperKind? {
        val pkg = event.packageName?.toString() ?: return null
        val cls = event.className?.toString() ?: ""

        // Don't gate our own activities (PinGate, BlockedApp, RN main activity).
        if (pkg == ourPackage) return null

        // Device admin add/remove screens — almost always lead to "Deactivate" for KidSafe.
        // The activity class is stable across versions: DeviceAdminAdd / DeviceAdminSettings.
        if (cls.contains("DeviceAdmin", ignoreCase = true)) {
            if (rootMentions(root, ourLabel)) return TamperKind.DEVICE_ADMIN
        }

        // ----- Stock Android Settings ----------------------------------------------------
        if (pkg == "com.android.settings" || pkg == "com.google.android.settings.intelligence") {
            // App info / Uninstall / Force stop / Storage→Clear data — always render the app
            // label as the title and have one of these viewIds.
            if (rootHasResourceId(root, "uninstall_button") ||
                rootHasResourceId(root, "force_stop_button") ||
                rootHasResourceId(root, "clear_storage_button")
            ) {
                if (rootMentions(root, ourLabel)) return TamperKind.APP_INFO
            }

            // Accessibility settings — when the user taps into KidSafe's row, the title
            // becomes the app label. We only block the *individual* service page, not the
            // top-level list, so the user can still configure other accessibility tools.
            if (cls.contains("Accessibility", ignoreCase = true) && rootMentions(root, ourLabel)) {
                return TamperKind.ACCESSIBILITY
            }

            // Battery optimization "Don't optimize / Optimize" picker for KidSafe.
            if (cls.contains("Battery", ignoreCase = true) && rootMentions(root, ourLabel)) {
                return TamperKind.BATTERY
            }
        }

        // ----- OEM-specific guards (best-effort; activity class names change between skins) -----

        // Xiaomi MIUI / HyperOS — Security Center hosts both autostart and battery savers.
        if (pkg == "com.miui.securitycenter" || pkg == "com.miui.powerkeeper") {
            if (rootMentions(root, ourLabel)) {
                return if (cls.contains("Autostart", ignoreCase = true)) {
                    TamperKind.AUTOSTART
                } else {
                    TamperKind.BATTERY
                }
            }
        }

        // Oppo / Realme ColorOS.
        if (pkg == "com.coloros.safecenter" || pkg == "com.oppo.safe") {
            if (rootMentions(root, ourLabel)) return TamperKind.AUTOSTART
        }

        // Vivo / iQOO Funtouch / Origin OS.
        if (pkg == "com.iqoo.secure" || pkg == "com.vivo.permissionmanager") {
            if (rootMentions(root, ourLabel)) return TamperKind.AUTOSTART
        }

        // Samsung One UI device-care / sleeping-apps screen.
        if (pkg == "com.samsung.android.lool" && rootMentions(root, ourLabel)) {
            return TamperKind.BATTERY
        }

        return null
    }

    // -- Helpers -----------------------------------------------------------------------------

    private fun rootHasResourceId(root: AccessibilityNodeInfo?, idSuffix: String): Boolean {
        if (root == null) return false
        return try {
            // findAccessibilityNodeInfosByViewId expects a fully-qualified id, but matching the
            // suffix is more robust across OEMs that namespace differently.
            val candidates = root.findAccessibilityNodeInfosByViewId("com.android.settings:id/$idSuffix")
            candidates?.isNotEmpty() == true || depthFirstAnyId(root, idSuffix)
        } catch (_: Exception) {
            false
        }
    }

    private fun depthFirstAnyId(node: AccessibilityNodeInfo, idSuffix: String, depth: Int = 0): Boolean {
        if (depth > MAX_TREE_DEPTH) return false
        val viewId = node.viewIdResourceName
        if (viewId != null && viewId.endsWith("/$idSuffix")) return true
        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            if (depthFirstAnyId(child, idSuffix, depth + 1)) return true
        }
        return false
    }

    private fun rootMentions(root: AccessibilityNodeInfo?, label: String): Boolean {
        if (root == null || label.isBlank()) return false
        return try {
            // Cheap path: most Settings pages put the app label in the title bar.
            walkText(root, label, depth = 0)
        } catch (_: Exception) {
            false
        }
    }

    private fun walkText(node: AccessibilityNodeInfo, needle: String, depth: Int): Boolean {
        if (depth > MAX_TREE_DEPTH) return false
        val text = node.text?.toString()
        if (text != null && text.contains(needle, ignoreCase = true)) return true
        val desc = node.contentDescription?.toString()
        if (desc != null && desc.contains(needle, ignoreCase = true)) return true
        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            if (walkText(child, needle, depth + 1)) return true
        }
        return false
    }

    private const val MAX_TREE_DEPTH = 12
}
