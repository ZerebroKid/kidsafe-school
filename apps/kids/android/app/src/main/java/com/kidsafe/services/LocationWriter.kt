package com.kidsafe.services

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location as AndroidLocation
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.core.content.ContextCompat
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import com.kidsafe.store.KidSafeStore

/**
 * Native writer for `children/{childUid}.currentLocation` — the live "where is the kid right
 * now" doc that the parent dashboard's [com.kidsafe.parent.LocationTab] map subscribes to.
 *
 * Why native instead of JS:
 *  - On aggressive OEMs (Realme/ColorOS, Infinix XOS, MIUI battery saver, HONOR Memory Turbo)
 *    the RN engine of a backgrounded child app gets suspended within seconds. The JS-side
 *    subscriber in [src/services/childSyncEngine.ts] then stops receiving fused-location
 *    callbacks and the parent map freezes on a stale fix.
 *  - This writer runs inside [KidSafeForegroundService] (declared `foregroundServiceType=
 *    "location|dataSync"`), which OEMs keep alive via the persistent notification +
 *    `START_STICKY` semantics. It owns the location subscription and writes Firestore
 *    directly using the Firebase Android SDK, so the parent map keeps updating even when JS
 *    is dead.
 *
 * Doc shape mirrors `src/firebase/types.ts → Geo`:
 *   { lat, lng, accuracy, updatedAt }
 *
 * Provider selection:
 *  - **Primary**: `FusedLocationProviderClient` (Google Play Services). Fast, battery-aware,
 *    indoor-WiFi-aware. Works on every device that has GMS, which is every Indian-market
 *    OEM (Realme, Xiaomi, Vivo, Oppo, Samsung) except certain Huawei builds.
 *  - **Fallback**: plain Android `LocationManager` (GPS_PROVIDER + NETWORK_PROVIDER). Used
 *    when GMS is missing / out of date / disabled. Slower cold-start and worse indoor
 *    accuracy but always available. Picked at `start()` time via [GoogleApiAvailability].
 *
 * Update strategy (two phase):
 *  - PHASE 1 — "fast first fix" (first ~30s after start): PRIORITY_HIGH_ACCURACY, 15s interval.
 *    Collapses the cold-start-to-first-visible-marker time on the parent dashboard from
 *    1–2 min (the previous BALANCED 60s/50m config) to under 10 s in most cases.
 *  - PHASE 2 — "steady state": PRIORITY_BALANCED_POWER_ACCURACY, 60s interval, 25m
 *    displacement. Cheap enough to sustain for hours; matches the design budget in
 *    `LOCATION_MIN_INTERVAL_MS` in [src/config/env.ts].
 *
 * On `start()` we also call `lastLocation` once for an immediate seed write if the cached fix
 * is recent (< 5 min). That gives the parent something to render before the first fresh fix
 * arrives — important when the child phone was already running another location-aware app.
 *
 * Resilience features (added in the Realme-fix round):
 *  - **First-fix watchdog**: if no fix arrives within [FIRST_FIX_TIMEOUT_MS] of `start()`,
 *    write a `first_fix_timeout` diagnostic so the parent banner explains why the marker
 *    is missing.
 *  - **Play Services fallback**: if [GoogleApiAvailability] reports unavailable / out of date,
 *    silently switch to [LocationManager]. Diagnostic surfaces this so the parent knows.
 *  - **Firestore retry**: failed writes retry with exponential backoff (2s, 5s, 15s) before
 *    surfacing `firestore_write_failing`. `lastWriteAt` only advances on success so a
 *    transient outage doesn't permanently mask subsequent fixes.
 *  - **System-location-off handling**: detected on start + on every fix attempt; surfaces
 *    `system_location_off` so the parent banner can explicitly ask the kid to enable GPS.
 *    The [LocationToggleReceiver] (registered in the manifest) re-invokes `start()` when
 *    the user re-enables location, so recovery is automatic.
 *
 * Write gating:
 *  - No-ops if no `childUid` is cached (engine hasn't started yet, signed-out, etc.).
 *  - No-ops on shared-phone installs while Child Mode is OFF (mirrors [CurrentAppWriter]).
 *  - No-ops while the signed-in Firebase user can't satisfy the `parentOwns(childUid)` rule.
 *  - No more than one write per `MIN_WRITE_INTERVAL_MS` to keep Firestore cost sane.
 *  - At least one write per `HEARTBEAT_REFRESH_MS` so the parent dashboard's stale banner
 *    (5 min in [src/screens/parent/LocationTab.tsx]) doesn't trip while the child is parked.
 */
