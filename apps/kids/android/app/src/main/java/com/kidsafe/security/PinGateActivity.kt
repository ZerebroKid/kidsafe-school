package com.kidsafe.security

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.CountDownTimer
import android.text.Editable
import android.text.TextWatcher
import android.view.View
import android.view.WindowManager
import android.view.animation.Animation
import android.view.animation.AnimationUtils
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.kidsafe.kids.R
import com.kidsafe.store.KidSafeStore

/**
 * Full-screen activity launched by [com.kidsafe.blocker.AppBlockerService] when [TamperWatcher]
 * detects the child opened a KidSafe-targeted system Settings page.
 *
 * The activity:
 *  - Gates the underlying Settings UI behind the parent PIN.
 *  - Logs every attempt (success or fail) to `children/{childUid}/events/` so the parent can see
 *    tamper history.
 *  - Sends the child to the home screen on cancel/back.
 *
 * It deliberately does *not* try to "kill" the Settings activity in the background — popping our
 * own activity over it is enough, because the Settings UI underneath is not interactable while we
 * are in front, and Back lands on the home launcher (we override it).
 */
class PinGateActivity : AppCompatActivity() {

    private lateinit var pinInput: EditText
    private lateinit var statusText: TextView
    private lateinit var submitButton: Button
    private lateinit var titleText: TextView

    private var lockoutTimer: CountDownTimer? = null
    private var tamperKindName: String = "unknown"
    private var tamperKindLabel: String = "settings change"
    private var tamperPkg: String? = null
    private var tamperClass: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Show over the lock screen if the user had locked the device while a Settings flow was
        // mid-air. The child shouldn't be able to swipe past us to a tamper screen.
        window.addFlags(
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
        )
        setContentView(R.layout.activity_pin_gate)

        tamperKindName = intent.getStringExtra(EXTRA_KIND_NAME) ?: tamperKindName
        tamperKindLabel = intent.getStringExtra(EXTRA_KIND_LABEL) ?: tamperKindLabel
        tamperPkg = intent.getStringExtra(EXTRA_TAMPER_PKG)
        tamperClass = intent.getStringExtra(EXTRA_TAMPER_CLASS)

        titleText = findViewById(R.id.pin_title)
        pinInput = findViewById(R.id.pin_input)
        statusText = findViewById(R.id.pin_status)
        submitButton = findViewById(R.id.pin_submit)

        titleText.text = getString(R.string.pin_gate_title, tamperKindLabel)

