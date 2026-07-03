package com.kidsafe.kids

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.react.soloader.OpenSourceMergedSoMapping
import com.facebook.soloader.SoLoader
import com.kidsafe.modules.KidSafePackage
import com.livekit.reactnative.LiveKitReactNative
import com.livekit.reactnative.audio.AudioType
import com.oney.WebRTCModule.WebRTCModuleOptions
import org.webrtc.audio.JavaAudioDeviceModule
import android.media.MediaRecorder

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost =
      object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages.apply {
              add(KidSafePackage())
            }

        override fun getJSMainModuleName(): String = "index"

        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

        override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
        override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
      }

  override val reactHost: ReactHost
    get() = getDefaultReactHost(applicationContext, reactNativeHost)

  override fun onCreate() {
    super.onCreate()
    // Initialize LiveKit's native WebRTC audio device manager. Required on
    // Android before any Room connects; pairs with registerGlobals() in JS.
    // CommunicationAudioType keeps voice-call PLAYBACK routing (speaker/earpiece).
    LiveKitReactNative.setup(this, AudioType.CommunicationAudioType())

    // Override the capture path. LiveKit's default ADM records from
    // MediaRecorder.AudioSource.VOICE_COMMUNICATION with hardware AEC/NS on.
    // On the Android emulator that comms input is a silent/null device (the
    // host mic is only piped to MIC/VOICE_RECOGNITION), so WebRTC publishes a
    // live-but-silent track and Deepgram never receives speech. The previous
    // working Whisper pipeline captured via VOICE_RECOGNITION, so we mirror it:
    // rebuild the ADM with VOICE_RECOGNITION and no hardware processing, reusing
    // LiveKit's SamplesReadyCallback so its audio pipeline stays intact.
    WebRTCModuleOptions.getInstance().audioDeviceModule =
        JavaAudioDeviceModule.builder(this)
            .setAudioSource(MediaRecorder.AudioSource.VOICE_RECOGNITION)
            .setUseHardwareAcousticEchoCanceler(false)
            .setUseHardwareNoiseSuppressor(false)
            .setSamplesReadyCallback(LiveKitReactNative.audioRecordSamplesDispatcher)
            .createAudioDeviceModule()

    SoLoader.init(this, OpenSourceMergedSoMapping)
    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      // If you opted-in for the New Architecture, we load the native entry point for this app.
      load()
    }
  }
}
