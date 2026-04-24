package com.kidsafe.blocker

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Intent
import android.util.Log
import android.view.accessibility.AccessibilityEvent
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

        // System launcher / settings are never blocked — always allow them so the user isn't stuck
        if (pkg.startsWith("com.android.launcher") || pkg == "com.android.systemui") return

        val blocked = KidSafeStore.getBlockedPackages(applicationContext)
        // Visible at default logcat level so we can confirm events are actually arriving.
        Log.d(TAG, "Foreground change: $pkg (blocklist size=${blocked.size})")
        if (!blocked.contains(pkg)) return

        Log.i(TAG, "Blocking foreground app: $pkg")
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
