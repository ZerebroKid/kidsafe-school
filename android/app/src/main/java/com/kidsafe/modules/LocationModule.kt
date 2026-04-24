package com.kidsafe.modules

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.os.Looper
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority

/**
 * Emits device location updates to JS via the `KidSafeLocation` event. The JS layer throttles and
 * writes to Firestore (`children/{childUid}.currentLocation`) — see `src/firebase/location.ts`.
 *
 * Updates are configured with a 60s interval and 50m smallest-displacement to keep Firestore write
 * cost sane at 1000+ users (see plan §scaling).
 */
class LocationModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = NAME

    private val client by lazy {
        LocationServices.getFusedLocationProviderClient(reactApplicationContext)
    }

    private val callback = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
            val last = result.lastLocation ?: return
            val map = Arguments.createMap().apply {
                putDouble("lat", last.latitude)
                putDouble("lng", last.longitude)
                putDouble("accuracy", last.accuracy.toDouble())
                putDouble("updatedAt", last.time.toDouble())
            }
            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("KidSafeLocation", map)
        }
    }

    private var watching = false

    @ReactMethod
    fun hasLocationPermission(promise: Promise) {
        val fine = ContextCompat.checkSelfPermission(
            reactApplicationContext,
            Manifest.permission.ACCESS_FINE_LOCATION,
        ) == PackageManager.PERMISSION_GRANTED
        promise.resolve(fine)
    }

    @SuppressLint("MissingPermission")
    @ReactMethod
    fun startWatching(promise: Promise) {
        try {
            if (watching) {
                promise.resolve(true)
                return
            }
            val request = LocationRequest.Builder(Priority.PRIORITY_BALANCED_POWER_ACCURACY, 60_000L)
                .setMinUpdateDistanceMeters(50f)
                .setWaitForAccurateLocation(false)
                .setMaxUpdateDelayMillis(120_000L)
                .build()
            client.requestLocationUpdates(request, callback, Looper.getMainLooper())
            watching = true
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("E_LOCATION", e)
        }
    }

    @ReactMethod
    fun stopWatching(promise: Promise) {
        try {
            client.removeLocationUpdates(callback)
            watching = false
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("E_LOCATION", e)
        }
    }

    @SuppressLint("MissingPermission")
    @ReactMethod
    fun getCurrent(promise: Promise) {
        try {
            client.lastLocation
                .addOnSuccessListener { loc ->
                    if (loc == null) {
                        promise.resolve(null)
                    } else {
                        val map = Arguments.createMap().apply {
                            putDouble("lat", loc.latitude)
                            putDouble("lng", loc.longitude)
                            putDouble("accuracy", loc.accuracy.toDouble())
                            putDouble("updatedAt", loc.time.toDouble())
                        }
                        promise.resolve(map)
                    }
                }
                .addOnFailureListener { promise.reject("E_LOCATION", it) }
        } catch (e: Exception) {
            promise.reject("E_LOCATION", e)
        }
    }

    // Required for NativeEventEmitter on RN 0.65+
    @ReactMethod
    fun addListener(eventName: String) { /* no-op */ }

    @ReactMethod
    fun removeListeners(count: Int) { /* no-op */ }

    companion object {
        const val NAME = "KidSafeLocationModule"
    }
}
