package com.kidsafe.receivers

import android.app.admin.DeviceAdminReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.util.Log
import android.widget.Toast
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.kidsafe.kids.R
import com.kidsafe.security.PinGateActivity
import com.kidsafe.security.TamperWatcher
import com.kidsafe.store.KidSafeStore

/**
 * Invoked by the system when the user activates / deactivates device-admin rights for KidSafe.
 * The React Native side listens to [KidSafeStore.DEVICE_ADMIN_ACTIVE] and syncs the flag to
 * Firestore so the parent can detect uninstall attempts (deactivating admin is the only way to
 * uninstall the app once admin is enabled).
 *
 * Ported from the original Java [Application/app/.../AdminReceiver.java].
 */
class KidSafeDeviceAdminReceiver : DeviceAdminReceiver() {

    override fun onEnabled(context: Context, intent: Intent) {
        super.onEnabled(context, intent)
        Log.i(TAG, "Device admin enabled")
        Toast.makeText(context, R.string.device_admin_enabled, Toast.LENGTH_SHORT).show()
        KidSafeStore.setDeviceAdminActive(context, true)
    }

    override fun onDisabled(context: Context, intent: Intent) {
        super.onDisabled(context, intent)
        Log.i(TAG, "Device admin disabled")
        Toast.makeText(context, R.string.device_admin_disabled, Toast.LENGTH_SHORT).show()
        KidSafeStore.setDeviceAdminActive(context, false)

        // Post-tamper alert. By the time we get this callback the user already passed (or
        // bypassed) the accessibility-based gate, so the deactivation is already done. We:
        //   1. Log a `tamper_attempt` Firestore event so the parent sees a record.
        //   2. Re-pop the PIN gate as a deterrent. If the child was about to long-press →
        //      Uninstall after this, they hit the gate first.
        // Suppress when the parent's onboarding wizard is running or a recent successful PIN
        // entry has just bypassed the Settings window — those are legitimate flows.
        logTamperAlert(context)
        if (KidSafeStore.hasPin(context) &&
            !KidSafeStore.isUnderSupervision(context) &&
            !KidSafeStore.isGateBypassed(context, "com.android.settings", null)
        ) {
            try {
                context.startActivity(
                    PinGateActivity.intent(
                        context,
                        TamperWatcher.TamperKind.DEVICE_ADMIN,
                        pkg = "com.android.settings",
                        cls = null,
                    ),
                )
            } catch (_: Exception) {
                // Some OEM skins forbid background-start of activities. The Firestore alert
                // still gives the parent visibility, so we treat the gate as best-effort.
            }
        }
    }

    override fun onDisableRequested(context: Context, intent: Intent): CharSequence {
        return "Disabling KidSafe device admin will notify your parent and stop parental controls."
    }

    /**
     * Mirrors the schema used by `AccessibilityWatchdog.logTamperAlert` and `PinGateActivity`'s
     * tamper logger so the parent sees every tamper kind in one Firestore feed.
     */
    private fun logTamperAlert(context: Context) {
        val childUid = KidSafeStore.getChildUid(context) ?: return
        try {
            FirebaseFirestore.getInstance()
                .collection("children")
                .document(childUid)
                .collection("events")
                .add(
                    mapOf(
                        "type" to "tamper_attempt",
                        "kind" to "device_admin_disabled",
                        // success=true means "the tamper actually went through" — the receiver
                        // only fires after the user confirms deactivation in Settings.
                        "success" to true,
                        "timestamp" to System.currentTimeMillis(),
                        "createdAt" to FieldValue.serverTimestamp(),
                    ),
                )
        } catch (_: Exception) {
            // Best-effort. Offline / signed out → no record, but local PIN gate still pops.
        }
    }

    companion object {
        private const val TAG = "KidSafeDeviceAdmin"

        fun componentName(context: Context): ComponentName =
            ComponentName(context.applicationContext, KidSafeDeviceAdminReceiver::class.java)
    }
}
