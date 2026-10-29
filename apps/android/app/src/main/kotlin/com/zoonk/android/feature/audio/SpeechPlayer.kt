package com.zoonk.android.feature.audio

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.SessionSource
import com.zoonk.android.ui.components.Limit
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.io.File
import kotlin.coroutines.cancellation.CancellationException

/** A native [recording] plays first; `personal` text is the learner's own words, voiced in a clip of theirs. */
data class SpokenText(
    val text: String,
    val recording: String? = null,
    val personal: Boolean = false,
)

sealed interface SpeechState {
    data object Idle : SpeechState

    data object Loading : SpeechState

    data object Playing : SpeechState

    data class Failed(
        val limit: Limit?,
    ) : SpeechState
}

/** [segment] is the one playing or about to. */
data class SpeechPlayback(
    val owner: Any,
    val state: SpeechState,
    val segment: Int,
)

fun interface SpeechClips {
    /** The clip's URL; throws [ApiException]. */
    suspend fun clip(
        session: AuthenticatedSession,
        language: String,
        text: String,
        personal: Boolean,
    ): String
}

interface AudioOutput {
    suspend fun play(
        file: File,
        rate: Float,
        onStart: () -> Unit,
    ): PlaybackEnd

    fun stop()
}

enum class PlaybackEnd { Ended, Failed, Stopped }

/**
 * One sound at a time for the whole app: speaking for one owner stops whatever played before.
 * Text is voiced only from the learner's tap, once per session however often it plays. Call it on
 * the main thread.
 */
class SpeechPlayer(
    private val clips: SpeechClips,
    private val files: VoiceFiles,
    private val output: AudioOutput,
    private val sessions: SessionSource,
    private val scope: CoroutineScope,
) {
    private val current = MutableStateFlow<SpeechPlayback?>(null)
    val playback: StateFlow<SpeechPlayback?> = current.asStateFlow()

    private var job: Job? = null
    private val clipUrls = mutableMapOf<ClipKey, Deferred<String>>()
    private var clipsSession: AuthenticatedSession? = null

    /** Another owner's sound reads as idle. */
    fun state(owner: Any): SpeechState = current.value?.takeIf { it.owner == owner }?.state ?: SpeechState.Idle

    fun speak(
        owner: Any,
        language: String,
        segments: List<SpokenText>,
        rate: Float = 1f,
        onDone: () -> Unit = {},
    ) {
        stopCurrent()
        if (segments.isEmpty()) return
        val session = sessions.current
        current.value = SpeechPlayback(owner, SpeechState.Loading, 0)
        job =
            scope.launch {
                val end = read(Reading(owner, language, rate, session), segments)
                current.value = end?.let { SpeechPlayback(owner, it, current.value?.segment ?: 0) }
                if (end == null) onDone()
            }
    }

    /** Another owner's sound keeps playing. */
    fun stop(owner: Any) {
        if (current.value?.owner != owner) return
        stopCurrent()
        current.value = null
    }

    /** Everything one tap's sound is read with, including the session it was asked from. */
    private class Reading(
        val owner: Any,
        val language: String,
        val rate: Float,
        val session: AuthenticatedSession?,
    )

    /** Null when every segment played; otherwise how it ended. */
    private suspend fun read(
        reading: Reading,
        segments: List<SpokenText>,
    ): SpeechState? {
        var index = 0
        var segment = segments.first()
        var loading = load(reading, segment)
        while (true) {
            current.value = SpeechPlayback(reading.owner, SpeechState.Loading, index)
            val file =
                try {
                    loading.await()
                } catch (e: CancellationException) {
                    throw e
                } catch (e: Exception) {
                    return SpeechState.Failed((e as? ApiException)?.let { Limit.of(it) })
                }
            // Another learner signed in while it loaded.
            if (sessions.current != reading.session) return SpeechState.Idle
            val following = segments.getOrNull(index + 1)
            val next = following?.let { load(reading, it) }
            val end = output.play(file, reading.rate) { current.value = SpeechPlayback(reading.owner, SpeechState.Playing, index) }
            when (end) {
                PlaybackEnd.Stopped -> {
                    return SpeechState.Idle
                }

                PlaybackEnd.Failed -> {
                    if (segment.recording == null) return SpeechState.Failed(null)
                    segment = segment.copy(recording = null)
                    loading = load(reading, segment)
                }

                PlaybackEnd.Ended -> {
                    if (following == null || next == null) return null
                    index += 1
                    segment = following
                    loading = next
                }
            }
        }
    }

    /** A recording that won't download falls back to the text read aloud. */
    private fun load(
        reading: Reading,
        segment: SpokenText,
    ): Deferred<File> =
        scope.async {
            segment.recording?.let { recording ->
                try {
                    return@async files.file(recording, session = null)
                } catch (e: CancellationException) {
                    throw e
                } catch (_: Exception) {
                    // Read the text instead.
                }
            }
            val session = reading.session ?: throw ApiException(ApiError.Unauthorized)
            val url = clipUrl(session, ClipKey(reading.language, segment.text, segment.personal)).await()
            try {
                files.file(url, session)
            } catch (e: ApiException) {
                if (e.error == ApiError.Unauthorized) sessions.expire(session)
                throw e
            }
        }

    /** A failure isn't kept, so trying again asks again; another session never reuses this one's clips. */
    private fun clipUrl(
        session: AuthenticatedSession,
        key: ClipKey,
    ): Deferred<String> {
        if (clipsSession != session) {
            clipUrls.clear()
            clipsSession = session
        }
        clipUrls[key]?.let { return it }
        val request =
            scope.async {
                try {
                    clips.clip(session, key.language, key.text, key.personal)
                } catch (e: Exception) {
                    if (clipsSession == session) clipUrls.remove(key)
                    if ((e as? ApiException)?.error == ApiError.Unauthorized) sessions.expire(session)
                    throw e
                }
            }
        clipUrls[key] = request
        return request
    }

    private fun stopCurrent() {
        job?.cancel()
        job = null
        output.stop()
    }

    private data class ClipKey(
        val language: String,
        val text: String,
        val personal: Boolean,
    )

    companion object {
        /** Slow enough to hear each sound, close enough to real speech to still sound like the word. */
        const val SLOW_RATE = 0.7f
    }
}
