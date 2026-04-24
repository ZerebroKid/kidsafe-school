package com.kidsafe.receivers

import android.app.admin.DeviceAdminReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.util.Log
import android.widget.Toast
import com.kidsafe.R
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
    }

    override fun onDisableRequested(context: Context, intent: Intent): CharSequence {
        return "Disabling KidSafe device admin will notify your parent and stop parental controls."
    }

    companion object {
        private const val TAG = "KidSafeDeviceAdmin"

        fun componentName(context: Context): ComponentName =
            ComponentName(context.applicationContext, KidSafeDeviceAdminReceiver::class.java)
    }
}
