package com.kidsafe.modules

import android.app.ActivityManager
import android.content.Context
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.kidsafe.services.KidSafeForegroundService
import com.kidsafe.store.KidSafeStore

/**
 * Start / stop the always-on child monitoring service from JS. Called once the child finishes the
 * permissions onboarding.
 */
class ForegroundServiceModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = NAME

    @ReactMethod
    fun start(childUid: String, promise: Promise) {
        try {
            KidSafeStore.setRole(reactApplicationContext, "child")
            KidSafeStore.setChildUid(reactApplicationContext, childUid)
            KidSafeForegroundService.start(reactApplicationContext)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("E_FG_SERVICE", e)
        }
    }

    @ReactMethod
    fun isRunning(promise: Promise) {
        val am = reactApplicationContext
            .getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        @Suppress("DEPRECATION")
        val running = am.getRunningServices(Int.MAX_VALUE)
            .any { it.service.className == KidSafeForegroundService::class.java.name }
        promise.resolve(running)
    }

    companion object {
        const val NAME = "ForegroundService"
    }
}
