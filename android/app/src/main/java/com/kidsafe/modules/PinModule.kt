package com.kidsafe.modules

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.kidsafe.store.KidSafeStore

/**
 * JS bridge for the parent PIN that gates uninstall / device-admin / accessibility tamper screens.
 *
 * The PIN is set on the child device during onboarding (parent is supposed to be physically
 * present) and is stored salted-and-hashed in [KidSafeStore]. JS never sees the raw hash, only
 * boolean results.
 */
class PinModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = NAME

    @ReactMethod
    fun setPin(pin: String, promise: Promise) {
        try {
            val sanitized = pin.trim()
            if (sanitized.length < MIN_LEN || sanitized.length > MAX_LEN || !sanitized.all { it.isDigit() }) {
                promise.reject(
                    "E_PIN_FORMAT",
                    "PIN must be a $MIN_LEN-$MAX_LEN digit numeric string.",
                )
                return
            }
            KidSafeStore.setPin(reactApplicationContext, sanitized)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("E_PIN", e)
        }
    }

    @ReactMethod
    fun hasPin(promise: Promise) {
        try {
            promise.resolve(KidSafeStore.hasPin(reactApplicationContext))
        } catch (e: Exception) {
            promise.reject("E_PIN", e)
        }
    }

    @ReactMethod
    fun verifyPin(pin: String, promise: Promise) {
        try {
            promise.resolve(KidSafeStore.verifyPin(reactApplicationContext, pin))
        } catch (e: Exception) {
            promise.reject("E_PIN", e)
        }
    }

    @ReactMethod
    fun clearPin(promise: Promise) {
        try {
            KidSafeStore.clearPin(reactApplicationContext)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("E_PIN", e)
        }
    }

    @ReactMethod
    fun lockoutRemainingMs(promise: Promise) {
        try {
            promise.resolve(KidSafeStore.pinLockoutRemainingMs(reactApplicationContext).toDouble())
        } catch (e: Exception) {
            promise.reject("E_PIN", e)
        }
    }

    companion object {
        const val NAME = "Pin"
        private const val MIN_LEN = 4
        private const val MAX_LEN = 6
    }
}
