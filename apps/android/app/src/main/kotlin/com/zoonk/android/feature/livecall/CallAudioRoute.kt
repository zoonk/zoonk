package com.zoonk.android.feature.livecall

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioDeviceCallback
import android.media.AudioDeviceInfo
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.os.Handler
import android.os.Looper

/**
 * Call audio while a call runs: the system's voice-call mode and focus, out of a headset when one is
 * connected, else the speaker, since a language call is held in front of the learner, not to the ear.
 */
internal class CallAudioRoute(
    context: Context,
) {
    private val audio = context.getSystemService(AudioManager::class.java)
    private val focus =
        AudioFocusRequest
            .Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
            .setAudioAttributes(
                AudioAttributes
                    .Builder()
                    .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build(),
            ).build()
    private val devices =
        object : AudioDeviceCallback() {
            override fun onAudioDevicesAdded(added: Array<out AudioDeviceInfo>) = route()

            override fun onAudioDevicesRemoved(removed: Array<out AudioDeviceInfo>) = route()
        }
    private var previousMode = AudioManager.MODE_NORMAL
    private var started = false

    fun start() {
        if (started) return
        started = true
        previousMode = audio.mode
        audio.requestAudioFocus(focus)
        audio.mode = AudioManager.MODE_IN_COMMUNICATION
        route()
        audio.registerAudioDeviceCallback(devices, Handler(Looper.getMainLooper()))
    }

    fun stop() {
        if (!started) return
        started = false
        audio.unregisterAudioDeviceCallback(devices)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            audio.clearCommunicationDevice()
        } else {
            @Suppress("DEPRECATION")
            audio.isSpeakerphoneOn = false
        }
        audio.mode = previousMode
        audio.abandonAudioFocusRequest(focus)
    }

    private fun route() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val headsets = WIRED + AudioDeviceInfo.TYPE_BLUETOOTH_SCO + AudioDeviceInfo.TYPE_BLE_HEADSET
            val available = audio.availableCommunicationDevices
            val device =
                available.firstOrNull { it.type in headsets } ?: available.firstOrNull { it.type == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER }
            device?.let(audio::setCommunicationDevice)
        } else {
            // Below 31 a Bluetooth headset needs SCO started by hand; the call stays on the speaker there.
            val wired = audio.getDevices(AudioManager.GET_DEVICES_OUTPUTS).any { it.type in WIRED }
            @Suppress("DEPRECATION")
            audio.isSpeakerphoneOn = !wired
        }
    }

    private companion object {
        val WIRED = setOf(AudioDeviceInfo.TYPE_WIRED_HEADSET, AudioDeviceInfo.TYPE_WIRED_HEADPHONES, AudioDeviceInfo.TYPE_USB_HEADSET)
    }
}
