package com.kidsafe.services

import android.content.Context
import android.util.Log
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import com.kidsafe.store.KidSafeStore

/**
 * Native writer for `children/{childUid}.currentApp` — the live "what is the kid using right now"
 * doc that the parent dashboard's [com.kidsafe.parent.CurrentAppPill] subscribes to.
 *
 * Why native instead of JS:
 *  - On aggressive OEMs (Infinix XOS, MIUI battery saver, HONOR Memory Turbo, etc.) the RN engine
 *    of a backgrounded child app gets suspended within seconds. The JS heartbeat dies, accessibility
 *    events still fire but nobody is listening, and the pill freezes on "Last seen XOS Launcher".
 *  - This writer runs inside [KidSafeForegroundService], which OEMs keep alive via the persistent
 *    notification + `START_STICKY` semantics. It writes Firestore directly using the Firebase
 *    Android SDK, so the parent pill keeps updating even when JS is dead.
 *
 * Doc shape mirrors `src/firebase/types.ts → ChildForegroundApp`:
 *   { packageName, state, updatedAt, source: 'native_usage_stats', confidence: 'high',
 *     reason, rawPackage?, lastNonLauncherPackage?, lastNonLauncherAt? }
 *
 * Gating:
 *  - No-ops if no `childUid` is cached (engine hasn't started yet, signed-out, etc.).
 *  - No-ops on shared-phone installs while Child Mode is OFF — uploading the parent's own
 *    app usage to the shared child profile would be both invasive and meaningless.
 *  - No-ops while the signed-in Firebase user can't satisfy the `parentOwns(childUid)` rule
 *    (we don't even attempt the write — Firestore would reject it anyway, and the failure log
 *    would clog `logcat`).
 *
 * All writes are best-effort; failures are logged at WARN level so a transient Firestore outage
 * doesn't tear down the foreground service.
 */
object CurrentAppWriter {

    private const val TAG = "CurrentAppWriter"
    /**
     * If a previous write completed within this window we treat the cache as fresh and skip
     * duplicate writes for the same package/state. Independent of the polling cadence so that
     * tightening the ticker doesn't accidentally spam Firestore.
     */
    private const val DEDUPE_WINDOW_MS = 1_500L
    /** Force a refresh write at least this often so the parent's staleness check doesn't trip. */
    private const val HEARTBEAT_REFRESH_MS = 25_000L

    @Volatile
    private var lastPushedPkg: String? = null
    @Volatile
    private var lastPushedState: String? = null
    @Volatile
    private var lastPushedAt: Long = 0L

    /**
     * Writes `state = 'foreground'` with the supplied package. Skips the write when the same
     * (pkg, state) pair was just pushed unless the heartbeat window elapsed.
     *
     * `rawPackage` is the raw UsageStats event package (may be a launcher); we surface it so the
     * parent dashboard can debug OEM noise without the pill itself flickering.
     */
    fun writeForeground(
        context: Context,
        packageName: String,
        rawPackage: String?,
        reason: String,
    ) {
        val now = System.currentTimeMillis()
        val ctx = context.applicationContext

        if (!shouldWrite(ctx)) {
            return
        }

        val isDuplicate = lastPushedPkg == packageName &&
            lastPushedState == "foreground" &&
            now - lastPushedAt < DEDUPE_WINDOW_MS
        val heartbeatDue = now - lastPushedAt >= HEARTBEAT_REFRESH_MS
        if (isDuplicate && !heartbeatDue) {
            return
        }

        val childUid = resolveChildUid(ctx) ?: return
        if (!hasMatchingAuth(ctx, childUid)) {
            return
        }

        val payload = HashMap<String, Any?>().apply {
            put("packageName", packageName)
            put("state", "foreground")
            put("updatedAt", now.toDouble())
            put("source", "native_usage_stats")
            put("confidence", "high")
            put("reason", reason)
            put("rawPackage", rawPackage)
            val lastReal = KidSafeStore.getLastRealForegroundPackage(ctx)
            val lastRealAt = KidSafeStore.getLastRealForegroundAt(ctx)
            put("lastNonLauncherPackage", lastReal)
            put("lastNonLauncherAt", if (lastRealAt > 0) lastRealAt.toDouble() else null)
        }

        commit(ctx, childUid, payload, packageName, "foreground", now)
    }

