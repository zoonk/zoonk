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
import kotlinx.coroutines.CoroutineStart
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

/** AAC in MPEG-4 for the API; [micStartupMs] runs from Record to the live microphone, when measured. */
class VoiceRecording(
    val audio: ByteArray,
    val durationMs: Long,
    val micStartupMs: Long? = null,
    val attemptId: UUID = UUID.randomUUID(),
) {
    fun withoutMicStartup(): VoiceRecording = VoiceRecording(audio, durationMs, attemptId = attemptId)

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
    private val opener: CoroutineDispatcher = Dispatchers.IO,
) {
    sealed interface Status {
        data object Idle : Status

        data object Acquiring : Status

        data object Unavailable : Status

        /** [startedAt] is on [SystemClock.elapsedRealtime]. */
        data class Recording(
            val startedAt: Long,
        ) : Status
    }

    private val status = MutableStateFlow<Status>(Status.Idle)
    val state: StateFlow<Status> = status.asStateFlow()

    private val recentLevels = MutableStateFlow<List<Float>>(emptyList())

    /** Normalized input levels (0 to 1), oldest first. */
    val levels: StateFlow<List<Float>> = recentLevels.asStateFlow()

    private val audio = context.getSystemService(AudioManager::class.java)
    private var take: Take? = null

    private var opening = 0

    private class Take(
        val recorder: MediaRecorder,
        val file: File,
        val focus: AudioFocusRequest,
        val onRecorded: (VoiceRecording) -> Unit,
        val micStartupMs: Long,
        val watch: Job,
    )

    val hasPermission: Boolean
        get() = ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED

    fun beginPermissionRequest(): Boolean = status.compareAndSet(Status.Idle, Status.Acquiring)

    fun endPermissionRequest() {
        status.compareAndSet(Status.Acquiring, Status.Idle)
    }

    fun clearStartFailure() {
        status.compareAndSet(Status.Unavailable, Status.Idle)
    }

    /** Returns false if acquisition could not begin; observe [state] for its eventual result. */
    fun start(onRecorded: (VoiceRecording) -> Unit): Boolean {
        if (status.value != Status.Idle || !scope.isActive || !hasPermission) return false
        val pressedAt = SystemClock.elapsedRealtime()
        val attempt = ++opening
        val focus =
            AudioFocusRequest
                .Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE)
                .setAudioAttributes(
                    AudioAttributes
                        .Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build(),
                ).setOnAudioFocusChangeListener { change -> if (attempt == opening && change < 0) cancel() }
                .build()
        if (audio.requestAudioFocus(focus) != AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
            status.value = Status.Unavailable
            return false
        }
        status.value = Status.Acquiring
        recentLevels.value = emptyList()
        scope.launch(start = CoroutineStart.UNDISPATCHED) {
            val file = File(context.cacheDir, "voice-${UUID.randomUUID()}.m4a")
            var recorder: MediaRecorder? = null
            var startedAt = pressedAt
            try {
                // Opening can't be interrupted halfway, so a cancel while it runs closes the microphone once it returns.
                withContext(NonCancellable + opener) {
                    recorder = open(file, attempt)
                    startedAt = SystemClock.elapsedRealtime()
                }
            } finally {
                val opened = recorder
                if (opened != null && attempt == opening && isActive) {
                    take = Take(opened, file, focus, onRecorded, startedAt - pressedAt, watch(opened))
                    status.value = Status.Recording(startedAt)
                } else {
                    opened?.release()
                    file.delete()
                    audio.abandonAudioFocusRequest(focus)
                    if (attempt == opening) status.value = if (isActive) Status.Unavailable else Status.Idle
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

    private fun open(
        file: File,
        attempt: Int,
    ): MediaRecorder? {
        var recorder: MediaRecorder? = null
        return try {
            // MediaRecorder(Context) requires API 31.
            @Suppress("DEPRECATION")
            val current = MediaRecorder().also { recorder = it }
            current.configure(file, attempt)
            current.prepare()
            current.start()
            current
        } catch (_: Exception) {
            recorder?.release()
            null
        }
    }

    /** Meters the take and ends it at [MAX_DURATION_MS], so the recorder never stops itself under a live screen. */
    private fun watch(recorder: MediaRecorder): Job =
        scope.launch {
            launch {
                delay(MAX_DURATION_MS)
                stop()
            }
            while (isActive) {
                val amplitude = runCatching { recorder.maxAmplitude }.getOrNull() ?: return@launch
                recentLevels.value = (recentLevels.value + loudness(amplitude)).takeLast(MAX_LEVELS)
                delay(LEVEL_INTERVAL_MS)
            }
        }

    private fun MediaRecorder.configure(
        file: File,
        attempt: Int,
    ) {
        setAudioSource(MediaRecorder.AudioSource.MIC)
        setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
        setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
        setAudioSamplingRate(SAMPLE_RATE)
        setAudioChannels(1)
        setAudioEncodingBitRate(BIT_RATE)
        setOutputFile(file.path)
        setOnErrorListener { _, _, _ -> scope.launch { if (attempt == opening) cancel() } }
    }

    private fun finish(deliver: Boolean) {
        val take = take ?: return
        this.take = null
        opening++
        take.watch.cancel()
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

        /** Upper bound accepted by the grading API. */
        private const val MAX_MIC_STARTUP_MS = 60_000L
        private const val SAMPLE_RATE = 22_050
        private const val BIT_RATE = 32_000

        private const val MAX_LEVELS = 128
        private const val LEVEL_INTERVAL_MS = 60L

        internal fun loudness(amplitude: Int): Float {
            if (amplitude <= 0) return 0f
            val decibels = 20 * log10(amplitude / FULL_SCALE)
            return ((decibels - QUIET_DB) / -QUIET_DB).coerceIn(0f, 1f)
        }

        private const val FULL_SCALE = 32_767f
        private const val QUIET_DB = -45f
    }
}
