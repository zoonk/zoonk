package com.zoonk.android.feature.activities.music

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRouting
import android.media.AudioTimestamp
import android.media.AudioTrack
import android.os.Handler
import android.os.Looper
import android.os.Process
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

/** A note to play [at] seconds after the sound starts, ringing [duration] seconds if given. */
data class MusicSound(
    val at: Double,
    val midi: Int,
    val duration: Double? = null,
) {
    companion object {
        /** Notes struck at once (a chord), strummed when [gap] spreads them a little, or one after another with a longer gap. */
        fun together(
            midis: List<Int>,
            gap: Double = 0.0,
            at: Double = 0.0,
        ): List<MusicSound> = midis.mapIndexed { index, midi -> MusicSound(at + index * gap, midi) }
    }
}

enum class MusicInstrument { Piano, Guitar }

/** main's clicks: [Accent] for a bar's first beat, [Beat] for the rest, [Hit] for a rhythm's notes. */
enum class MusicClick { Accent, Beat, Hit }

/** [heardAt] is seconds on [MusicClock]. */
data class ScheduledClick(
    val kind: MusicClick,
    val heardAt: Double,
)

/**
 * Seconds on the monotonic clock touches are stamped with (`SystemClock.uptimeMillis`, the basis of `System.nanoTime`) and the
 * audio output's timestamps are read in, so a tap and the sound it follows share one timeline.
 */
object MusicClock {
    fun now(): Double = System.nanoTime() / NANOS

    /** A touch's time, as `PointerInputChange.uptimeMillis` or `MotionEvent.getEventTime` give it. */
    fun ofUptimeMillis(uptimeMillis: Long): Double = uptimeMillis / MILLIS

    private const val NANOS = 1e9
    private const val MILLIS = 1e3
}

/**
 * Every sound is scheduled at the moment it is heard on [MusicClock], with the output's delay read from the track's
 * timestamps. A route without timestamps counts only the frames still queued, not the device's own delay; a rhythm's grading
 * takes that steady delay out. Losing audio focus or the output stops what's playing, since a timed run can't go on with a
 * different delay. The screen holds audio focus from its first sound until it closes. Call it on the main thread.
 */
