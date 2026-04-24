package com.kidsafe.receivers

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.facebook.react.HeadlessJsTaskService
import com.kidsafe.services.PackageSyncHeadlessTaskService

/**
 * Fires when the user installs or uninstalls an app on the child's phone. We hand off to a
 * Headless JS task so the TS layer can write the change to Firestore using the same code path as
 * the normal sync.
 *
 * Reference: original [Application/app/.../AppInstalledReceiver.java] +
 * [Application/app/.../AppRemovedReceiver.java].
 */
class PackageReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        val pkg = intent.data?.schemeSpecificPart ?: return
        // Ignore our own install/updates
        if (pkg == context.packageName) return

        val type = when (action) {
            Intent.ACTION_PACKAGE_ADDED -> "added"
            Intent.ACTION_PACKAGE_REMOVED -> "removed"
            else -> return
        }
        Log.i(TAG, "Package $type: $pkg")

        val service = Intent(context, PackageSyncHeadlessTaskService::class.java).apply {
            putExtra("type", type)
            putExtra("packageName", pkg)
        }
        context.startService(service)
        HeadlessJsTaskService.acquireWakeLockNow(context)
    }

    companion object {
        private const val TAG = "KidSafePackageReceiver"
    }
}
