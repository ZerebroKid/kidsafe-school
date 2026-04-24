package com.kidsafe.receivers

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.kidsafe.store.KidSafeStore
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Fires once a day (just after midnight) to reset the screen-time counter for the new day.
 * Scheduled by [com.kidsafe.modules.ScreenTimeModule.scheduleMidnightReset].
 */
class ScreenTimeReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != ACTION_DAILY_RESET) return
        Log.i(TAG, "Daily reset fired")
        KidSafeStore.setScreenTimeUsedMins(context, 0)
        KidSafeStore.setScreenTimeDay(context, today())
    }

    private fun today(): String =
        SimpleDateFormat("yyyy-DDD", Locale.US).format(Date())

    companion object {
        const val ACTION_DAILY_RESET = "com.kidsafe.SCREEN_TIME_RESET"
        private const val TAG = "KidSafeScreenTime"
    }
}
