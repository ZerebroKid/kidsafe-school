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
 *
 * Why we match on tree contents instead of activity class names:
 *   MIUI/HyperOS routes nearly every detail page through `com.android.settings.SubSettings`,
 *   so checking `cls.contains("Accessibility")` is unreliable on Redmi. Tree contents (the
 *   `uninstall_button` viewId, the "Use KidSafe" toggle text, "Permit usage access" header,
 *   etc.) are stable across OEMs that derive from AOSP Settings.
 */
object TamperWatcher {

    /** Categories of tamper attempt — used for telemetry and PIN-screen copy. */
    enum class TamperKind(val telemetryName: String, val displayLabel: String) {
        APP_INFO("app_info", "Uninstall / Force stop"),
        DEVICE_ADMIN("device_admin", "Disable device admin"),
        ACCESSIBILITY("accessibility", "Disable accessibility"),
        OVERLAY("overlay", "Disable display over other apps"),
        USAGE_ACCESS("usage_access", "Disable usage access"),
        BATTERY("battery", "Battery optimization"),
        AUTOSTART("autostart", "Autostart / Background"),
    }

    /**
     * @param fallbackText concatenated `event.text` + `event.contentDescription` from the
     *                     [AccessibilityEvent]. Used when [root] is null (race during the very
     *                     first `TYPE_WINDOW_STATE_CHANGED`) so we can still match by app-label
     *                     mention.
     */
    fun shouldGate(
        event: AccessibilityEvent,
        root: AccessibilityNodeInfo?,
        ourPackage: String,
        ourLabel: String,
        fallbackText: String = "",
    ): TamperKind? {
        val pkg = event.packageName?.toString() ?: return null
        val cls = event.className?.toString() ?: ""

        // Don't gate our own activities (PinGate, BlockedApp, RN main activity).
        if (pkg == ourPackage) return null

        val labelInTree = rootMentions(root, ourLabel) ||
            (fallbackText.isNotEmpty() && fallbackText.contains(ourLabel, ignoreCase = true))
        // Hoisted "target is KidSafe" check — accepts label OR package OR fallback text. Used
        // by both the package-installer rules and the device-admin warning dialog rule.
        val targetIsUs = labelInTree ||
            rootHasText(root, ourPackage) ||
            fallbackText.contains(ourPackage, ignoreCase = true)

        // ----- 0. AOSP DeviceAdminAdd activity fast-path -----------------------------------------
        //
        // `com.android.settings.DeviceAdminAdd` is the AOSP standard activity for both adding
        // and deactivating a device admin. The class name is stable enough to gate on its own
        // because the activity ALWAYS targets exactly one admin component (passed via Intent
        // extra). Catches stock Android, ColorOS, OneUI, FuntouchOS where the activity is not
        // wrapped in SubSettings — and on every OEM where it IS wrapped, the tree-text rule
        // below picks up the slack.
        //
        // We deliberately do not require targetIsUs here: false positives mean the parent has
        // to dismiss our gate when managing other admin apps (Find My Device, work profiles),
        // an acceptable trade-off for parental-control hardening.
        if (cls.contains("DeviceAdminAdd", ignoreCase = true)) {
            return TamperKind.DEVICE_ADMIN
        }

        // ----- 1. Package installer "Do you want to uninstall this app?" dialog -----------------
        //
        // This is what fires when the child long-presses the KidSafe icon → Uninstall, or taps
        // "Uninstall" on the App Info page. Different OEMs use different installer packages:
        //   - Stock Android: com.android.packageinstaller / com.google.android.packageinstaller
        //   - Xiaomi:        com.miui.packageinstaller
        //   - Samsung:       com.samsung.android.packageinstaller
        //   - Generic catch: any pkg ending in ".packageinstaller"
        //
        // Two necessary conditions before we gate, intentionally narrow per design choice:
        //   (a) it's specifically an Uninstall flow (not Install), so we don't spuriously gate
        //       legitimate installs of new apps; and
        //   (b) the target is KidSafe — its label or its package name appears anywhere in the
        //       readable tree / event text. On most ROMs this catches the dialog reliably; on
        //       icon-only Redmi dialogs that show neither the label nor the package, the real
        //       defense is the device-admin layer (FinalStep prompts the parent to enable it).
        if (isPackageInstaller(pkg)) {
            // `ok_button` is a stable AOSP viewId on the package installer's confirm dialog.
            // Combined with `isPackageInstaller(pkg) && targetIsUs` it only fires when the
            // installer is about ZKid, so it's a safe extra signal for icon-only OEM dialogs
            // that don't expose the "Uninstall this app" string.
            val isUninstallFlow =
                cls.contains("Uninstall", ignoreCase = true) ||
                    rootHasAnyText(root, listOf("Uninstall this app", "uninstall this app")) ||
                    rootHasAnyResourceId(root, listOf("ok_button"))
            if (isUninstallFlow && targetIsUs) return TamperKind.APP_INFO

            // "Can't uninstall — device admin" warning dialog. Triggered when long-press
            // uninstall hits a device-admin app: Android shows a popup from the package
            // installer telling the user to disable device admin first. Classify as
            // DEVICE_ADMIN (not APP_INFO) so the gate copy reads "Disable device admin",
            // matching what the child is being prompted to do next.
            val mentionsAdmin = rootHasAnyText(
                root,
                listOf("device admin", "device administrator"),
            )
            if (mentionsAdmin && targetIsUs) return TamperKind.DEVICE_ADMIN
        }

        // ----- 2. Stock / MIUI Settings (and Xiaomi Security Center, since some panels live there)
        //
        // Match on tree contents, not activity class. Most rules require the app label to be
        // visible in the tree (so we don't gate the *list* page where many apps are shown — only
        // KidSafe's individual detail page, which is the one with the dangerous toggle).
        if (isSettingsPackage(pkg)) {
            // App info / Force stop / Uninstall / Storage→Clear data — these stable viewIds are
            // what every AOSP-derived Settings ROM uses for the dangerous buttons. We accept
            // EITHER the visible app label OR the package-name string in the tree (targetIsUs):
            // Samsung / Realme / certain MIUI builds render the app-info page with just an icon
            // + `com.kidsafe.kids` and never expose the literal "ZKid" string.
            if (rootHasAnyResourceId(
                    root,
                    listOf("uninstall_button", "force_stop_button", "clear_storage_button"),
                ) && targetIsUs
            ) {
                return TamperKind.APP_INFO
            }

            // Device admin detail page. The body text "Deactivate this device admin app" /
            // "device administrator" is stable AOSP copy that survives the SubSettings wrapper.
            //
            // We deliberately do NOT require labelInTree: on Redmi/MIUI deactivation pages the
            // app label is rendered as an icon + stylised image view, so "KidSafe" never
            // appears as plain text. The deactivation copy itself only shows up on a Device
            // Admin detail page or its confirm dialog — and the page can target only ONE admin
            // at a time — so once we see that copy inside a Settings-style package, gating is
            // safe even if the label/package isn't separately visible. Same trade-off as the
            // DeviceAdminAdd class fast-path above.
            if (rootHasAnyText(
                    root,
                    listOf(
                        "Deactivate this device admin",
                        "Deactivate device admin",
                        "Activate this device admin",
                        "device administrator",
                    ),
                )
            ) {
                return TamperKind.DEVICE_ADMIN
            }

            // Accessibility per-service detail page (and the "Stop using <label>?" / "Turn off
            // <label>?" confirmation dialog the system shows when the child taps the toggle).
            //
            // Multiple signals because none of them are reliable on every OEM:
            //   - "Use <label>" is the toggle subtitle on AOSP-derived ROMs but is localized
            //     away on Hindi / Marathi / etc. MIUI builds.
            //   - The `:id/switch_widget` viewId is stable on AOSP (and MIUI inherits it) and
            //     identifies the per-service Switch.
            //   - "Stop using <label>" / "Turn off <label>" is the system confirmation dialog
            //     shown right when the toggle is flipped — gating this catches the child even
            //     if they slipped past the detail-page detection.
            //   - `cls.contains("Accessibility")` survives on OEMs that didn't wrap the page
            //     in SubSettings.
            val accessibilitySignals = rootHasText(root, "Use $ourLabel") ||
                cls.contains("Accessibility", ignoreCase = true) ||
                rootHasAnyText(root, listOf("Stop using $ourLabel", "Turn off $ourLabel")) ||
                rootHasResourceId(root, "switch_widget")
            if (accessibilitySignals && labelInTree) {
                return TamperKind.ACCESSIBILITY
            }

            // Display-over-other-apps detail page. The toggle subtitle "Allow display over other
            // apps" is stable AOSP copy carried into every OEM Settings I have tested. Gated by
            // labelInTree so we only fire on KidSafe's individual page, not the list.
            if (rootHasAnyText(
                    root,
                    listOf(
                        "Allow display over other apps",
                        "Display over other apps",
                        "Allow displaying over other apps",
                    ),
                ) && labelInTree
            ) {
                return TamperKind.OVERLAY
            }

            // Usage access detail page. The header text "Permit usage access" is stable across
            // AOSP-derived ROMs and MIUI.
            if (rootHasAnyText(
                    root,
                    listOf("Permit usage access", "Allow usage access"),
                ) && labelInTree
            ) {
                return TamperKind.USAGE_ACCESS
            }

            // Battery optimization picker. "Don't optimize" / "Battery optimization" body text
            // appears on the per-app picker but not on unrelated battery list pages.
            if (rootHasAnyText(
                    root,
                    listOf("Don't optimize", "Don\u2019t optimize", "Battery optimization"),
                ) && labelInTree
            ) {
                return TamperKind.BATTERY
            }
        }

        // ----- 3. OEM-specific guards (kept narrow per Fix 4 of the previous round) ------------

        // Xiaomi power-keeper is single-purpose — battery exemption — so any KidSafe-mentioning
        // window inside it really is a tamper attempt.
        if (pkg == "com.miui.powerkeeper" && labelInTree) {
            return TamperKind.BATTERY
        }

        // Xiaomi Security Center hosts many things. Only gate Autostart and the battery /
        // power-keeper screens it shows. The App Info / Device Admin paths above already cover
        // the cases where MIUI hosts those under securitycenter.
        if (pkg == "com.miui.securitycenter" && labelInTree) {
            val isAutostart = cls.contains("Autostart", ignoreCase = true) ||
                cls.contains("AutoStart", ignoreCase = true)
            val isPowerSaver = cls.contains("PowerSaver", ignoreCase = true) ||
                cls.contains("PowerKeeper", ignoreCase = true)
            if (isAutostart) return TamperKind.AUTOSTART
            if (isPowerSaver) return TamperKind.BATTERY
        }

        // Oppo / Realme ColorOS — gate only the autostart-style classes.
        if (pkg == "com.coloros.safecenter" || pkg == "com.oppo.safe") {
            if (labelInTree &&
                (cls.contains("Autostart", ignoreCase = true) ||
                    cls.contains("Startup", ignoreCase = true) ||
                    cls.contains("Background", ignoreCase = true))
            ) {
                return TamperKind.AUTOSTART
            }
        }

        // Vivo / iQOO Funtouch / Origin OS — narrow to autostart / background-running classes.
        if (pkg == "com.iqoo.secure" || pkg == "com.vivo.permissionmanager") {
            if (labelInTree &&
                (cls.contains("Autostart", ignoreCase = true) ||
                    cls.contains("BgStartUp", ignoreCase = true) ||
                    cls.contains("Background", ignoreCase = true))
            ) {
                return TamperKind.AUTOSTART
            }
        }

        // Samsung One UI device-care — only gate the battery / sleeping-apps sub-pages.
        if (pkg == "com.samsung.android.lool" && labelInTree) {
            if (cls.contains("Battery", ignoreCase = true) ||
                cls.contains("Sleeping", ignoreCase = true) ||
                cls.contains("PowerSaving", ignoreCase = true)
            ) {
                return TamperKind.BATTERY
            }
        }

        return null
    }

