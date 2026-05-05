package com.kidsafe.blocker

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Intent
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import com.kidsafe.security.PinGateActivity
import com.kidsafe.security.TamperWatcher
import com.kidsafe.store.KidSafeStore

/**
 * Watches `TYPE_WINDOW_STATE_CHANGED` events. When a blocked app is foregrounded the service
 * launches [BlockedAppActivity] full-screen, effectively preventing the user from interacting with
 * the blocked app.
 *
 * Compared to the original repo ([Application/app/.../MainForegroundService.java] which polled
 * UsageStatsManager every 500ms) this is event-driven => much lighter on battery and modern-Android
 * friendly. The downside is the user must enable the Accessibility Service in system settings —
 * the onboarding flow walks them through that.
 *
 * Privacy note: we never record screen content. Only the package name of the foregrounded window
 * is inspected. This is documented in the Play Store listing as required by Google's Accessibility
 * policy.
 */
class AppBlockerService : AccessibilityService() {

    override fun onServiceConnected() {
        super.onServiceConnected()
        // Rewrite the service info at runtime. If the system cached a stale copy of the XML that
        // had `packageNames=""`, this forces it back to the "all packages" default (null).
        val info = serviceInfo ?: AccessibilityServiceInfo()
        info.eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
        info.feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC
        info.notificationTimeout = 50
        info.flags = info.flags or
            AccessibilityServiceInfo.DEFAULT or
            AccessibilityServiceInfo.FLAG_INCLUDE_NOT_IMPORTANT_VIEWS or
            AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS
        info.packageNames = null
        serviceInfo = info
        Log.i(TAG, "Accessibility service connected (packageNames=${info.packageNames?.joinToString() ?: "ALL"})")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return
        if (event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return

        val pkg = event.packageName?.toString() ?: return
        if (pkg == packageName) return // ignore our own overlay

        val ctx = applicationContext

        // 1. Tamper-protection gate. If a PIN is set and the user opened a KidSafe-targeted
        //    Settings page (uninstall, device admin disable, accessibility, OEM autostart, ...),
        //    we pop PinGateActivity over the top and force a parent PIN entry. Done first so it
        //    runs even when the schedule isn't active and even when no apps are blocked.
        if (KidSafeStore.hasPin(ctx)) {
            try {
                val kind = TamperWatcher.shouldGate(
                    event,
                    rootInActiveWindow,
                    packageName,
                    getString(com.kidsafe.R.string.app_name),
                )
                if (kind != null) {
                    Log.i(TAG, "Tamper screen detected (kind=$kind, pkg=$pkg) — launching PinGate")
                    startActivity(PinGateActivity.intent(ctx, kind))
                    return
                }
            } catch (e: Exception) {
                // Accessibility tree access can race during window transitions — never break the
                // whole service over it.
                Log.w(TAG, "TamperWatcher failed (non-fatal)", e)
            }
        }

        // System launcher / settings are never blocked — always allow them so the user isn't stuck
        if (pkg.startsWith("com.android.launcher") || pkg == "com.android.systemui") return

        val scheduleActive = KidSafeStore.isScheduleActiveNow(ctx)
        val isBlocked = if (scheduleActive) {
            // Inside the parent's schedule window: deny everything except the allowlist.
            val allowed = KidSafeStore.getScheduleAllowed(ctx)
            val allow = pkg in allowed
            Log.d(TAG, "Foreground change: $pkg (schedule active, allowlist=${allowed.size}, allow=$allow)")
            !allow
        } else {
            val blocked = KidSafeStore.getBlockedPackages(ctx)
            Log.d(TAG, "Foreground change: $pkg (blocklist size=${blocked.size})")
            blocked.contains(pkg)
        }
        if (!isBlocked) return

        Log.i(TAG, "Blocking foreground app: $pkg (scheduleActive=$scheduleActive)")
        try {
            val intent = Intent(applicationContext, BlockedAppActivity::class.java).apply {
                addFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_CLEAR_TOP or
                        Intent.FLAG_ACTIVITY_NO_HISTORY,
                )
                putExtra(BlockedAppActivity.EXTRA_PACKAGE, pkg)
            }
            startActivity(intent)
        } catch (e: Exception) {
            // Some OEM skins (Infinix XOS, MIUI) block background activity starts unless the
            // app has the "Background pop-up" special permission enabled.
            Log.w(TAG, "Failed to launch BlockedAppActivity for $pkg — background-start restricted?", e)
        }
    }

    override fun onInterrupt() { /* no-op */ }

    companion object {
        private const val TAG = "AppBlockerService"
    }
}
