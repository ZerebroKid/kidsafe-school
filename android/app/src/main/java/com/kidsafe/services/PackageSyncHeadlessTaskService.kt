package com.kidsafe.services

import android.content.Intent
import android.os.Bundle
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

/**
 * Lets the native [com.kidsafe.receivers.PackageReceiver] launch a short-lived headless JS task
 * that syncs the install/uninstall event to Firestore. Registered on the JS side under the task
 * name "PackageSync" (see `index.js`).
 */
class PackageSyncHeadlessTaskService : HeadlessJsTaskService() {

    override fun getTaskConfig(intent: Intent): HeadlessJsTaskConfig? {
        val extras: Bundle = intent.extras ?: return null
        return HeadlessJsTaskConfig(
            "PackageSync",
            Arguments.fromBundle(extras),
            // 60s task timeout - ample for a single Firestore write
            60_000L,
            // true = allow in foreground (should never happen, but safe)
            true,
        )
    }
}