        pinInput.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                statusText.visibility = View.GONE
            }
            override fun afterTextChanged(s: Editable?) {}
        })

        submitButton.setOnClickListener { onSubmitPin() }
        findViewById<View>(R.id.pin_cancel).setOnClickListener { goHomeAndFinish() }

        refreshLockoutState()
    }

    override fun onDestroy() {
        super.onDestroy()
        lockoutTimer?.cancel()
    }

    @Deprecated("System back is overridden to send home")
    override fun onBackPressed() {
        // Back acts as cancel — we don't let the user fall through to the Settings page behind us.
        goHomeAndFinish()
    }

    private fun onSubmitPin() {
        val ctx = applicationContext
        val remaining = KidSafeStore.pinLockoutRemainingMs(ctx)
        if (remaining > 0) {
            refreshLockoutState()
            return
        }

        val entered = pinInput.text.toString().trim()
        if (entered.length < 4) {
            statusText.text = getString(R.string.pin_gate_too_short)
            statusText.visibility = View.VISIBLE
            return
        }

        val ok = KidSafeStore.verifyPin(ctx, entered)
        logTamperAttempt(success = ok)

        if (ok) {
            // Tag the underlying window with a 60s bypass so AppBlockerService doesn't immediately
            // re-launch us when the Settings activity resumes (TYPE_WINDOW_STATE_CHANGED fires
            // again as we finish). The bypass is keyed on (pkg, class) so unrelated tamper screens
            // still gate normally.
            KidSafeStore.setGateBypass(ctx, tamperPkg, tamperClass, BYPASS_AFTER_SUCCESS_MS)
            finish()
        } else {
            pinInput.text.clear()
            shake(pinInput)
            refreshLockoutState()
        }
    }

    private fun shake(view: View) {
        val shake = AnimationUtils.loadAnimation(this, android.R.anim.linear_interpolator).apply {
            duration = 60
            repeatCount = 4
            repeatMode = Animation.REVERSE
        }
        view.animate().translationXBy(20f).setDuration(50).withEndAction {
            view.animate().translationXBy(-40f).setDuration(50).withEndAction {
                view.animate().translationXBy(20f).setDuration(50).start()
            }.start()
        }.start()
        @Suppress("DEPRECATION")
        view.startAnimation(shake)
    }

    /** Updates the status line with either "wrong PIN" or a live lockout countdown. */
    private fun refreshLockoutState() {
        lockoutTimer?.cancel()
        val ctx = applicationContext
        val remaining = KidSafeStore.pinLockoutRemainingMs(ctx)
        if (remaining <= 0) {
            // If there have been failures but we're not locked, show generic wrong-pin text.
            // (Cleared on next keystroke via the TextWatcher.)
            if (statusText.text.isNullOrBlank()) {
                statusText.visibility = View.GONE
            } else {
                statusText.text = getString(R.string.pin_gate_wrong)
                statusText.visibility = View.VISIBLE
            }
            submitButton.isEnabled = true
            pinInput.isEnabled = true
            return
        }

        submitButton.isEnabled = false
        pinInput.isEnabled = false
        statusText.visibility = View.VISIBLE

        lockoutTimer = object : CountDownTimer(remaining, 1_000) {
            override fun onTick(msUntilFinished: Long) {
                val secs = (msUntilFinished / 1000).toInt().coerceAtLeast(1)
                statusText.text = getString(R.string.pin_gate_locked_out, secs)
            }
            override fun onFinish() {
                submitButton.isEnabled = true
                pinInput.isEnabled = true
                statusText.visibility = View.GONE
            }
        }.start()
    }

    private fun goHomeAndFinish() {
        // Treat "user dismissed the PIN screen" as a tamper attempt with success=false. This is
        // important for parent visibility — the child may have realised they couldn't pass and
        // backed out, but we still want a record.
        logTamperAttempt(success = false)
        // For sensitive kinds (accessibility / overlay / device admin / app info / package
        // installer uninstall) we deliberately do NOT set a bypass — the gate must re-fire the
        // moment the child re-enters the same Settings page so they cannot complete the tamper.
        // For lower-stakes kinds (battery, autostart) a short bypass keeps the dismiss UX from
        // looping when the user legitimately backs out.
        if (!isSensitiveKind(tamperKindName)) {
            KidSafeStore.setGateBypass(
                applicationContext,
                tamperPkg,
                tamperClass,
                BYPASS_AFTER_CANCEL_MS,
            )
        }
        val home = Intent(Intent.ACTION_MAIN).apply {
            addCategory(Intent.CATEGORY_HOME)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        startActivity(home)
        finish()
    }

    /**
     * Returns true for tamper kinds where the child must NOT be allowed any grace period after
     * cancelling the PIN gate — i.e. anywhere the tamper would defeat KidSafe's protection if
     * completed (uninstall, accessibility, overlay, device admin). Kept in sync with the
     * `telemetryName` values on [TamperWatcher.TamperKind].
     */
    private fun isSensitiveKind(name: String): Boolean = when (name) {
        "accessibility", "overlay", "device_admin", "app_info" -> true
        else -> false
    }

    private fun logTamperAttempt(success: Boolean) {
        val ctx = applicationContext
        val childUid = KidSafeStore.getChildUid(ctx) ?: return
        try {
            FirebaseFirestore.getInstance()
                .collection("children")
                .document(childUid)
                .collection("events")
                .add(
                    mapOf(
                        "type" to "tamper_attempt",
                        "kind" to tamperKindName,
                        "success" to success,
                        "timestamp" to System.currentTimeMillis(),
                        "createdAt" to FieldValue.serverTimestamp(),
                    ),
                )
        } catch (_: Exception) {
            // Best-effort. If Firestore is unavailable (offline / signed out), the attempt
            // simply isn't recorded — the local PIN check still gates the user.
        }
    }

    companion object {
        private const val EXTRA_KIND_NAME = "extra_tamper_kind_name"
        private const val EXTRA_KIND_LABEL = "extra_tamper_kind_label"
        private const val EXTRA_TAMPER_PKG = "extra_tamper_pkg"
        private const val EXTRA_TAMPER_CLASS = "extra_tamper_class"

        private const val BYPASS_AFTER_SUCCESS_MS = 60_000L
        private const val BYPASS_AFTER_CANCEL_MS = 5_000L

        fun intent(
            context: Context,
            kind: TamperWatcher.TamperKind,
            pkg: String? = null,
            cls: String? = null,
        ): Intent =
            Intent(context, PinGateActivity::class.java).apply {
                addFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_CLEAR_TOP or
                        Intent.FLAG_ACTIVITY_NO_HISTORY,
                )
                putExtra(EXTRA_KIND_NAME, kind.telemetryName)
                putExtra(EXTRA_KIND_LABEL, kind.displayLabel)
                putExtra(EXTRA_TAMPER_PKG, pkg)
                putExtra(EXTRA_TAMPER_CLASS, cls)
            }
    }
}
