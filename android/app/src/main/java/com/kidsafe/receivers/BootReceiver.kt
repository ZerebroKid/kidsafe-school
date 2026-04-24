package com.kidsafe.receivers

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.kidsafe.services.KidSafeForegroundService
import com.kidsafe.store.KidSafeStore

/**
 * Restarts the foreground service after a reboot so parental monitoring resumes without the child
 * needing to open the app. We only bother if the current role cached in [KidSafeStore] is "child"
 * — parents don't run the service.
 *
 * Ported from [Application/app/.../BootCompleteReceiver.java] but updated for Android 14's
 * `foregroundServiceType` and the removed implicit start-from-background restriction.
 */
class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        if (action != Intent.ACTION_BOOT_COMPLETED && action != "android.intent.action.QUICKBOOT_POWERON") {
            return
        }
        val role = KidSafeStore.getRole(context) ?: return
        if (role != "child") return
        Log.i(TAG, "Boot completed — restarting KidSafe foreground service")
        KidSafeForegroundService.start(context)
    }

    companion object {
        private const val TAG = "KidSafeBootReceiver"
    }
}
