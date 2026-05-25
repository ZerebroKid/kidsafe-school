package com.kidsafe.services

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.database.ContentObserver
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import android.util.Log
import androidx.core.app.NotificationCompat
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.kidsafe.MainActivity
import com.kidsafe.R
import com.kidsafe.modules.ScreenTimeModule
import com.kidsafe.security.AccessibilityWatchdog
import com.kidsafe.store.KidSafeStore

/**
 * Keeps the child process warm so that our Accessibility Service, FCM push handling and location
 * writes remain responsive. On Android 14 we MUST declare a `foregroundServiceType` that matches
 * the actual work done (location + dataSync). Ported loosely from
 * [Application/app/.../MainForegroundService.java] but slimmer — the heavy work
 * (location polling, monitoring, Firestore writes) is done by dedicated modules / services.
 */
class KidSafeForegroundService : Service() {

    /**
     * Watches `Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES` so we can react the moment the
     * child disables our AppBlockerService. By living in this foreground process (separate from
     * the AccessibilityService process), the observer survives even when accessibility is
     * turned off — which is exactly when we need it most.
     */
    private var accessibilityObserver: ContentObserver? = null

    /**
     * Periodic "nag" check on top of the ContentObserver. The observer only fires when the
     * setting *changes*; if the child manages to disable accessibility through a code path
     * that doesn't immediately trigger an observer callback (e.g. some MIUI builds), or if
     * they dismiss the PIN gate and stay on the home screen, the observer goes quiet.
     *
     * The nag runnable re-invokes [AccessibilityWatchdog.onAccessibilityListChanged] every
     * [NAG_INTERVAL_MS]. The watchdog is idempotent — it short-circuits when accessibility
     * is enabled, when supervision is armed, when the gate bypass is active, or when no PIN
     * is set. So this is essentially free in steady state but pops the gate continuously
     * while the service is off.
     */
    private var nagHandler: Handler? = null
    private val nagRunnable = object : Runnable {
        override fun run() {
            try {
                AccessibilityWatchdog.onAccessibilityListChanged(applicationContext)
            } catch (_: Exception) {
                // Watchdog already swallows its own errors; defensive belt-and-braces here.
            }
            nagHandler?.postDelayed(this, NAG_INTERVAL_MS)
        }
    }

    /**
     * Listens for screen on/off so JS can flip the parent dashboard's "currently using" pill
     * to "Phone idle" the moment the kid locks the device — without waiting for the
     * accessibility service to emit the next foreground change. We live in the foreground
     * service (separate from the accessibility service process) so the receiver survives
     * even when the user has turned accessibility off.
     */
    private var screenReceiver: BroadcastReceiver? = null

