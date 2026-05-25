package com.kidsafe.receivers

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.location.LocationManager
import android.util.Log
import com.kidsafe.services.KidSafeForegroundService
import com.kidsafe.services.LocationWriter
import com.kidsafe.store.KidSafeStore

/**
 * Listens for [LocationManager.PROVIDERS_CHANGED_ACTION] (an implicit broadcast Android fires
 * whenever the system location toggle flips, or any individual provider is enabled/disabled).
 *
 * Why we need this: when the kid turns OFF "Location" at the system level, all our
 * fused-location callbacks go silent. Without this receiver, the next callback only arrives
 * when JS happens to call `ensureLocationWatcher` again — which on a backgrounded child app
 * could be hours later. With this receiver, the moment the kid (or parent) turns location
 * back ON, the writer re-attaches and a fresh fix is on its way to Firestore within seconds.
 *
 * We do NOT call `LocationWriter.start` when location flips OFF — the existing subscription
 * stays alive and silently waits for the system to start delivering fixes again. Calling
 * `stop` would mean we'd have to remember to restart, which is exactly the kind of state
 * machine that broke previous OEMs.
 *
 * Only fires when the FG service is already alive AND the cached role is `child`. We
 * deliberately don't try to start the service from here — that's the FinalStep / onboarding /
 * BootReceiver job, and starting a foreground service from an implicit broadcast on Android 8+
 * is restricted and would crash.
 */
class LocationToggleReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        if (action != LocationManager.PROVIDERS_CHANGED_ACTION) {
            return
        }
        // Sanity gate: only act on child installs. On parent-only phones the FG service
        // doesn't run and we should never touch the location writer.
        val role = KidSafeStore.getRole(context)
        if (role != "child") {
            return
        }
        // Sanity gate: only act when the FG service is alive. If it's not running, this
        // broadcast can't legally start it on Android 8+ (background-start restriction), so
        // re-attaching the writer would happen outside the FG service context — which
        // defeats the whole point. Wait for the engine's AppState recovery to spin up the
        // service first.
        if (!KidSafeForegroundService.isAlive(context)) {
            Log.i(TAG, "PROVIDERS_CHANGED received but FG service not running — skipping re-attach")
            return
        }
        Log.i(TAG, "PROVIDERS_CHANGED received — nudging LocationWriter to re-attach")
        try {
            LocationWriter.onLocationToggle(context)
        } catch (e: Exception) {
            Log.w(TAG, "LocationWriter.onLocationToggle threw (non-fatal)", e)
        }
    }

    companion object {
        private const val TAG = "KidSafe.LocToggleRecv"
    }
}
