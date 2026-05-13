package com.kidsafe.security

import android.content.ComponentName
import android.content.Context
import android.provider.Settings
import android.text.TextUtils
import android.util.Log
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.kidsafe.blocker.AppBlockerService
import com.kidsafe.store.KidSafeStore

/**
 * Defence-in-depth for "child turned off our AccessibilityService". Once disabled, our
 * AppBlockerService stops receiving events — so we lose the ability to gate further tamper
 * attempts via accessibility events. The KidSafeForegroundService stays alive in a separate
 * process binding though, and it registers a ContentObserver on
 * `Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES`. When the list changes we route here.
 *
 * Behaviour:
 *  - If the parent's onboarding wizard armed a supervision window, we ignore the change (the
 *    user is legitimately enabling/disabling things during setup).
 *  - If a recent successful PIN entry is still active (gate-bypass), we ignore the change.
 *  - Otherwise, if our service is no longer in the enabled list AND a PIN is set, we:
 *      1. Log a silent `tamper_attempt` event to Firestore so the parent sees it.
 *      2. Pop the PIN gate full-screen, demanding parent intervention before the child can
 *         continue using the device.
 */
object AccessibilityWatchdog {

    private const val TAG = "AccessibilityWatchdog"

    fun onAccessibilityListChanged(ctx: Context) {
        try {
            val ourComponent = ComponentName(ctx, AppBlockerService::class.java)
            val enabled = Settings.Secure.getString(
                ctx.contentResolver,
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES,
            ) ?: ""
            val stillOn = isComponentEnabled(enabled, ourComponent)

            if (stillOn) return

            // Suppression layer 1: legitimate setup is in progress.
            if (KidSafeStore.isUnderSupervision(ctx)) {
                Log.i(TAG, "Accessibility off but under supervision — skipping gate")
                return
            }
            // Suppression layer 2: PIN was just entered (bypass tagged the Settings window).
            // We deliberately key the bypass check on com.android.settings + null cls because
            // the per-window key from the gate's last success will have stored that pkg.
            if (KidSafeStore.isGateBypassed(ctx, "com.android.settings", null)) {
                Log.i(TAG, "Accessibility off but bypass active — skipping gate")
                return
            }

            // Only gate when a PIN actually exists. Without one, the gate would just be a
            // dismissable speedbump, and we don't want to lock the user out of their device on
            // builds that haven't been through onboarding yet.
            if (!KidSafeStore.hasPin(ctx)) {
                Log.i(TAG, "Accessibility off but no PIN configured — skipping gate")
                return
            }

            Log.w(TAG, "Accessibility service was disabled — popping PIN gate")
            logTamperAlert(ctx)
            launchPinGate(ctx)
        } catch (e: Exception) {
            // The observer fires from a system thread; never crash that thread.
            Log.w(TAG, "onAccessibilityListChanged failed (non-fatal)", e)
        }
    }

    /**
     * Parses the colon-separated `ENABLED_ACCESSIBILITY_SERVICES` value and returns true if
     * [target] is in the list. Mirrors what `AppBlockerModule.isAccessibilityEnabled` does.
     */
    private fun isComponentEnabled(setting: String, target: ComponentName): Boolean {
        if (setting.isBlank()) return false
        val splitter = TextUtils.SimpleStringSplitter(':').apply { setString(setting) }
        while (splitter.hasNext()) {
            val entry = splitter.next().trim()
            val parsed = ComponentName.unflattenFromString(entry) ?: continue
            if (parsed == target) return true
        }
        return false
    }

    private fun launchPinGate(ctx: Context) {
        // Reuse the standard PinGate flow. Pass the package as `com.android.settings` so the
        // bypass key after a successful PIN entry covers the Settings window the child is in
        // (preventing an immediate re-fire when they re-enable the service from the same page).
        val intent = PinGateActivity.intent(
            ctx,
            TamperWatcher.TamperKind.ACCESSIBILITY,
            pkg = "com.android.settings",
            cls = null,
        )
        // PinGateActivity.intent() already adds NEW_TASK / CLEAR_TOP / NO_HISTORY flags.
        ctx.startActivity(intent)
    }

    private fun logTamperAlert(ctx: Context) {
        val childUid = KidSafeStore.getChildUid(ctx) ?: return
        try {
            FirebaseFirestore.getInstance()
                .collection("children")
                .document(childUid)
                .collection("events")
                .add(
                    mapOf(
                        "type" to "tamper_attempt",
                        "kind" to "accessibility_disabled",
                        // success=true here means "the tamper actually went through" — the toggle
                        // was already flipped before we got the callback. Differs from the
                        // PIN-gate path where success means "PIN was entered correctly".
                        "success" to true,
                        "timestamp" to System.currentTimeMillis(),
                        "createdAt" to FieldValue.serverTimestamp(),
                    ),
                )
        } catch (_: Exception) {
            // Best-effort. If Firestore is unavailable (offline / signed out), the alert simply
            // isn't recorded — the local gate still pops.
        }
    }
}