object LocationWriter {

    private const val TAG = "KidSafe.LocationWriter"

    /**
     * Phase 1 ("fast first fix") config. We stay in this mode until the first
     * `onLocationResult` arrives, then immediately reconfigure to phase 2.
     */
    private const val FAST_INTERVAL_MS = 15_000L
    private const val FAST_MAX_DELAY_MS = 30_000L

    /** Phase 2 ("steady state") config. */
    private const val STEADY_INTERVAL_MS = 60_000L
    private const val STEADY_MAX_DELAY_MS = 120_000L
    private const val STEADY_MIN_DISPLACEMENT_M = 25f

    /** Minimum gap between Firestore writes — protects the free tier from a rogue OEM provider. */
    private const val MIN_WRITE_INTERVAL_MS = 15_000L

    /**
     * Force a write at least this often so the parent dashboard's staleness check (5 min in
     * [LocationTab]) never trips while the child is genuinely on the same spot.
     */
    private const val HEARTBEAT_REFRESH_MS = 90_000L

    /**
     * Maximum age of a cached `lastLocation` fix we'll seed on `start()` with. Older than this
     * and we'd just mislead the parent dashboard; better to wait for a fresh fix.
     */
    private const val LAST_LOCATION_SEED_MAX_AGE_MS = 5L * 60L * 1000L

    /**
     * If the first `onLocationResult` doesn't arrive within this window of `start()`, we write
     * a `first_fix_timeout` diagnostic to Firestore so the parent banner explains the silence.
     * 60s is long enough that a healthy phone never trips it (typical first fix is < 10s) but
     * short enough that the parent doesn't sit staring at an empty map for minutes.
     */
    private const val FIRST_FIX_TIMEOUT_MS = 60_000L

    /** Firestore retry backoff windows. After all three fail we surface a diagnostic. */
    private val FIRESTORE_RETRY_DELAYS_MS = longArrayOf(2_000L, 5_000L, 15_000L)

    /**
     * Plain LocationManager fallback config (used only when Google Play Services is missing).
     * We use the same min interval as the FusedLocationProviderClient phase 2 because the
     * LocationManager API doesn't have a "fast first fix" mode.
     */
    private const val LOCATION_MANAGER_MIN_TIME_MS = 30_000L
    private const val LOCATION_MANAGER_MIN_DISTANCE_M = 25f

    @Volatile
    private var watching = false

    @Volatile
    private var firstFixReceived = false

    @Volatile
    private var lastWriteAt = 0L

    /**
     * Tracks the provider we picked on the last `start()`. Determines which subscription path
     * we use to unsubscribe, and lets us surface `play_services_unavailable` only when we
     * actually fell back.
     */
    private enum class Provider { FUSED, LOCATION_MANAGER }

    @Volatile
    private var activeProvider: Provider = Provider.FUSED

    private var fusedClient: FusedLocationProviderClient? = null
    private var locationManager: LocationManager? = null
    /** First-fix watchdog scheduled via the main looper. Cancelled on stop / on first fix. */
    private var firstFixWatchdog: Runnable? = null
    private val mainHandler = Handler(Looper.getMainLooper())

