package com.kidsafe.blocker

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.kidsafe.BuildConfig
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
        val cls = event.className?.toString()
        val eventTime = event.eventTime
        if (pkg == packageName) return // ignore our own overlay

        val ctx = applicationContext
        val sharedInactive = KidSafeStore.isSharedDevice(ctx) && !KidSafeStore.isChildModeActive(ctx)
        if (BuildConfig.DEBUG) {
            Log.d(
                TAG,
                "fg_event pkg=$pkg cls=$cls eventTime=$eventTime sharedInactive=$sharedInactive",
            )
        }

        // Tell JS about the new foreground app so the parent dashboard can show a live pill.
        // SystemUI windows (notification shade, status bar, etc.) are transient and would just
        // make the pill flicker, so drop them here. Launcher packages ARE forwarded — the pill
        // component maps them to a friendly "Home screen" label.
        //
        // On a shared phone with Child Mode OFF, the parent is using their OWN device — we
        // would be tracking the parent's foreground app, which is both privacy-invasive and
        // pointless for the dashboard. Suppress the emit in that case.
        if (pkg != "com.android.systemui" && !sharedInactive) {
            emitForegroundApp(pkg)
        } else if (BuildConfig.DEBUG) {
            val reason = when {
                pkg == "com.android.systemui" -> "systemui_filtered"
                sharedInactive -> "shared_inactive"
                else -> "unknown"
            }
            Log.d(TAG, "fg_emit_skipped reason=$reason pkg=$pkg cls=$cls")
        }

        // 1. Tamper-protection gate. If a PIN is set and the user opened a KidSafe-targeted
        //    Settings page (uninstall, device admin disable, accessibility, OEM autostart, ...),
        //    we pop PinGateActivity over the top and force a parent PIN entry. Done first so it
        //    runs even when the schedule isn't active and even when no apps are blocked.
        if (KidSafeStore.hasPin(ctx)) {
            // Suppression layer 1: the parent's onboarding wizard explicitly armed a supervision
            // window. They are intentionally walking through Settings — don't gate them.
            if (KidSafeStore.isUnderSupervision(ctx)) {
                // Skip tamper checks entirely; fall through to normal app-blocking logic.
            } else {
                // Suppression layer 2: PinGateActivity just cleared this exact window. The
                // Settings activity is about to resume and re-fire TYPE_WINDOW_STATE_CHANGED;
                // re-launching the gate would create the loop the user reported.
                if (KidSafeStore.isGateBypassed(ctx, pkg, cls)) {
                    // Bypass active — fall through to normal blocking logic without re-gating.
                } else {
                    val handled = tryTamperGate(event, pkg, cls, retry = true)
                    if (handled) return
                }
            }
        }

        // Shared-phone short-circuit. On a shared install where Child Mode is OFF, the phone
        // belongs to the PARENT — we must not block anything they open. Tamper detection above
        // still runs so accessibility/admin tamper from a curious child remains PIN-gated even
        // when Child Mode hasn't been started yet. Two-device installs never trip this branch
        // because `DEVICE_MODE` is never set to "shared" on those.
        if (sharedInactive) return

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

    /**
     * Runs [TamperWatcher] against the current accessibility tree and, if it matches, launches
     * the PIN gate. Returns true when the gate fired (caller should `return` to skip the
     * normal app-blocking logic for this event).
     *
     * If `rootInActiveWindow` is null on the very first `TYPE_WINDOW_STATE_CHANGED` (a known
     * race — Android builds the tree lazily), and [retry] is true, we re-post ourselves on the
     * main thread after a short delay so we can read the populated tree on the second pass. We
     * always pass an [eventFallbackText] derived from `event.text` + `event.contentDescription`
     * so detection can still match by app-label mention even when the tree is unavailable.
     */
    private fun tryTamperGate(
        event: AccessibilityEvent,
        pkg: String,
        cls: String?,
        retry: Boolean,
    ): Boolean {
        val ctx = applicationContext
        return try {
            val root = rootInActiveWindow
            val fallback = eventFallbackText(event)
            val kind = TamperWatcher.shouldGate(
                event,
                root,
                packageName,
                getString(com.kidsafe.R.string.app_name),
                fallback,
            )
            if (kind != null) {
                Log.i(TAG, "Tamper screen detected (kind=$kind, pkg=$pkg, cls=$cls) — launching PinGate")
                startActivity(PinGateActivity.intent(ctx, kind, pkg, cls))
                true
            } else if (root == null && retry && shouldRetry(pkg, fallback)) {
                // Tree wasn't ready yet but the event looks suspicious. Try once more after a
                // short delay; by then the system has usually populated the tree. The retry is
                // fire-and-forget — if it matches it launches the gate, otherwise it no-ops.
                mainHandler.postDelayed({
                    if (KidSafeStore.isUnderSupervision(ctx)) return@postDelayed
                    if (KidSafeStore.isGateBypassed(ctx, pkg, cls)) return@postDelayed
                    tryTamperGate(event, pkg, cls, retry = false)
                }, RETRY_DELAY_MS)
                false
            } else {
                false
            }
        } catch (e: Exception) {
            // Accessibility tree access can race during window transitions — never break the
            // whole service over it.
            Log.w(TAG, "TamperWatcher failed (non-fatal)", e)
            false
        }
    }

    /**
     * Decides whether a null-root event is worth retrying. We retry when either the package
     * looks like one of our suspect set OR the event's own text already mentions our label —
     * both cheap to check and avoid retrying for every random window transition.
     */
    private fun shouldRetry(pkg: String, fallback: String): Boolean {
        val ourLabel = getString(com.kidsafe.R.string.app_name)
        if (fallback.contains(ourLabel, ignoreCase = true)) return true
        return pkg == "com.android.settings" ||
            pkg == "com.miui.securitycenter" ||
            pkg == "com.miui.powerkeeper" ||
            pkg == "com.android.packageinstaller" ||
            pkg == "com.google.android.packageinstaller" ||
            pkg.endsWith(".packageinstaller")
    }

    /**
     * Concatenates the event's `text` list and `contentDescription`. Some Android builds
     * populate these synchronously even when the accessibility tree itself isn't ready yet,
     * giving us a last-chance signal to recognise a tamper screen.
     */
    private fun eventFallbackText(event: AccessibilityEvent): String {
        val parts = mutableListOf<String>()
        try {
            event.text?.forEach { it?.toString()?.let(parts::add) }
        } catch (_: Exception) { /* tree may be detached; ignore */ }
        try {
            event.contentDescription?.toString()?.let(parts::add)
        } catch (_: Exception) { /* ignore */ }
        return parts.joinToString(" ")
    }

    /**
     * Emits a `KidSafeForegroundApp` device event so [com.kidsafe.modules.AppBlockerModule]'s
     * JS subscribers (currently `childSyncEngine.ts`) can write the current foreground app to
     * Firestore for the parent dashboard's live pill.
     *
     * We grab the React context through [ReactApplication] (new arch first, legacy fallback).
     * If the JS engine hasn't booted yet — possible right after a fresh process start — we
     * silently drop the event; the next `TYPE_WINDOW_STATE_CHANGED` will retry, and the JS
     * side also asks for the current value on startup via Firestore's snapshot.
     */
    private fun emitForegroundApp(pkg: String) {
        try {
            val app = applicationContext as? ReactApplication ?: run {
                if (BuildConfig.DEBUG) {
                    Log.d(TAG, "fg_emit_drop reason=no_react_application pkg=$pkg")
                }
                return
            }
            val reactContext = app.reactHost?.currentReactContext
                ?: @Suppress("DEPRECATION") app.reactNativeHost.reactInstanceManager.currentReactContext
                ?: run {
                    if (BuildConfig.DEBUG) {
                        Log.d(TAG, "fg_emit_drop reason=no_react_context pkg=$pkg")
                    }
                    return
                }
            val map = Arguments.createMap().apply {
                putString("packageName", pkg)
                putDouble("timestamp", System.currentTimeMillis().toDouble())
            }
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("KidSafeForegroundApp", map)
        } catch (e: Exception) {
            // Never let a pill-emit failure tear down the accessibility service.
            Log.w(TAG, "emitForegroundApp failed (non-fatal)", e)
        }
    }

    private val mainHandler by lazy { Handler(Looper.getMainLooper()) }

    companion object {
        private const val TAG = "AppBlockerService"
        private const val RETRY_DELAY_MS = 150L
    }
}