    /**
     * Writes a non-foreground sentinel (`screen_off`, `unavailable`, `child_mode_off`, ...). The
     * pill collapses to a muted placeholder when it sees these states.
     */
    fun writeNonForeground(
        context: Context,
        state: String,
        reason: String,
    ) {
        val now = System.currentTimeMillis()
        val ctx = context.applicationContext

        if (state == "child_mode_off" || state == "engine_stop") {
            // These signal a user/engine event — always allowed to write so the parent sees the
            // transition even when CHILD MODE just flipped off.
        } else if (!shouldWrite(ctx)) {
            return
        }

        val isDuplicate = lastPushedState == state &&
            lastPushedPkg == null &&
            now - lastPushedAt < DEDUPE_WINDOW_MS
        if (isDuplicate) {
            return
        }

        val childUid = resolveChildUid(ctx) ?: return
        if (!hasMatchingAuth(ctx, childUid)) {
            return
        }

        val payload = HashMap<String, Any?>().apply {
            put("packageName", null)
            put("state", state)
            put("updatedAt", now.toDouble())
            put("source", "native_usage_stats")
            put("confidence", "high")
            put("reason", reason)
            put("rawPackage", null)
            val lastReal = KidSafeStore.getLastRealForegroundPackage(ctx)
            val lastRealAt = KidSafeStore.getLastRealForegroundAt(ctx)
            put("lastNonLauncherPackage", lastReal)
            put("lastNonLauncherAt", if (lastRealAt > 0) lastRealAt.toDouble() else null)
        }

        commit(ctx, childUid, payload, null, state, now)
    }

    private fun commit(
        context: Context,
        childUid: String,
        payload: HashMap<String, Any?>,
        pkg: String?,
        state: String,
        now: Long,
    ) {
        try {
            FirebaseFirestore.getInstance()
                .collection("children")
                .document(childUid)
                .set(mapOf("currentApp" to payload), SetOptions.merge())
                .addOnFailureListener { e ->
                    Log.w(TAG, "Firestore currentApp write failed (uid=$childUid, state=$state)", e)
                }
            // Mark optimistically so back-to-back polls don't pile up; on success the listener is
            // a no-op (we already updated state), on failure the next poll will overwrite.
            lastPushedPkg = pkg
            lastPushedState = state
            lastPushedAt = now
            KidSafeStore.setLastNativeWriteAt(context, now)
        } catch (e: Exception) {
            Log.w(TAG, "commit threw (uid=$childUid)", e)
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
     * In two-device mode the cached `CHILD_UID` matches `auth().currentUser.uid` (the child is
     * signed in). In shared mode the parent is signed in and writes `${parentUid}_shared`. We
     * accept either match before attempting the write, otherwise the Firestore rule would reject
     * it and produce noisy logs.
     */
    private fun hasMatchingAuth(context: Context, childUid: String): Boolean {
        val authUid = FirebaseAuth.getInstance().currentUser?.uid ?: return false
        if (authUid == childUid) {
            return true
        }
        val shared = KidSafeStore.isSharedDevice(context)
        if (shared && childUid == "${authUid}_shared") {
            return true
        }
        return false
    }

    private fun resolveChildUid(context: Context): String? {
        val cached = KidSafeStore.getChildUid(context)
        if (!cached.isNullOrBlank()) {
            return cached
        }
        // Fall back to deriving the shared profile id from the signed-in parent — the JS engine
        // sets `CHILD_UID` the first time it boots, but a brand-new shared install may not have
        // hit that path yet (e.g. service restart before the dashboard opens).
        val authUid = FirebaseAuth.getInstance().currentUser?.uid ?: return null
        return if (KidSafeStore.isSharedDevice(context)) "${authUid}_shared" else authUid
    }
}