    private fun isPackageInstaller(pkg: String): Boolean =
        pkg == "com.android.packageinstaller" ||
            pkg == "com.google.android.packageinstaller" ||
            pkg.endsWith(".packageinstaller")

    /**
     * The Settings activity host. AOSP is `com.android.settings`; every major OEM ships its own
     * branded variant that hosts the same dangerous toggles (App info → Uninstall, Device admin,
     * Accessibility detail). Missing any of these means the child can navigate to ZKid's app-info
     * page on that ROM without the PIN gate firing.
     */
    private fun isSettingsPackage(pkg: String): Boolean =
        pkg == "com.android.settings" ||
            pkg == "com.google.android.settings.intelligence" ||
            pkg == "com.miui.securitycenter" ||
            pkg == "com.samsung.android.settings" ||
            pkg == "com.samsung.android.lool" ||
            pkg == "com.coloros.safecenter" ||
            pkg == "com.oppo.safe" ||
            pkg == "com.oplus.safecenter" ||
            pkg == "com.oplus.appcontroldispatcher" ||
            pkg == "com.vivo.permissionmanager" ||
            pkg == "com.vivo.safecenter" ||
            pkg == "com.iqoo.secure" ||
            pkg == "com.transsion.security" ||
            pkg == "com.transsion.phonemanager"

