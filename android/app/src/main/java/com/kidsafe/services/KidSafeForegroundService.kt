package com.kidsafe.services

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.database.ContentObserver
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import androidx.core.app.NotificationCompat
import com.kidsafe.MainActivity
import com.kidsafe.R
import com.kidsafe.security.AccessibilityWatchdog

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

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        registerAccessibilityObserver()
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
        return START_STICKY
    }

    override fun onDestroy() {
        nagHandler?.removeCallbacks(nagRunnable)
        nagHandler = null
        accessibilityObserver?.let { contentResolver.unregisterContentObserver(it) }
        accessibilityObserver = null
        super.onDestroy()
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

    companion object {
        const val CHANNEL_ID = "kidsafe_service_channel"
        const val NOTIFICATION_ID = 2701

        /**
         * How often the nag runnable re-checks the accessibility state. 5s is short enough to
         * feel "continuous" to the child while still being negligible CPU/battery cost — every
         * tick is a single Settings.Secure.getString read + a few in-memory checks unless the
         * service is off, in which case we launch the PIN gate.
         */
        private const val NAG_INTERVAL_MS = 5_000L

        fun start(context: Context) {
            val intent = Intent(context, KidSafeForegroundService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }
    }
}
