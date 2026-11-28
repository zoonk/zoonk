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
import kotlinx.coroutines.CoroutineDispatcher
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

/**
 * AAC in an MPEG-4 file, which the API accepts as `audio/mp4`. [micStartupMs] is how long the microphone took to start after
 * Record was pressed, which lets the server tell a clipped opening from a wrong one; null when it wasn't measured.
 */
class VoiceRecording(
    val audio: ByteArray,
    val durationMs: Long,
    val micStartupMs: Long? = null,
) {
    val attemptId: UUID = UUID.randomUUID()

    /** The same take sent without its startup time, so the server grades the words as heard. */
    fun withoutMicStartup(): VoiceRecording = VoiceRecording(audio, durationMs)

    fun part(): MultipartBody.Part = MultipartBody.Part.createFormData("audio", "answer.m4a", audio.toRequestBody(MEDIA_TYPE))

    private companion object {
        val MEDIA_TYPE = "audio/mp4".toMediaType()
    }
}

/**
 * Each take lives in a temporary file that's read and deleted as soon as it stops. Losing audio
 * focus (a call, another app recording) throws the take away: half a sentence isn't worth grading.
 *
 * The microphone opens off the main thread, so [Status.Acquiring] can draw while it starts; the take is live
 * ([Status.Recording]) once `MediaRecorder.start()` returned, and only then does the screen say "Speak now".
 */
class VoiceRecorder(
    private val context: Context,
    private val scope: CoroutineScope,
    private val opener: CoroutineDispatcher = Dispatchers.IO,
) {
    sealed interface Status {
        data object Idle : Status

        data object Acquiring : Status

        /** [startedAt] is on [SystemClock.elapsedRealtime]. */
        data class Recording(
            val startedAt: Long,
        ) : Status
    }

    private val status = MutableStateFlow<Status>(Status.Idle)
    val state: StateFlow<Status> = status.asStateFlow()

    private val recentLevels = MutableStateFlow<List<Float>>(emptyList())

    /** The live take's loudness, 0 to 1, oldest first and newest last; empty until it's live. */
    val levels: StateFlow<List<Float>> = recentLevels.asStateFlow()

    private val audio = context.getSystemService(AudioManager::class.java)
    private var take: Take? = null

    /** Counts starts and cancels, so a microphone that finishes opening after its take was cancelled is closed again. */
    private var opening = 0

    private class Take(
        val recorder: MediaRecorder,
        val file: File,
        val focus: AudioFocusRequest,
        val onRecorded: (VoiceRecording) -> Unit,
        val micStartupMs: Long,
        val meter: Job,
    )

    val hasPermission: Boolean
        get() = ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED

    fun beginPermissionRequest(): Boolean = status.compareAndSet(Status.Idle, Status.Acquiring)

    fun endPermissionRequest() {
        status.compareAndSet(Status.Acquiring, Status.Idle)
    }

    /**
     * Opens the microphone for a take; [state] says when it's live, or goes back to [Status.Idle] when it couldn't start.
     * False without the microphone permission or while another take is open.
     */
    fun start(onRecorded: (VoiceRecording) -> Unit): Boolean {
        if (status.value != Status.Idle || !hasPermission) return false
        val pressedAt = SystemClock.elapsedRealtime()
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
        val attempt = ++opening
        status.value = Status.Acquiring
        recentLevels.value = emptyList()
        scope.launch {
            val file = File(context.cacheDir, "voice-${UUID.randomUUID()}.m4a")
            var recorder: MediaRecorder? = null
            try {
                // Opening can't be interrupted halfway, so a cancel while it runs closes the microphone once it returns.
                withContext(NonCancellable + opener) { recorder = open(file) }
            } finally {
                val opened = recorder
                val startedAt = SystemClock.elapsedRealtime()
                if (opened != null && attempt == opening && isActive) {
                    take = Take(opened, file, focus, onRecorded, startedAt - pressedAt, meter(opened))
                    status.value = Status.Recording(startedAt)
                } else {
                    opened?.release()
                    file.delete()
                    audio.abandonAudioFocusRequest(focus)
                    if (attempt == opening) status.value = Status.Idle
                }
            }
        }
        return true
    }

    fun stop() {
        finish(deliver = true)
    }

    fun cancel() {
        if (status.value == Status.Acquiring) {
            opening++
            status.value = Status.Idle
        }
        finish(deliver = false)
    }

    /** The prepared and started recorder, or null when the microphone couldn't start. */
    private fun open(file: File): MediaRecorder? {
        // The Context constructor is API 31; this one records the same on every version.
        @Suppress("DEPRECATION")
        val recorder = MediaRecorder()
        return try {
            recorder.configure(file)
            recorder.prepare()
            recorder.start()
            recorder
        } catch (e: Exception) {
            recorder.release()
            file.delete()
            null
        }
    }

    /** Samples the take's loudness for the screen; a meter that fails leaves the take recording. */
    private fun meter(recorder: MediaRecorder): Job =
        scope.launch {
            while (isActive) {
                val amplitude = runCatching { recorder.maxAmplitude }.getOrNull() ?: return@launch
                recentLevels.value = (recentLevels.value + loudness(amplitude)).takeLast(MAX_LEVELS)
                delay(LEVEL_INTERVAL_MS)
            }
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

    private fun finish(deliver: Boolean) {
        val take = take ?: return
        this.take = null
        take.meter.cancel()
        val started = (status.value as? Status.Recording)?.startedAt ?: SystemClock.elapsedRealtime()
        val durationMs = (SystemClock.elapsedRealtime() - started).coerceAtMost(MAX_DURATION_MS)
        // A take stopped before any audio was written throws.
        val complete = runCatching { take.recorder.stop() }.isSuccess
        take.recorder.release()
        audio.abandonAudioFocusRequest(take.focus)
        status.value = Status.Idle
        recentLevels.value = emptyList()
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
            if (isActive && bytes != null && bytes.isNotEmpty()) {
                take.onRecorded(VoiceRecording(bytes, durationMs, take.micStartupMs.coerceAtMost(MAX_MIC_STARTUP_MS)))
            }
        }
    }

    companion object {
        /** A spoken answer is one sentence; a longer recording is a microphone left on. */
        const val MAX_DURATION_MS = 30_000L

        /** The most the API takes as `micStartupMs`. */
        private const val MAX_MIC_STARTUP_MS = 60_000L
        private const val SAMPLE_RATE = 22_050
        private const val BIT_RATE = 32_000

        /** About as many as fit across a wide screen's row at one per 8dp. */
        private const val MAX_LEVELS = 128
        private const val LEVEL_INTERVAL_MS = 60L

        /** A peak from `getMaxAmplitude()` on a decibel scale: [QUIET_DB] and below is 0, full scale is 1. */
        internal fun loudness(amplitude: Int): Float {
            if (amplitude <= 0) return 0f
            val decibels = 20 * log10(amplitude / FULL_SCALE)
            return ((decibels - QUIET_DB) / -QUIET_DB).coerceIn(0f, 1f)
        }

        private const val FULL_SCALE = 32_767f
        private const val QUIET_DB = -45f
    }
}