    private val fusedCallback = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
            val ctx = appContext ?: return
            val last = result.lastLocation
            if (last == null) {
                Log.i(TAG, "onLocationResult with null lastLocation (skipped)")
                return
            }
            handleFix(ctx, last, source = "fix")
        }
    }

    /**
     * Plain-Android-API listener. Used when [GoogleApiAvailability] reports GMS missing/out
     * of date. We register it against both GPS and NETWORK providers so we still get fixes
     * indoors when only WiFi-based NETWORK fixes are available.
     */
    private val locationManagerListener = object : LocationListener {
        override fun onLocationChanged(location: AndroidLocation) {
            val ctx = appContext ?: return
            handleFix(ctx, location, source = "lm_fix")
        }

        // Stubs needed for API < 30. We don't act on provider state changes here; the
        // [LocationToggleReceiver] handles re-attach when the user toggles GPS.
        override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
        override fun onProviderEnabled(provider: String) {
            Log.i(TAG, "LocationManager: provider enabled: $provider")
        }
        override fun onProviderDisabled(provider: String) {
            Log.i(TAG, "LocationManager: provider disabled: $provider")
        }
    }

    @Volatile
    private var appContext: Context? = null

    /**
     * Starts (or refreshes) the location subscription and seeds an immediate write from
     * the cached `lastLocation` if recent. Safe to call multiple times — back-to-back calls
     * are a no-op after the first. Idempotent.
     *
     * Caller is responsible for verifying [Manifest.permission.ACCESS_FINE_LOCATION] before
     * invoking; we re-check defensively so a missing permission produces a clean log line
     * (and a diagnostic record) instead of a SecurityException.
     */
    @SuppressLint("MissingPermission")
    fun start(context: Context) {
        val ctx = context.applicationContext
        appContext = ctx

        if (!hasFineLocationPermission(ctx)) {
            Log.i(TAG, "start skipped — ACCESS_FINE_LOCATION not granted")
            writeDiagnostic(
                ctx,
                ok = false,
                reason = "fine_permission_missing",
                hint = "Location permission is OFF. Open Settings → Apps → KidSafe → Permissions and pick \"Allow all the time\".",
            )
            return
        }
        if (!isLocationServicesEnabled(ctx)) {
            // We still attempt to register; the provider will start delivering as soon as the
            // user toggles location services back on. We also write a diagnostic so the
            // parent banner explains the silence.
            Log.i(TAG, "start: location services are OFF at the system level")
            writeDiagnostic(
                ctx,
                ok = false,
                reason = "system_location_off",
                hint = "GPS / Location is turned off on the phone. Ask your kid to enable it from Settings → Location.",
            )
        }
        if (watching) {
            Log.i(TAG, "start: already watching — refresh seed only")
            seedFromLastLocation(ctx)
            return
        }

        // Pick provider. Fused is preferred; LocationManager is the GMS-less fallback.
        activeProvider = if (isPlayServicesAvailable(ctx)) Provider.FUSED else Provider.LOCATION_MANAGER

        val ok = when (activeProvider) {
            Provider.FUSED -> startFused(ctx)
            Provider.LOCATION_MANAGER -> startLocationManager(ctx)
        }
        if (!ok) {
            // `startFused` / `startLocationManager` already wrote their own diagnostics on
            // failure paths. We just leave `watching = false` so the next ensure call retries.
            return
        }

        watching = true
        firstFixReceived = false
        scheduleFirstFixWatchdog(ctx)
        seedFromLastLocation(ctx)

        // If we successfully started on the FALLBACK provider, surface that explicitly so the
        // parent knows accuracy will be lower. (We don't surface anything here when on
        // FUSED — `ensureLocationWatcher` writes ok=true once the JS side completes.)
        if (activeProvider == Provider.LOCATION_MANAGER) {
            writeDiagnostic(
                ctx,
                ok = false,
                reason = "play_services_unavailable",
                hint = "Google Play Services is missing or outdated on this phone. Location will still update via GPS, but accuracy may be lower.",
            )
        }
    }

    /**
     * Removes the active location subscription. Safe to call when not running.
     */
    fun stop() {
        firstFixWatchdog?.let { mainHandler.removeCallbacks(it) }
        firstFixWatchdog = null
        if (!watching) {
            Log.i(TAG, "stop: not watching, no-op")
            return
        }
        when (activeProvider) {
            Provider.FUSED -> {
                val c = fusedClient
                if (c != null) {
                    try {
                        c.removeLocationUpdates(fusedCallback)
                        Log.i(TAG, "stop: removed FusedLocationProviderClient updates")
                    } catch (e: Exception) {
                        Log.w(TAG, "stop: removeLocationUpdates threw (non-fatal)", e)
                    }
                }
            }
            Provider.LOCATION_MANAGER -> {
                val lm = locationManager
                if (lm != null) {
                    try {
                        lm.removeUpdates(locationManagerListener)
                        Log.i(TAG, "stop: removed LocationManager updates")
                    } catch (e: Exception) {
                        Log.w(TAG, "stop: removeUpdates threw (non-fatal)", e)
                    }
                }
            }
        }
        watching = false
        firstFixReceived = false
        fusedClient = null
        locationManager = null
    }

    /**
     * Called by [LocationToggleReceiver] when the user enables / disables system location.
     * On enable we call `start` (idempotent) so a previously skipped subscription attaches.
     * On disable we deliberately keep the subscription alive — once location flips back on,
     * the existing callbacks resume delivering without an explicit re-attach.
     */
    fun onLocationToggle(context: Context) {
        val ctx = context.applicationContext
        if (!isLocationServicesEnabled(ctx)) {
            Log.i(TAG, "onLocationToggle: services now OFF — keeping subscription alive")
            return
        }
        Log.i(TAG, "onLocationToggle: services now ON — re-attaching writer")
        start(ctx)
    }

    /**
     * Common fix-handling path used by both the fused callback and the LocationManager
     * listener. Logs, swaps to steady-state on first fix, and commits to Firestore.
     */
    private fun handleFix(ctx: Context, last: AndroidLocation, source: String) {
        val ageMs = System.currentTimeMillis() - last.time
        Log.i(
            TAG,
            "$source lat=${last.latitude} lng=${last.longitude} acc=${"%.1f".format(last.accuracy)}m age=${ageMs}ms",
        )
        if (!firstFixReceived) {
            firstFixReceived = true
            firstFixWatchdog?.let { mainHandler.removeCallbacks(it) }
            firstFixWatchdog = null
            if (activeProvider == Provider.FUSED) {
                applySteadyStateRequest(ctx)
            }
        }
        maybeWriteToFirestore(ctx, last.latitude, last.longitude, last.accuracy, last.time, source)
    }

    /** True if Google Play Services is installed, up-to-date, and ENABLED on this device. */
    private fun isPlayServicesAvailable(context: Context): Boolean {
        return try {
            val status = GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(context)
            val ok = status == ConnectionResult.SUCCESS
            if (!ok) Log.i(TAG, "Play Services unavailable (code=$status)")
            ok
        } catch (e: Exception) {
            Log.w(TAG, "isPlayServicesAvailable threw — assuming unavailable", e)
            false
        }
    }

    /** Returns true on successful subscription, false otherwise (already logged). */
    @SuppressLint("MissingPermission")
    private fun startFused(ctx: Context): Boolean {
        val c = try {
            LocationServices.getFusedLocationProviderClient(ctx)
        } catch (e: Exception) {
            Log.w(TAG, "startFused: could not acquire FusedLocationProviderClient", e)
            writeDiagnostic(
                ctx,
                ok = false,
                reason = "play_services_unavailable",
                hint = "Google Play Services is missing or outdated on this phone.",
            )
            return false
        }
        fusedClient = c
        return try {
            c.requestLocationUpdates(buildFastRequest(), fusedCallback, Looper.getMainLooper())
            Log.i(
                TAG,
                "startFused: subscribed fastInterval=${FAST_INTERVAL_MS}ms maxDelay=${FAST_MAX_DELAY_MS}ms priority=HIGH_ACCURACY childUid=${KidSafeStore.getChildUid(ctx)}",
            )
            true
        } catch (e: SecurityException) {
            Log.w(TAG, "startFused: SecurityException — permission likely revoked mid-flight", e)
            false
        } catch (e: Exception) {
            Log.w(TAG, "startFused: requestLocationUpdates threw", e)
            false
        }
    }

    /** Returns true on successful subscription, false otherwise (already logged). */
    @SuppressLint("MissingPermission")
    private fun startLocationManager(ctx: Context): Boolean {
        val lm = try {
            ctx.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
        } catch (e: Exception) {
            Log.w(TAG, "startLocationManager: getSystemService threw", e)
            null
        }
        if (lm == null) {
            Log.w(TAG, "startLocationManager: LocationManager is null on this device")
            return false
        }
        locationManager = lm
        var anyRegistered = false
        val mainLooper = Looper.getMainLooper()
        // Register against both GPS and NETWORK so we get fixes both outdoors (GPS) and
        // indoors-on-WiFi (NETWORK). If either is unavailable on this device or disabled at
        // the system level, the call throws or no-ops and we continue with whichever did
        // register.
        for (provider in listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)) {
            try {
                if (!lm.isProviderEnabled(provider)) {
                    Log.i(TAG, "startLocationManager: $provider is disabled on this device")
                    continue
                }
                lm.requestLocationUpdates(
                    provider,
                    LOCATION_MANAGER_MIN_TIME_MS,
                    LOCATION_MANAGER_MIN_DISTANCE_M,
                    locationManagerListener,
                    mainLooper,
                )
                anyRegistered = true
                Log.i(TAG, "startLocationManager: subscribed to $provider")
            } catch (e: SecurityException) {
                Log.w(TAG, "startLocationManager: SecurityException on $provider", e)
            } catch (e: Exception) {
                Log.w(TAG, "startLocationManager: requestLocationUpdates threw on $provider", e)
            }
        }
        return anyRegistered
    }

    /**
     * Reads `lastLocation` once (Fused only — LocationManager doesn't have a cached
     * equivalent) and, if a usable fix exists, writes it to Firestore so the parent dashboard
     * has something to render before the first fresh callback arrives. No-op if the cached
     * fix is older than [LAST_LOCATION_SEED_MAX_AGE_MS] — better to wait for a fresh fix
     * than to feed the parent a stale marker that they'd think is live.
     */
    @SuppressLint("MissingPermission")
    private fun seedFromLastLocation(context: Context) {
        if (activeProvider != Provider.FUSED) return // LocationManager has no cached fix API
        val c = fusedClient ?: return
        if (!hasFineLocationPermission(context)) return
        try {
            c.lastLocation
                .addOnSuccessListener { loc ->
                    if (loc == null) {
                        Log.i(TAG, "seed: lastLocation null — waiting for first fix")
                        return@addOnSuccessListener
                    }
                    val ageMs = System.currentTimeMillis() - loc.time
                    if (ageMs > LAST_LOCATION_SEED_MAX_AGE_MS) {
                        Log.i(TAG, "seed: lastLocation too old (age=${ageMs}ms) — skipping")
                        return@addOnSuccessListener
                    }
                    Log.i(
                        TAG,
                        "seed: writing cached fix lat=${loc.latitude} lng=${loc.longitude} acc=${"%.1f".format(loc.accuracy)}m age=${ageMs}ms",
                    )
                    maybeWriteToFirestore(context, loc.latitude, loc.longitude, loc.accuracy, loc.time, "seed")
                }
                .addOnFailureListener { e ->
                    Log.w(TAG, "seed: lastLocation call failed (non-fatal)", e)
                }
        } catch (e: SecurityException) {
            Log.w(TAG, "seed: SecurityException on lastLocation — permission revoked?", e)
        }
    }

    /**
     * Reconfigures the active fused subscription to the cheaper steady-state request. Called
     * once after the first fix arrives. If we're somehow not watching by the time this runs
     * (race with `stop()`), we just no-op. LocationManager path uses a single config so this
     * is a no-op when the active provider is `LOCATION_MANAGER`.
     */
    @SuppressLint("MissingPermission")
    private fun applySteadyStateRequest(context: Context) {
        if (activeProvider != Provider.FUSED) return
        val c = fusedClient ?: return
        if (!watching) return
        if (!hasFineLocationPermission(context)) return
        try {
            c.removeLocationUpdates(fusedCallback)
            c.requestLocationUpdates(buildSteadyRequest(), fusedCallback, Looper.getMainLooper())
            Log.i(
                TAG,
                "transitioned to steady state — interval=${STEADY_INTERVAL_MS}ms displacement=${STEADY_MIN_DISPLACEMENT_M}m priority=BALANCED",
            )
        } catch (e: Exception) {
            Log.w(TAG, "applySteadyStateRequest threw — staying in fast-fix mode (non-fatal)", e)
        }
    }

    private fun buildFastRequest(): LocationRequest =
        LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, FAST_INTERVAL_MS)
            .setMaxUpdateDelayMillis(FAST_MAX_DELAY_MS)
            .setWaitForAccurateLocation(false)
            .build()

    private fun buildSteadyRequest(): LocationRequest =
        LocationRequest.Builder(Priority.PRIORITY_BALANCED_POWER_ACCURACY, STEADY_INTERVAL_MS)
            .setMinUpdateDistanceMeters(STEADY_MIN_DISPLACEMENT_M)
            .setMaxUpdateDelayMillis(STEADY_MAX_DELAY_MS)
            .setWaitForAccurateLocation(false)
            .build()

    /**
     * Schedules the first-fix watchdog. Cancels any previously scheduled instance. The
     * watchdog runs ONCE on the main looper after [FIRST_FIX_TIMEOUT_MS], and only acts if
     * `firstFixReceived` is still false (i.e. the system didn't deliver a fix in time).
     */
    private fun scheduleFirstFixWatchdog(ctx: Context) {
        firstFixWatchdog?.let { mainHandler.removeCallbacks(it) }
        val task = Runnable {
            if (!firstFixReceived && watching) {
                Log.w(TAG, "first-fix watchdog: no fix in ${FIRST_FIX_TIMEOUT_MS}ms after start")
                writeDiagnostic(
                    ctx,
                    ok = false,
                    reason = "first_fix_timeout",
                    hint = if (!isLocationServicesEnabled(ctx))
                        "Location services are off. Ask your kid to enable GPS in Settings → Location."
                    else
                        "KidSafe is running but no location fix yet. Ask your kid to step outside or move closer to a window.",
                )
            }
        }
        firstFixWatchdog = task
        mainHandler.postDelayed(task, FIRST_FIX_TIMEOUT_MS)
    }

    /**
     * Applies throttle + heartbeat then commits to Firestore. `source` is a free-form tag used
     * only in log lines so we can distinguish "seed write" (one-shot from lastLocation) from
     * the steady-state "fix write" from a fresh callback.
     */
    private fun maybeWriteToFirestore(
        context: Context,
        lat: Double,
        lng: Double,
        accuracy: Float,
        updatedAt: Long,
        source: String,
    ) {
        val now = System.currentTimeMillis()
        if (!shouldWrite(context)) {
            Log.i(TAG, "write skipped — shouldWrite=false (shared+childModeOff) source=$source")
            return
        }
        val childUid = resolveChildUid(context)
        if (childUid.isNullOrBlank()) {
            Log.i(TAG, "write skipped — no childUid cached source=$source")
            return
        }
        if (!hasMatchingAuth(context, childUid)) {
            Log.i(TAG, "write skipped — Firebase auth doesn't match childUid=$childUid source=$source")
            return
        }

        val sinceLast = now - lastWriteAt
        val heartbeatDue = sinceLast >= HEARTBEAT_REFRESH_MS
        if (sinceLast < MIN_WRITE_INTERVAL_MS && !heartbeatDue) {
            Log.i(
                TAG,
                "write throttled — sinceLast=${sinceLast}ms < ${MIN_WRITE_INTERVAL_MS}ms source=$source",
            )
            return
        }

        val payload = mapOf(
            "lat" to lat,
            "lng" to lng,
            "accuracy" to accuracy.toDouble(),
            // We use the **fix timestamp** as `updatedAt` (not `now`) so the parent dashboard
            // can show "fix age = (server now - updatedAt)" without an extra clock skew step.
            "updatedAt" to updatedAt.toDouble(),
        )
        writeWithRetry(context, childUid, payload, source, attempt = 0)
    }

    /**
     * Recursive Firestore write with [FIRESTORE_RETRY_DELAYS_MS] backoff. We DO NOT advance
     * `lastWriteAt` until the write succeeds — that way a transient outage doesn't make the
     * throttle window suppress subsequent fixes. After exhausting retries we surface a
     * `firestore_write_failing` diagnostic and let the next fix retry afresh.
     */
    private fun writeWithRetry(
        context: Context,
        childUid: String,
        payload: Map<String, Any>,
        source: String,
        attempt: Int,
    ) {
        try {
            FirebaseFirestore.getInstance()
                .collection("children")
                .document(childUid)
                .set(mapOf("currentLocation" to payload), SetOptions.merge())
                .addOnSuccessListener {
                    lastWriteAt = System.currentTimeMillis()
                    Log.i(
                        TAG,
                        "write ok childUid=$childUid attempt=$attempt source=$source",
                    )
                    // First successful write after start → clear any lingering diagnostic
                    // and stamp ok=true so the parent banner clears. The JS engine writes
                    // its own ok=true through `maybeWriteDiagnostics`, but doing it here
                    // too means a JS-suspended phone still clears the banner.
                    if (attempt > 0) {
                        writeDiagnostic(context, ok = true, reason = null, hint = null)
                    }
                }
                .addOnFailureListener { e ->
                    Log.w(TAG, "Firestore currentLocation write FAILED childUid=$childUid attempt=$attempt source=$source", e)
                    if (attempt + 1 < FIRESTORE_RETRY_DELAYS_MS.size) {
                        val delay = FIRESTORE_RETRY_DELAYS_MS[attempt]
                        mainHandler.postDelayed({
                            writeWithRetry(context, childUid, payload, source, attempt + 1)
                        }, delay)
                    } else {
                        writeDiagnostic(
                            context,
                            ok = false,
                            reason = "firestore_write_failing",
                            hint = "KidSafe can't reach Firebase. Check your kid's phone has WiFi or mobile data, then ask them to reopen KidSafe.",
                        )
                    }
                }
        } catch (e: Exception) {
            Log.w(TAG, "Firestore set() threw childUid=$childUid (non-fatal)", e)
        }
    }

    /**
     * Single-source diagnostics writer. Mirrors the shape enforced by `firestore.rules`:
     *   { evaluatedAt: number, ok: boolean, reason?: string, hint?: string }
     *
     * Best-effort: failures are logged at WARN and not retried. The JS-side
     * `maybeWriteDiagnostics` is the primary writer; this is a safety net for cases the JS
     * engine can't catch (system location off when JS isn't running, first-fix timeout in a
     * native-only session, exhausted Firestore retry).
     */
    private fun writeDiagnostic(
        context: Context,
        ok: Boolean,
        reason: String?,
        hint: String?,
    ) {
        if (!shouldWrite(context)) return
        val childUid = resolveChildUid(context)
        if (childUid.isNullOrBlank()) return
        if (!hasMatchingAuth(context, childUid)) return

        val payload = HashMap<String, Any>().apply {
            put("evaluatedAt", System.currentTimeMillis().toDouble())
            put("ok", ok)
            reason?.let { put("reason", it) }
            hint?.let { put("hint", it) }
        }
        try {
            FirebaseFirestore.getInstance()
                .collection("children")
                .document(childUid)
                .set(mapOf("locationDiagnostics" to payload), SetOptions.merge())
                .addOnSuccessListener {
                    Log.i(TAG, "diagnostic written ok=$ok reason=${reason ?: "-"}")
                }
                .addOnFailureListener { e ->
                    Log.w(TAG, "diagnostic write FAILED ok=$ok reason=${reason ?: "-"}", e)
                }
        } catch (e: Exception) {
            Log.w(TAG, "writeDiagnostic threw (non-fatal)", e)
        }
    }

    private fun shouldWrite(context: Context): Boolean {
        val shared = KidSafeStore.isSharedDevice(context)
        if (shared && !KidSafeStore.isChildModeActive(context)) {
            return false
        }
        return true
    }

    /**
     * Same auth-match logic as [CurrentAppWriter.hasMatchingAuth]: two-device installs need the
     * child Firebase user signed in (`authUid == childUid`); shared installs need the parent
     * signed in with `childUid == "${authUid}_shared"`.
     */
    private fun hasMatchingAuth(context: Context, childUid: String): Boolean {
        val authUid = FirebaseAuth.getInstance().currentUser?.uid ?: return false
        if (authUid == childUid) return true
        val shared = KidSafeStore.isSharedDevice(context)
        if (shared && childUid == "${authUid}_shared") return true
        return false
    }

    private fun resolveChildUid(context: Context): String? {
        val cached = KidSafeStore.getChildUid(context)
        if (!cached.isNullOrBlank()) return cached
        val authUid = FirebaseAuth.getInstance().currentUser?.uid ?: return null
        return if (KidSafeStore.isSharedDevice(context)) "${authUid}_shared" else authUid
    }

    private fun hasFineLocationPermission(context: Context): Boolean =
        ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_FINE_LOCATION,
        ) == PackageManager.PERMISSION_GRANTED

    /**
     * Returns true when the system location toggle is on. Distinct from the app permission —
     * even with FINE granted, no fixes arrive when this is off. Logged on start so a "permission
     * granted but parent sees no marker" report is easy to triage from logcat alone.
     */
    private fun isLocationServicesEnabled(context: Context): Boolean {
        val lm = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager ?: return false
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            lm.isLocationEnabled
        } else {
            try {
                lm.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
                    lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
            } catch (_: Exception) {
                false
            }
        }
    }
}
