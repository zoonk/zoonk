package com.zoonk.android.feature.audio

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaRecorder
import android.os.SystemClock
import androidx.core.content.ContextCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File
import java.util.UUID
import kotlin.math.log10

/** AAC in an MPEG-4 file, which the API accepts as `audio/mp4`. */
class VoiceRecording(
    val audio: ByteArray,
    val durationMs: Long,
) {
    fun part(): MultipartBody.Part = MultipartBody.Part.createFormData("audio", "answer.m4a", audio.toRequestBody(MEDIA_TYPE))

    private companion object {
        val MEDIA_TYPE = "audio/mp4".toMediaType()
    }
}

/**
 * Each take lives in a temporary file that's read and deleted as soon as it stops. Losing audio
 * focus (a call, another app recording) throws the take away: half a sentence isn't worth grading.
 */
class VoiceRecorder(
    private val context: Context,
    private val scope: CoroutineScope,
) {
    sealed interface Status {
        data object Idle : Status

        /** [startedAt] is on [SystemClock.elapsedRealtime]. */
        data class Recording(
            val startedAt: Long,
        ) : Status
    }

    private val status = MutableStateFlow<Status>(Status.Idle)
    val state: StateFlow<Status> = status.asStateFlow()

    private val loudness = MutableStateFlow(0f)

    /** From 0 (silence) to 1. */
    val level: StateFlow<Float> = loudness.asStateFlow()

    private val audio = context.getSystemService(AudioManager::class.java)
    private var take: Take? = null

    private class Take(
        val recorder: MediaRecorder,
        val file: File,
        val focus: AudioFocusRequest,
        val meter: Job,
        val onRecorded: (VoiceRecording) -> Unit,
    )

    val hasPermission: Boolean
        get() = ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED

    /** False without the microphone permission, or when the microphone couldn't start. */
    fun start(onRecorded: (VoiceRecording) -> Unit): Boolean {
        if (take != null || !hasPermission) return false
        val focus =
            AudioFocusRequest
                .Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE)
                .setAudioAttributes(
                    AudioAttributes
                        .Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build(),
                ).setOnAudioFocusChangeListener { change -> if (change < 0) cancel() }
                .build()
        if (audio.requestAudioFocus(focus) != AudioManager.AUDIOFOCUS_REQUEST_GRANTED) return false
        val file = File(context.cacheDir, "voice-${UUID.randomUUID()}.m4a")

        // The Context constructor is API 31; this one records the same on every version.
        @Suppress("DEPRECATION")
        val recorder = MediaRecorder()
        try {
            recorder.configure(file)
            recorder.prepare()
            recorder.start()
        } catch (e: Exception) {
            recorder.release()
            file.delete()
            audio.abandonAudioFocusRequest(focus)
            return false
        }
        val startedAt = SystemClock.elapsedRealtime()
        take = Take(recorder, file, focus, meter(recorder), onRecorded)
        status.value = Status.Recording(startedAt)
        return true
    }

    fun stop() {
        finish(deliver = true)
    }

    fun cancel() {
        finish(deliver = false)
    }

    private fun MediaRecorder.configure(file: File) {
        setAudioSource(MediaRecorder.AudioSource.MIC)
        setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
        setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
        setAudioSamplingRate(SAMPLE_RATE)
        setAudioChannels(1)
        setAudioEncodingBitRate(BIT_RATE)
        setMaxDuration(MAX_DURATION_MS.toInt())
        setOutputFile(file.path)
        setOnInfoListener { _, what, _ ->
            if (what == MediaRecorder.MEDIA_RECORDER_INFO_MAX_DURATION_REACHED) scope.launch { stop() }
        }
        setOnErrorListener { _, _, _ -> scope.launch { cancel() } }
    }

    private fun meter(recorder: MediaRecorder) =
        scope.launch {
            while (isActive) {
                // -50 dB is silence for speech; 0 dB is the loudest.
                val amplitude = recorder.maxAmplitude.coerceAtLeast(1)
                val decibels = 20 * log10(amplitude / MAX_AMPLITUDE)
                loudness.value = ((decibels + 50) / 50).coerceIn(0f, 1f)
                delay(METER_INTERVAL_MS)
            }
        }

    private fun finish(deliver: Boolean) {
        val take = take ?: return
        this.take = null
        val started = (status.value as? Status.Recording)?.startedAt ?: SystemClock.elapsedRealtime()
        val durationMs = (SystemClock.elapsedRealtime() - started).coerceAtMost(MAX_DURATION_MS)
        take.meter.cancel()
        // A take stopped before any audio was written throws.
        val complete = runCatching { take.recorder.stop() }.isSuccess
        take.recorder.release()
        audio.abandonAudioFocusRequest(take.focus)
        loudness.value = 0f
        status.value = Status.Idle
        // A ViewModel closes its scope before onCleared throws the take away.
        if (!complete || !deliver || !scope.isActive) {
            take.file.delete()
            return
        }
        scope.launch {
            val bytes =
                withContext(NonCancellable + Dispatchers.IO) {
                    runCatching { take.file.readBytes() }.getOrNull().also { take.file.delete() }
                }
            if (isActive && bytes != null && bytes.isNotEmpty()) take.onRecorded(VoiceRecording(bytes, durationMs))
        }
    }

    companion object {
        /** A spoken answer is one sentence; a longer recording is a microphone left on. */
        const val MAX_DURATION_MS = 30_000L
        private const val SAMPLE_RATE = 22_050
        private const val BIT_RATE = 32_000
        private const val MAX_AMPLITUDE = 32_767f
        private const val METER_INTERVAL_MS = 100L
    }
}