class MusicAudio(
    context: Context,
) {
    /** The sound couldn't start: the activity still works, and says so. */
    var isUnavailable by mutableStateOf(false)
        private set

    var onInterruption: (() -> Unit)? = null

    private val audioManager = context.applicationContext.getSystemService(AudioManager::class.java)
    private val mainHandler = Handler(Looper.getMainLooper())
    private var output: MusicOutput? = null
    private var hasFocus = false
    private val focusRequest =
        AudioFocusRequest
            .Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
            .setAudioAttributes(attributes)
            .setOnAudioFocusChangeListener(::focusChanged, mainHandler)
            .build()

    /** Plays notes, each at its time from [from] (a time from [soonestHeardTime]), or from as soon as they can sound. */
    fun play(
        sounds: List<MusicSound>,
        instrument: MusicInstrument,
        duration: Double = NOTE_DURATION,
        from: Double? = null,
    ) {
        val soonest = soonestHeardTime() ?: return
        val first = from ?: (soonest + SCHEDULE_AHEAD)
        val voice = if (instrument == MusicInstrument.Piano) MusicRenderer.Voice.Piano else MusicRenderer.Voice.Guitar

        output?.schedule(sounds.map { MusicRenderer.Event(first + it.at, voice, it.midi, it.duration ?: duration) })
    }

    fun click(clicks: List<ScheduledClick>) {
        if (soonestHeardTime() == null) return
        output?.schedule(clicks.map { MusicRenderer.Event(it.heardAt, MusicRenderer.Voice.Click, click = it.kind) })
    }

    fun stop() {
        output?.stop()
    }

    /** The soonest time on [MusicClock] a sound scheduled now can be heard, starting the sound if it isn't running; null when it can't start. */
    fun soonestHeardTime(): Double? {
        val running = start()
        isUnavailable = running == null
        return running?.soonestHeardAt()
    }

    /** Stops what's playing and lets go of the output and audio focus; the next sound takes them again. */
    fun release() {
        output?.close()
        output = null
        hasFocus = false
        // Also after a transient loss, so the system lets go of the request and its listener.
        audioManager.abandonAudioFocusRequest(focusRequest)
    }

    private fun start(): MusicOutput? {
        if (!hasFocus) {
            hasFocus = audioManager.requestAudioFocus(focusRequest) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
            if (!hasFocus) return null
        }

        output?.takeIf { it.isRunning }?.let { return it }
        output?.close()
        output = MusicOutput.open(audioManager, mainHandler) { if (it === output) interrupted() }
        return output
    }

    private fun focusChanged(change: Int) {
        when (change) {
            AudioManager.AUDIOFOCUS_GAIN -> {
                hasFocus = true
            }

            AudioManager.AUDIOFOCUS_LOSS -> {
                hasFocus = false
                audioManager.abandonAudioFocusRequest(focusRequest)
                interrupted()
            }

            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> {
                hasFocus = false
                interrupted()
            }
        }
    }

    private fun interrupted() {
        stop()
        onInterruption?.invoke()
    }

    internal fun interruptAndRelease() {
        interrupted()
        release()
    }

    companion object {
        /** A note's ring before it's let go, main's default. */
        const val NOTE_DURATION = 1.2

        /** How far ahead of the soonest moment a sound can be heard notes are placed, so a chord's spread stays even. */
        private const val SCHEDULE_AHEAD = 0.03

        private val attributes by lazy {
            AudioAttributes
                .Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                .build()
        }
    }

    /**
     * One output track and the thread that renders into it. The thread owns the track: it starts it, pauses it after a
     * quiet spell, waits for the next sound and releases it on close.
     */
    private class MusicOutput(
        private val track: AudioTrack,
        private val burst: Int,
        private val handler: Handler,
        private val onInterrupt: (MusicOutput) -> Unit,
    ) {
        private val renderer = MusicRenderer(track.sampleRate.toDouble())
        private val sampleRate = track.sampleRate.toDouble()
        private val parking = ReentrantLock()
        private val work = parking.newCondition()

        @Volatile private var closed = false

        @Volatile private var restamp = false

        /** How long after it's written a frame is heard, as the thread last measured it. */
        @Volatile private var latency = track.bufferSizeInFrames / sampleRate

        private val thread = Thread(::run, "MusicAudio").apply { start() }

        val isRunning: Boolean get() = !closed && thread.isAlive

        fun soonestHeardAt(): Double = MusicClock.now() + latency + burst / sampleRate

        fun schedule(events: List<MusicRenderer.Event>) {
            renderer.schedule(events)
            parking.withLock { work.signal() }
        }

        fun stop() = renderer.stopAll()

        fun routeChanged() {
            restamp = true
        }

        fun close() {
            closed = true
            renderer.stopAll()
            parking.withLock { work.signal() }
        }

        private fun run() {
            Process.setThreadPriority(Process.THREAD_PRIORITY_URGENT_AUDIO)

            val buffer = FloatArray(burst)
            val clock = OutputClock(track, sampleRate)
            var quietFrames = 0

            try {
                while (!closed) {
                    if (quietFrames >= IDLE_SECONDS * sampleRate) {
                        track.pause()
                        parking.withLock { while (!closed && renderer.isSilent) work.await() }
                        quietFrames = 0
                        clock.restart()
                        continue
                    }

                    if (restamp) {
                        restamp = false
                        clock.restart()
                    }

                    if (track.playState != AudioTrack.PLAYSTATE_PLAYING) track.play()

                    val heardAt = clock.heardAt()
                    latency = heardAt - MusicClock.now()
                    renderer.render(buffer, burst, heardAt)

                    val wrote = track.write(buffer, 0, burst, AudioTrack.WRITE_BLOCKING)

                    if (wrote < 0) break

                    clock.wrote(wrote)
                    quietFrames = if (renderer.wasSilent) quietFrames + wrote else 0
                }
            } catch (_: IllegalStateException) {
                // The track stopped working (the audio server restarted): the next sound opens a new one.
            } finally {
                track.release()
                if (!closed) handler.post { onInterrupt(this) }
            }
        }

        companion object {
            private const val IDLE_SECONDS = 2
            private const val DEFAULT_BURST = 256

            fun open(
                audioManager: AudioManager,
                handler: Handler,
                onInterrupt: (MusicOutput) -> Unit,
            ): MusicOutput? {
                val track =
                    try {
                        AudioTrack
                            .Builder()
                            .setAudioAttributes(attributes)
                            .setAudioFormat(
                                AudioFormat
                                    .Builder()
                                    .setEncoding(AudioFormat.ENCODING_PCM_FLOAT)
                                    .setSampleRate(AudioTrack.getNativeOutputSampleRate(AudioManager.STREAM_MUSIC))
                                    .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                                    .build(),
                            ).setTransferMode(AudioTrack.MODE_STREAM)
                            .setPerformanceMode(AudioTrack.PERFORMANCE_MODE_LOW_LATENCY)
                            .build()
                    } catch (_: UnsupportedOperationException) {
                        return null
                    } catch (_: IllegalArgumentException) {
                        return null
                    }

                if (track.state != AudioTrack.STATE_INITIALIZED) {
                    track.release()
                    return null
                }

                val burst =
                    audioManager.getProperty(AudioManager.PROPERTY_OUTPUT_FRAMES_PER_BUFFER)?.toIntOrNull()?.takeIf { it > 0 }
                        ?: DEFAULT_BURST
                val output = MusicOutput(track, burst, handler, onInterrupt)
                var device: Int? = null

                track.addOnRoutingChangedListener(
                    AudioRouting.OnRoutingChangedListener { router ->
                        val routed = router.routedDevice?.id
                        if (routed == null || !output.isRunning) return@OnRoutingChangedListener
                        val previous = device
                        device = routed

                        if (previous != null && previous != routed) {
                            output.routeChanged()
                            onInterrupt(output)
                        }
                    },
                    handler,
                )

                return output
            }
        }
    }

    /**
     * When the frames written to [track] are heard: from the track's timestamps once they come in (polled every buffer until
     * the position advances, then every few seconds, as `getTimestamp` asks), and until then from the frames still queued.
     * Used only on the output's thread.
     */
    private class OutputClock(
        private val track: AudioTrack,
        private val sampleRate: Double,
    ) {
        private val stamp = AudioTimestamp()
        private var written = 0L
        private var stampFrame = -1L
        private var stampNanos = 0L
        private var isSteady = false
        private var nextStampAt = 0L
        private var since = System.nanoTime()

        /** Timestamps from before a pause or a new route describe another timeline. */
        fun restart() {
            stampFrame = -1L
            isSteady = false
            nextStampAt = written
            since = System.nanoTime()
        }

        fun wrote(frames: Int) {
            written += frames
        }

        /** When the next frame written is heard, in seconds on [MusicClock]. */
        fun heardAt(): Double {
            if (written >= nextStampAt) readStamp()

            if (stampFrame >= 0) return stampNanos / NANOS + (written - stampFrame) / sampleRate

            val head = track.playbackHeadPosition.toLong() and UNSIGNED_INT
            return MusicClock.now() + (written - head) / sampleRate
        }

        private fun readStamp() {
            if (track.getTimestamp(stamp) && stamp.nanoTime >= since) {
                if (stampFrame >= 0 && stamp.framePosition > stampFrame) isSteady = true
                stampFrame = stamp.framePosition
                stampNanos = stamp.nanoTime
            }

            nextStampAt = written + if (isSteady) (STEADY_STAMP_SECONDS * sampleRate).toLong() else 0L
        }

        private companion object {
            const val NANOS = 1e9
            const val UNSIGNED_INT = 0xFFFFFFFFL
            const val STEADY_STAMP_SECONDS = 5
        }
    }
}

/** The screen's synthesizer: it stops and lets go of the sound when the app leaves the foreground, and closes with the screen. */
@Composable
fun rememberMusicAudio(): MusicAudio {
    val context = LocalContext.current
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    val audio = remember(context) { MusicAudio(context) }

    DisposableEffect(audio, lifecycle) {
        val observer = LifecycleEventObserver { _, event -> if (event == Lifecycle.Event.ON_STOP) audio.interruptAndRelease() }
        lifecycle.addObserver(observer)

        onDispose {
            lifecycle.removeObserver(observer)
            audio.onInterruption = null
            audio.release()
        }
    }

    return audio
}