    /**
     * Native-driven "currently using" pill resolver. On aggressive OEMs (Infinix XOS, MIUI
     * battery saver, HONOR Memory Turbo) the RN engine of a backgrounded child app gets
     * suspended within seconds. Accessibility events still fire but JS isn't listening, so the
     * pill freezes on whatever the last write was (usually the launcher).
     *
     * Polling `UsageStatsManager.queryEvents` from this always-alive foreground service gives us
     * a JS-independent source of truth for the foreground package. 1.5s is a sweet spot — fast
     * enough to feel "live", cheap enough that we can sustain it for hours without measurable
     * battery cost (UsageStats queries are O(events-in-window) and the window is ~4s wide).
     */
    private var foregroundTicker: Handler? = null
    private val foregroundTickerRunnable = object : Runnable {
        override fun run() {
            try {
                pollForegroundApp()
            } catch (e: Exception) {
                Log.w(TAG, "pollForegroundApp threw (non-fatal)", e)
            }
            foregroundTicker?.postDelayed(this, FG_POLL_INTERVAL_MS)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        registerAccessibilityObserver()
        registerScreenReceiver()
        nagHandler = Handler(Looper.getMainLooper()).also {
            it.postDelayed(nagRunnable, NAG_INTERVAL_MS)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        createChannelIfNeeded()
        val notification = buildNotification()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION or
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC,
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
        // (Re)start the foreground ticker on every onStartCommand. The OEM can re-deliver the
        // start intent after killing us (`START_STICKY` semantics) — without this we'd resume
        // the service shell but stop emitting pill updates.
        restartForegroundTicker()
        // (Re)attach the native location writer. `LocationWriter.start` is idempotent and
        // permission-aware — a missing FINE grant produces a clean log line instead of a crash,
        // and JS calls `ForegroundService.start` again post-onboarding so the writer attaches
        // the moment permission is granted.
        try {
            LocationWriter.start(applicationContext)
        } catch (e: Exception) {
            Log.w(TAG, "LocationWriter.start threw (non-fatal)", e)
        }
        return START_STICKY
    }

    override fun onDestroy() {
        nagHandler?.removeCallbacks(nagRunnable)
        nagHandler = null
        foregroundTicker?.removeCallbacks(foregroundTickerRunnable)
        foregroundTicker = null
        accessibilityObserver?.let { contentResolver.unregisterContentObserver(it) }
        accessibilityObserver = null
        screenReceiver?.let {
            try {
                unregisterReceiver(it)
            } catch (_: Exception) {
                // Receiver might already be detached if onCreate failed mid-register; safe to ignore.
            }
        }
        screenReceiver = null
        try {
            LocationWriter.stop()
        } catch (e: Exception) {
            Log.w(TAG, "LocationWriter.stop threw (non-fatal)", e)
        }
        super.onDestroy()
    }

    private fun restartForegroundTicker() {
        foregroundTicker?.removeCallbacks(foregroundTickerRunnable)
        // Run the resolver on the main looper so Firebase callbacks (which prefer the main
        // thread by default) stay on the same handler the rest of the service uses.
        foregroundTicker = Handler(Looper.getMainLooper()).also {
            // Fire once immediately so the pill reflects "right now" the moment the service
            // (re)starts; otherwise the parent would wait up to FG_POLL_INTERVAL_MS for the
            // first write after a reboot or service kill-restart.
            it.post(foregroundTickerRunnable)
        }
    }

    private fun registerScreenReceiver() {
        if (screenReceiver != null) return
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                val state = when (intent.action) {
                    Intent.ACTION_SCREEN_OFF -> "screen_off"
                    Intent.ACTION_USER_PRESENT -> "foreground"
                    // ACTION_SCREEN_ON fires before unlock, so we treat it as still-locked. The
                    // pill will only flip back to "foreground" once ACTION_USER_PRESENT confirms
                    // the user has actually dismissed the keyguard.
                    else -> return
                }
                // Native write FIRST so the pill flips even when the JS engine is suspended.
                // Then emit the JS event for any in-process listeners (parent dashboard running
                // in the same install, debug builds, etc.).
                if (state == "screen_off") {
                    try {
                        CurrentAppWriter.writeNonForeground(
                            context.applicationContext,
                            "screen_off",
                            "screen_off",
                        )
                    } catch (e: Exception) {
                        Log.w(TAG, "CurrentAppWriter.screen_off failed (non-fatal)", e)
                    }
                } else if (state == "foreground") {
                    // On unlock, immediately re-poll UsageStats so the pill resolves the actual
                    // top app instead of staying on "Phone idle" until the next ticker tick.
                    foregroundTicker?.post(foregroundTickerRunnable)
                }
                emitScreenState(state)
            }
        }
        try {
            val filter = IntentFilter().apply {
                addAction(Intent.ACTION_SCREEN_OFF)
                addAction(Intent.ACTION_USER_PRESENT)
            }
            // RECEIVER_NOT_EXPORTED is the safer choice on Android 14+ since these are system
            // broadcasts and we don't want third-party apps spoofing them in our process.
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
            } else {
                @Suppress("UnspecifiedRegisterReceiverFlag")
                registerReceiver(receiver, filter)
            }
            screenReceiver = receiver
        } catch (e: Exception) {
            Log.w(TAG, "Failed to register screen state receiver (non-fatal)", e)
        }
    }

    /**
     * Bridges screen on/off events to JS via a device event. Mirrors [AppBlockerService]'s
     * `KidSafeForegroundApp` emit — same null-safety dance with new arch + legacy fallbacks.
     */
    private fun emitScreenState(state: String) {
        try {
            val app = applicationContext as? ReactApplication ?: return
            val reactContext = app.reactHost?.currentReactContext
                ?: @Suppress("DEPRECATION") app.reactNativeHost.reactInstanceManager.currentReactContext
                ?: return
            val map = Arguments.createMap().apply {
                putString("state", state)
                putDouble("timestamp", System.currentTimeMillis().toDouble())
            }
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("KidSafeScreenState", map)
        } catch (e: Exception) {
            Log.w(TAG, "emitScreenState failed (non-fatal)", e)
        }
    }

    private fun registerAccessibilityObserver() {
        if (accessibilityObserver != null) return
        val handler = Handler(Looper.getMainLooper())
        val observer = object : ContentObserver(handler) {
            override fun onChange(selfChange: Boolean) {
                AccessibilityWatchdog.onAccessibilityListChanged(applicationContext)
            }
        }
        try {
            contentResolver.registerContentObserver(
                Settings.Secure.getUriFor(Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES),
                false,
                observer,
            )
            accessibilityObserver = observer
        } catch (_: Exception) {
            // If registration fails (very rare — usually only on locked-down enterprise builds)
            // we lose the post-tamper detection layer but the rest of the FG service still works.
        }
    }

    private fun buildNotification(): Notification {
        val openAppIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pi = PendingIntent.getActivity(
            this, 0, openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(getString(R.string.notification_title))
            .setContentText(getString(R.string.notification_text))
            .setContentIntent(pi)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
    }

    private fun createChannelIfNeeded() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (manager.getNotificationChannel(CHANNEL_ID) != null) return
        val channel = NotificationChannel(
            CHANNEL_ID,
            getString(R.string.notification_channel_name),
            NotificationManager.IMPORTANCE_LOW,
        ).apply {
            description = getString(R.string.notification_channel_description)
            setShowBadge(false)
        }
        manager.createNotificationChannel(channel)
    }

    /**
     * Heart of the native live-pill pipeline. Walks the last ~4s of UsageEvents looking for the
     * most recent foreground transition, classifies it into either:
     *
     *  - a real (non-launcher, non-self, non-systemui) package: write `currentApp = { state:
     *    'foreground', packageName: <pkg> }` via [CurrentAppWriter] and cache it as the new
     *    "last real" app.
     *  - a launcher/self/systemui-only window: do NOT update `currentApp.packageName`. Instead
     *    refresh the cached `currentApp.updatedAt` against the last real app so the parent's
     *    stale-detection clock doesn't trip on home-screen visits.
     *  - nothing usable (no events, or only systemui): no-op. The cache + last Firestore write
     *    carry through.
     *
     * The heartbeat refresh (`HEARTBEAT_REFRESH_MS` inside `CurrentAppWriter`) guarantees we
     * still hit Firestore at least every ~25s even when the same real app stays in foreground —
     * the parent's "60s stale" heuristic never fires while the kid is actually using the phone.
     */
    private fun pollForegroundApp() {
        val ctx = applicationContext
        // Belt-and-braces gating — `CurrentAppWriter.shouldWrite` also checks this, but skipping
        // the UsageStats query entirely saves a binder roundtrip while the parent is on their
        // own shared phone with Child Mode off.
        if (KidSafeStore.isSharedDevice(ctx) && !KidSafeStore.isChildModeActive(ctx)) {
            return
        }
        if (!ScreenTimeModule.hasUsageAccess(ctx)) {
            return
        }

        val usm = try {
            ctx.getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager
        } catch (_: Exception) {
            null
        } ?: return

        val now = System.currentTimeMillis()
        val events = try {
            usm.queryEvents(now - USAGE_LOOKBACK_MS, now)
        } catch (e: Exception) {
            Log.w(TAG, "queryEvents threw (non-fatal)", e)
            return
        }
        val event = UsageEvents.Event()

        var latestPkg: String? = null
        var latestAt = 0L
        val ownPkg = ctx.packageName
        while (events.hasNextEvent()) {
            events.getNextEvent(event)
            val isFgEvent =
                event.eventType == UsageEvents.Event.ACTIVITY_RESUMED ||
                    event.eventType == UsageEvents.Event.MOVE_TO_FOREGROUND
            if (!isFgEvent) continue
            val pkg = event.packageName ?: continue
            if (pkg == ownPkg) continue
            if (pkg == "com.android.systemui") continue
            // We accept launcher packages here so the resolver below can decide whether to treat
            // them as "home screen visit" (and keep the last real app sticky) or as a fallback
            // when nothing real has been seen yet.
            if (event.timeStamp >= latestAt) {
                latestAt = event.timeStamp
                latestPkg = pkg
            }
        }

        if (latestPkg == null) {
            // No usable events in the lookback window. Could be the device is genuinely idle,
            // could be UsageStats hasn't recorded anything yet (race window post-boot). The
            // last write stands; the heartbeat in CurrentAppWriter will refresh as needed.
            return
        }

        val isLauncher = isLauncherPackage(latestPkg)
        if (isLauncher) {
            // Home-screen visit. Keep the last real app sticky so the pill stays meaningful.
            val lastReal = KidSafeStore.getLastRealForegroundPackage(ctx)
            if (!lastReal.isNullOrBlank()) {
                CurrentAppWriter.writeForeground(
                    ctx,
                    lastReal,
                    rawPackage = latestPkg,
                    reason = "heartbeat_keep_last_real",
                )
            }
            // Update cache slot so consumers can see "we did observe launcher most recently".
            KidSafeStore.setCurrentForegroundPackage(ctx, latestPkg, latestAt)
            return
        }

        // Real foreground app. Cache + write.
        KidSafeStore.setCurrentForegroundPackage(ctx, latestPkg, latestAt)
        KidSafeStore.setLastRealForegroundPackage(ctx, latestPkg, latestAt)
        CurrentAppWriter.writeForeground(
            ctx,
            latestPkg,
            rawPackage = latestPkg,
            reason = "usage_stats_poll",
        )
    }

    private fun isLauncherPackage(pkg: String): Boolean {
        val normalized = pkg.lowercase()
        return LAUNCHER_PREFIXES.any { normalized == it || normalized.startsWith(it) }
    }

    companion object {
        private const val TAG = "KidSafeFgService"
        const val CHANNEL_ID = "kidsafe_service_channel"
        const val NOTIFICATION_ID = 2701

        /**
         * How often the nag runnable re-checks the accessibility state. 5s is short enough to
         * feel "continuous" to the child while still being negligible CPU/battery cost — every
         * tick is a single Settings.Secure.getString read + a few in-memory checks unless the
         * service is off, in which case we launch the PIN gate.
         */
        private const val NAG_INTERVAL_MS = 5_000L

        /**
         * Foreground poll cadence for the native live-pill resolver. 1.5s gives the parent a
         * "live within ~2s" feel while keeping UsageStats query cost negligible (a few hundred
         * events per minute on a busy phone).
         */
        private const val FG_POLL_INTERVAL_MS = 1_500L

        /**
         * UsageStats lookback per poll. Wider than the poll interval so we don't miss the
         * occasional 2-3s gap between system clock fluctuations and the timestamps that
         * UsageStats actually records.
         */
        private const val USAGE_LOOKBACK_MS = 4_000L

        /**
         * Launcher / home prefixes treated as "home screen visit" instead of a real app. Kept in
         * sync with `LAUNCHER_PREFIXES` in `src/services/childSyncEngine.ts` and
         * `src/screens/parent/CurrentAppPill.tsx`. Add new OEM launchers here whenever the pill
         * starts showing them.
         */
        private val LAUNCHER_PREFIXES = listOf(
            "com.android.launcher",
            "com.google.android.apps.nexuslauncher",
            "com.sec.android.app.launcher",
            "com.miui.home",
            "com.miui.launcher",
            "com.oppo.launcher",
            "com.bbk.launcher2",
            "com.realme.launcher",
            "com.oneplus.launcher",
            "net.oneplus.launcher",
            "com.transsion.xoslauncher",
            "com.transsion.launcher",
            "com.infinix.xlauncher",
        )

        fun start(context: Context) {
            val intent = Intent(context, KidSafeForegroundService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        /**
         * True when an instance of this service is currently running in the app process. Used
         * by [com.kidsafe.receivers.LocationToggleReceiver] to gate re-attach (the receiver
         * mustn't try to start the service itself — Android 8+ blocks background-started FG
         * services and the engine's AppState recovery owns that responsibility).
         *
         * `ActivityManager.getRunningServices` is deprecated for cross-app queries but still
         * works for the calling app's own services, which is all we need.
         */
        fun isAlive(context: Context): Boolean {
            val am = context.getSystemService(Context.ACTIVITY_SERVICE) as? android.app.ActivityManager
                ?: return false
            return try {
                @Suppress("DEPRECATION")
                am.getRunningServices(Int.MAX_VALUE).any {
                    it.service.className == KidSafeForegroundService::class.java.name
                }
            } catch (_: Exception) {
                false
            }
        }
    }
}
