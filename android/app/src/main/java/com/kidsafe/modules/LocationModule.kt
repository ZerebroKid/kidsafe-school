package com.kidsafe.modules

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.LocationManager
import android.os.Build
import android.util.Log
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.android.gms.location.LocationServices
import com.kidsafe.services.LocationWriter

/**
 * JS bridge for the location feature. Two responsibilities:
 *
 *  1. Permission probes (`hasLocationPermission`, `hasBackgroundLocationPermission`) used by
 *     the onboarding wizard and the [src/services/childSyncEngine.ts] AppState recovery hook.
 *  2. Pass-through start/stop for the native [LocationWriter] that lives in
 *     [com.kidsafe.services.KidSafeForegroundService]. Authority for the fused-location
 *     subscription + Firestore writes lives in `LocationWriter`, NOT here — the JS engine's
 *     subscriber is informational only (so the in-process parent dashboard can render a fresh
 *     marker on its own phone in shared-mode debug builds without round-tripping Firestore).
 *
 * Why a one-shot `getCurrent` still lives here: future "Find now" button on the parent UI
 * calls into this module to bypass the steady-state throttle. It is not used by the writer
 * itself.
 */
class LocationModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = NAME

    private val client by lazy {
        LocationServices.getFusedLocationProviderClient(reactApplicationContext)
    }

    @ReactMethod
    fun hasLocationPermission(promise: Promise) {
        val granted = ContextCompat.checkSelfPermission(
            reactApplicationContext,
            Manifest.permission.ACCESS_FINE_LOCATION,
        ) == PackageManager.PERMISSION_GRANTED
        Log.i(TAG, "hasLocationPermission -> $granted")
        promise.resolve(granted)
    }

    /**
     * Background-location grant ("Allow all the time"). Returns `true` on API < 29 because the
     * concept didn't exist yet (a FINE grant covered all cases). Surfaced separately from
     * [hasLocationPermission] because the onboarding wizard collects it as its own step and the
     * engine needs to know whether to expect updates while the app is fully backgrounded —
     * without it, the OEM can suspend the fused-location callback while the screen is off even
     * though the foreground service is alive.
     */
    @ReactMethod
    fun hasBackgroundLocationPermission(promise: Promise) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            Log.i(TAG, "hasBackgroundLocationPermission -> true (pre-API29, covered by FINE)")
            promise.resolve(true)
            return
        }
        val granted = ContextCompat.checkSelfPermission(
            reactApplicationContext,
            Manifest.permission.ACCESS_BACKGROUND_LOCATION,
        ) == PackageManager.PERMISSION_GRANTED
        Log.i(TAG, "hasBackgroundLocationPermission -> $granted")
        promise.resolve(granted)
    }

    /**
     * Reads the system-wide Location / GPS master switch. Distinct from the per-app permission:
     * even with `ACCESS_FINE_LOCATION` granted, no provider will deliver fixes while this is OFF.
     * Used by the onboarding wizard's `locationServicesStep` to block setup until the kid flips
     * the toggle on. We mirror the same check `LocationWriter.isLocationServicesEnabled` runs
     * internally so the wizard's read-back and the writer's runtime gate stay in sync.
     *
     * API >= 28 has `LocationManager.isLocationEnabled` (the toggle exposed in quick-settings).
     * On older devices we fall back to the OR of `GPS_PROVIDER` and `NETWORK_PROVIDER` -- on
     * pre-P phones the user-facing toggle just enables one or both providers, so this is the
     * closest semantic equivalent we can read without `Settings.Secure.LOCATION_MODE`.
     */
    @ReactMethod
    fun isLocationServicesEnabled(promise: Promise) {
        val ctx = reactApplicationContext
        val lm = ctx.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
        val enabled = if (lm == null) {
            false
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            try {
                lm.isLocationEnabled
            } catch (e: Exception) {
                Log.w(TAG, "isLocationServicesEnabled: isLocationEnabled threw, falling back to provider check", e)
                lm.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
                    lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
            }
        } else {
            try {
                lm.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
                    lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
            } catch (e: Exception) {
                Log.w(TAG, "isLocationServicesEnabled: provider check threw", e)
                false
            }
        }
        Log.i(TAG, "isLocationServicesEnabled -> $enabled")
        promise.resolve(enabled)
    }

    /**
     * Asks the native writer to (re)attach the fused-location subscription. Idempotent; safe to
     * call from `childSyncEngine` boot, from the AppState recovery hook, and from the
     * onboarding `locationForegroundStep` "Allow" handler.
     *
     * Resolves `true` after the writer accepts the start request even if no fix has arrived yet
     * — the parent UI's stale banner is responsible for surfacing "permission granted but no
     * fix yet" states.
     */
    @ReactMethod
    fun startWatching(promise: Promise) {
        Log.i(TAG, "startWatching called from JS")
        try {
            LocationWriter.start(reactApplicationContext)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.w(TAG, "startWatching threw", e)
            promise.reject("E_LOCATION", e)
        }
    }

    @ReactMethod
    fun stopWatching(promise: Promise) {
        Log.i(TAG, "stopWatching called from JS")
        try {
            LocationWriter.stop()
            promise.resolve(true)
        } catch (e: Exception) {
            Log.w(TAG, "stopWatching threw", e)
            promise.reject("E_LOCATION", e)
        }
    }

    /**
     * One-shot last-known location query. Bypasses the writer's throttle so it can drive a
     * "Find now" button on the parent dashboard without disrupting steady-state cadence.
     * Returns `null` when nothing is cached (cold phone, GPS off, etc.).
     */
    @SuppressLint("MissingPermission")
    @ReactMethod
    fun getCurrent(promise: Promise) {
        val granted = ContextCompat.checkSelfPermission(
            reactApplicationContext,
            Manifest.permission.ACCESS_FINE_LOCATION,
        ) == PackageManager.PERMISSION_GRANTED
        if (!granted) {
            Log.i(TAG, "getCurrent: FINE permission not granted, resolving null")
            promise.resolve(null)
            return
        }
        try {
            client.lastLocation
                .addOnSuccessListener { loc ->
                    if (loc == null) {
                        Log.i(TAG, "getCurrent: lastLocation null")
                        promise.resolve(null)
                    } else {
                        val map = Arguments.createMap().apply {
                            putDouble("lat", loc.latitude)
                            putDouble("lng", loc.longitude)
                            putDouble("accuracy", loc.accuracy.toDouble())
                            putDouble("updatedAt", loc.time.toDouble())
                        }
                        Log.i(
                            TAG,
                            "getCurrent: returning lat=${loc.latitude} lng=${loc.longitude} age=${System.currentTimeMillis() - loc.time}ms",
                        )
                        promise.resolve(map)
                    }
                }
                .addOnFailureListener { e ->
                    Log.w(TAG, "getCurrent: lastLocation failed", e)
                    promise.reject("E_LOCATION", e)
                }
        } catch (e: Exception) {
            Log.w(TAG, "getCurrent threw", e)
            promise.reject("E_LOCATION", e)
        }
    }

    /**
     * Legacy event-emitter entry points kept for backward compatibility with the JS-side
     * `Location.subscribe(...)` in `src/modules/native.ts`. The native writer now owns the
     * actual data path; nothing in this module emits `KidSafeLocation` anymore. We keep the
     * methods so `NativeEventEmitter` doesn't crash with "Sending ... with no listeners
     * registered" warnings on RN 0.65+.
     */
    @ReactMethod
    fun addListener(eventName: String) { /* no-op */ }

    @ReactMethod
    fun removeListeners(count: Int) { /* no-op */ }

    companion object {
        const val NAME = "KidSafeLocationModule"
        private const val TAG = "KidSafe.Location"
    }
}
