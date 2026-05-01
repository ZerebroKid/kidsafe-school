package com.kidsafe.modules

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * Registers every KidSafe-specific native module so JS can `NativeModules.<Name>` them.
 */
class KidSafePackage : ReactPackage {

    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(
            DeviceAdminModule(reactContext),
            InstalledAppsModule(reactContext),
            AppBlockerModule(reactContext),
            ScreenTimeModule(reactContext),
            LocationModule(reactContext),
            GeofenceModule(reactContext),
            ForegroundServiceModule(reactContext),
            ScheduleModule(reactContext),
            OemSettingsModule(reactContext),
        )

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