    // -- Helpers -----------------------------------------------------------------------------

    /**
     * Returns true if any descendant of [root] has a viewId whose suffix (after `:id/`) matches
     * [idSuffix]. Suffix-matching is what makes this OEM-portable: MIUI may namespace things as
     * `com.miui.securitycenter:id/uninstall_button` while AOSP uses `com.android.settings:id/...`.
     */
    private fun rootHasResourceId(root: AccessibilityNodeInfo?, idSuffix: String): Boolean {
        if (root == null) return false
        return try {
            val candidates = root.findAccessibilityNodeInfosByViewId("com.android.settings:id/$idSuffix")
            candidates?.isNotEmpty() == true || depthFirstAnyId(root, idSuffix)
        } catch (_: Exception) {
            false
        }
    }

    /** Same as [rootHasResourceId] but accepts a list of suffixes (any match wins). */
    private fun rootHasAnyResourceId(
        root: AccessibilityNodeInfo?,
        idSuffixes: List<String>,
    ): Boolean {
        if (root == null) return false
        for (s in idSuffixes) {
            if (rootHasResourceId(root, s)) return true
        }
        return false
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
            walkText(root, label, depth = 0)
        } catch (_: Exception) {
            false
        }
    }

    /** True if any node text/contentDescription contains [needle] (case-insensitive). */
    private fun rootHasText(root: AccessibilityNodeInfo?, needle: String): Boolean {
        if (root == null || needle.isBlank()) return false
        return try {
            walkText(root, needle, depth = 0)
        } catch (_: Exception) {
            false
        }
    }

    /** True if any of [needles] appears in the tree (case-insensitive substring match). */
    private fun rootHasAnyText(root: AccessibilityNodeInfo?, needles: List<String>): Boolean {
        if (root == null) return false
        for (n in needles) {
            if (n.isNotBlank() && rootHasText(root, n)) return true
        }
        return false
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
