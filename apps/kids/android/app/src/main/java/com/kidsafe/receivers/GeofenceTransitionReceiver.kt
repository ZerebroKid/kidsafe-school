package com.kidsafe.receivers

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.util.Log
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig
import com.google.android.gms.location.Geofence
import com.google.android.gms.location.GeofencingEvent

/**
 * Receives geofence enter / exit transitions from Google Play Services and hands them to a
 * headless JS task so the JS layer can write the event to Firestore (even if the app is killed).
 */
class GeofenceTransitionReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val event = GeofencingEvent.fromIntent(intent) ?: return
        if (event.hasError()) {
            Log.w(TAG, "Geofence error: ${event.errorCode}")
            return
        }
        val transition = when (event.geofenceTransition) {
            Geofence.GEOFENCE_TRANSITION_ENTER -> "enter"
            Geofence.GEOFENCE_TRANSITION_EXIT -> "exit"
            Geofence.GEOFENCE_TRANSITION_DWELL -> "dwell"
            else -> return
        }
        val loc = event.triggeringLocation
        Log.i(TAG, "Geofence $transition at ${loc?.latitude}, ${loc?.longitude}")

        val extras = Bundle().apply {
            putString("transition", transition)
            putDouble("lat", loc?.latitude ?: 0.0)
            putDouble("lng", loc?.longitude ?: 0.0)
            putLong("timestamp", System.currentTimeMillis())
        }
        val service = Intent(context, GeofenceHeadlessTaskService::class.java)
            .putExtras(extras)
        context.startService(service)
        HeadlessJsTaskService.acquireWakeLockNow(context)
    }

    companion object {
        private const val TAG = "KidSafeGeofenceRx"
    }
}

/** Headless JS bridge for geofence events. */
class GeofenceHeadlessTaskService : HeadlessJsTaskService() {
    override fun getTaskConfig(intent: Intent): HeadlessJsTaskConfig? {
        val extras = intent.extras ?: return null
        return HeadlessJsTaskConfig(
            "GeofenceTransition",
            Arguments.fromBundle(extras),
            60_000L,
            true,
        )
    }
}
