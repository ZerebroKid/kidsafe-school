package com.kidsafe.modules

import android.annotation.SuppressLint
import android.app.PendingIntent
import android.content.Intent
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.android.gms.location.Geofence
import com.google.android.gms.location.GeofencingRequest
import com.google.android.gms.location.LocationServices
import com.kidsafe.receivers.GeofenceTransitionReceiver
import com.kidsafe.store.KidSafeStore

/**
 * Sets / clears a single geofence around a parent-defined point. The [GeofenceTransitionReceiver]
 * forwards exit events to JS via a device event, which in turn writes an event to Firestore so
 * the parent gets notified.
 */
class GeofenceModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = NAME

    private val client by lazy {
        LocationServices.getGeofencingClient(reactApplicationContext)
    }

    private val pendingIntent by lazy {
        val intent = Intent(reactApplicationContext, GeofenceTransitionReceiver::class.java)
        PendingIntent.getBroadcast(
            reactApplicationContext,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE,
        )
    }

    @SuppressLint("MissingPermission")
    @ReactMethod
    fun setFence(lat: Double, lng: Double, radiusM: Double, promise: Promise) {
        try {
            val geofence = Geofence.Builder()
                .setRequestId(FENCE_ID)
                .setCircularRegion(lat, lng, radiusM.toFloat())
                .setExpirationDuration(Geofence.NEVER_EXPIRE)
                .setTransitionTypes(
                    Geofence.GEOFENCE_TRANSITION_ENTER or Geofence.GEOFENCE_TRANSITION_EXIT,
                )
                .build()

            val request = GeofencingRequest.Builder()
                .setInitialTrigger(GeofencingRequest.INITIAL_TRIGGER_ENTER)
                .addGeofence(geofence)
                .build()

            client.removeGeofences(listOf(FENCE_ID))
                .addOnCompleteListener {
                    client.addGeofences(request, pendingIntent)
                        .addOnSuccessListener {
                            KidSafeStore.setGeofence(
                                reactApplicationContext, lat, lng, radiusM.toFloat(), true,
                            )
                            promise.resolve(true)
                        }
                        .addOnFailureListener { promise.reject("E_GEOFENCE", it) }
                }
        } catch (e: Exception) {
            promise.reject("E_GEOFENCE", e)
        }
    }

    @ReactMethod
    fun clearFence(promise: Promise) {
        try {
            client.removeGeofences(listOf(FENCE_ID))
                .addOnSuccessListener {
                    KidSafeStore.setGeofence(reactApplicationContext, 0.0, 0.0, 0f, false)
                    promise.resolve(true)
                }
                .addOnFailureListener { promise.reject("E_GEOFENCE", it) }
        } catch (e: Exception) {
            promise.reject("E_GEOFENCE", e)
        }
    }

    fun emitTransition(transition: String, lat: Double, lng: Double) {
        val map = Arguments.createMap().apply {
            putString("transition", transition)
            putDouble("lat", lat)
            putDouble("lng", lng)
            putDouble("timestamp", System.currentTimeMillis().toDouble())
        }
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("KidSafeGeofence", map)
    }

    @ReactMethod
    fun addListener(eventName: String) { /* no-op */ }

    @ReactMethod
    fun removeListeners(count: Int) { /* no-op */ }

    companion object {
        const val NAME = "Geofence"
        const val FENCE_ID = "kidsafe_primary_fence"
    }
}
