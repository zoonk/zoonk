package com.zoonk.android.feature.activities.music

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.State
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.edit

enum class RhythmKind { Listen, Tap }

data class RhythmPosition(
    val round: Int,
    val step: Int,
)

/**
 * One run of a rhythm in seconds on [MusicClock], from [start]: tapping counts in for a bar, then plays every round's clicks;
 * listening plays one round with its hits. A tap is timed from when the first round is heard, so it's measured against the
 * sound, not the screen.
 */
class RhythmSchedule(
    private val fields: RhythmFields,
    val kind: RhythmKind,
    start: Double,
) {
    private val stepSeconds = fields.stepMs / MS
    private val beatSeconds = fields.beatMs / MS
    private val rounds = if (kind == RhythmKind.Tap) fields.rounds else 1
    private val countInBeats = if (kind == RhythmKind.Tap) fields.beats else 0
    val roundsStart = start + countInBeats * beatSeconds
    val end = roundsStart + rounds * fields.beats * beatSeconds

    val clicks: List<ScheduledClick> =
        (0 until countInBeats + rounds * fields.beats).map { beat ->
            ScheduledClick(if (beat % fields.beats == 0) MusicClick.Accent else MusicClick.Beat, start + beat * beatSeconds)
        } +
            if (kind ==
                RhythmKind.Listen
            ) {
                fields.hitSteps.map { ScheduledClick(MusicClick.Hit, roundsStart + it * stepSeconds) }
            } else {
                emptyList()
            }

    /** A tap at [at] as milliseconds from the first round, or null when it's more than half a beat outside the rounds. */
    fun tapMs(at: Double): Double? {
        val tapMs = (at - roundsStart) * MS
        val graceMs = fields.beatMs / 2
        return tapMs.takeIf { it >= -graceMs && it <= (end - roundsStart) * MS + graceMs }
    }

    fun isCountingIn(now: Double): Boolean = now < roundsStart

    fun isOver(now: Double): Boolean = now > end + TAIL_SECONDS

    fun position(now: Double): RhythmPosition? {
        if (now < roundsStart || now > end) return null
        val steps = ((now - roundsStart) / stepSeconds).toInt()
        return RhythmPosition(steps / fields.pattern.length, steps % fields.pattern.length)
    }

    private companion object {
        const val MS = 1000.0
        const val TAIL_SECONDS = 0.5
    }
}

/** Main's sound check: a few clicks to listen to, then clicks to tap along with, a second apart. */
class SoundCheckSchedule(
    start: Double,
) {
    private val measuredStart = start + COUNT_IN * INTERVAL_SECONDS
    private val end = start + (COUNT_IN + CLICKS) * INTERVAL_SECONDS

    val clicks: List<ScheduledClick> =
        (0 until COUNT_IN + CLICKS).map {
            ScheduledClick(if (it == COUNT_IN) MusicClick.Accent else MusicClick.Beat, start + it * INTERVAL_SECONDS)
        }

    val clicksMs: List<Double> = (0 until CLICKS).map { (measuredStart + it * INTERVAL_SECONDS) * MS }

    fun isOver(now: Double): Boolean = now > end

    /** The click to tap with now, from 1, or null while counting in. */
    fun click(now: Double): Int? = if (now < measuredStart) null else minOf(((now - measuredStart) / INTERVAL_SECONDS).toInt() + 1, CLICKS)

    companion object {
        const val CLICKS = 6
        const val INTERVAL_MS = 1000.0
        private const val COUNT_IN = 3
        private const val INTERVAL_SECONDS = INTERVAL_MS / 1000
        private const val MS = 1000.0
    }
}

/** A rhythm being listened to or tapped; [onFinish] gets the taps once a tapping run's last round is over. */
@Stable
class RhythmRun internal constructor(
    private val audio: MusicAudio,
    private val fields: RhythmFields,
    private val onFinish: State<(List<Double>) -> Unit>,
) {
    enum class Phase { Idle, CountIn, Tapping, Listening, Done }

    var phase by mutableStateOf(Phase.Idle)
        private set

    var position by mutableStateOf<RhythmPosition?>(null)
        private set

    private var schedule by mutableStateOf<RhythmSchedule?>(null)
    private val taps = mutableListOf<Double>()

    val isRunning: Boolean get() = phase == Phase.CountIn || phase == Phase.Tapping

    internal val isActive: Boolean get() = schedule != null

    fun start(kind: RhythmKind) {
        stop()
        val soonest = audio.soonestHeardTime() ?: return
        val next = RhythmSchedule(fields, kind, soonest + LEAD_IN_SECONDS)
        audio.click(next.clicks)
        phase = if (kind == RhythmKind.Tap) Phase.CountIn else Phase.Listening
        schedule = next
    }

    /** A tap at [at] seconds on [MusicClock]. */
    fun tap(at: Double) {
        val current = schedule?.takeIf { it.kind == RhythmKind.Tap } ?: return
        current.tapMs(at)?.let { taps += it }
    }

    fun stop() {
        if (schedule != null) audio.stop()
        schedule = null
        position = null
        phase = Phase.Idle
        taps.clear()
    }

    internal suspend fun follow() {
        while (schedule != null) withFrameNanos { advance(MusicClock.now()) }
    }

    private fun advance(now: Double) {
        val current = schedule ?: return

        if (current.isOver(now)) {
            val tapped = taps.toList()
            schedule = null
            position = null
            phase = if (current.kind == RhythmKind.Tap) Phase.Done else Phase.Idle
            taps.clear()
            if (current.kind == RhythmKind.Tap) onFinish.value(tapped)
            return
        }

        phase =
            when {
                current.kind == RhythmKind.Listen -> Phase.Listening
                current.isCountingIn(now) -> Phase.CountIn
                else -> Phase.Tapping
            }
        position = current.position(now)
    }
}

/** Taps along with steady clicks to measure how late this device's sound arrives. */
@Stable
class SoundCheck internal constructor(
    private val audio: MusicAudio,
) {
    sealed interface Phase {
        data object Idle : Phase

        data object CountIn : Phase

        data class Tapping(
            val click: Int,
        ) : Phase

        /** [delayMs] is null when too few taps matched a click. */
        data class Done(
            val delayMs: Int?,
        ) : Phase
    }

    var phase by mutableStateOf<Phase>(Phase.Idle)
        private set

    private var schedule by mutableStateOf<SoundCheckSchedule?>(null)
    private val taps = mutableListOf<Double>()

    val isRunning: Boolean get() = phase == Phase.CountIn || phase is Phase.Tapping

    fun start() {
        stop()
        val soonest = audio.soonestHeardTime() ?: return
        val next = SoundCheckSchedule(soonest + LEAD_IN_SECONDS)
        audio.click(next.clicks)
        phase = Phase.CountIn
        schedule = next
    }

    fun tap(at: Double) {
        if (schedule != null) taps += at * MS
    }

    fun stop() {
        if (schedule != null) audio.stop()
        schedule = null
        phase = Phase.Idle
        taps.clear()
    }

    internal suspend fun follow() {
        while (schedule != null) withFrameNanos { advance(MusicClock.now()) }
    }

    private fun advance(now: Double) {
        val current = schedule ?: return

        phase =
            if (current.isOver(now)) {
                schedule = null
                Phase.Done(Rhythm.estimateDeviceDelay(current.clicksMs, SoundCheckSchedule.INTERVAL_MS, taps.toList()))
            } else {
                current.click(now)?.let { Phase.Tapping(it) } ?: Phase.CountIn
            }
    }

    private companion object {
        const val MS = 1000.0
    }
}

private const val LEAD_IN_SECONDS = 0.15

@Composable
internal fun rememberRhythmRun(
    audio: MusicAudio,
    fields: RhythmFields,
    onFinish: (List<Double>) -> Unit,
): RhythmRun {
    val finish = rememberUpdatedState(onFinish)
    val run = remember(audio, fields) { RhythmRun(audio, fields, finish) }

    DisposableEffect(run) { onDispose { run.stop() } }
    LaunchedEffect(run, run.isActive) { run.follow() }

    return run
}

@Composable
internal fun rememberSoundCheck(audio: MusicAudio): SoundCheck {
    val check = remember(audio) { SoundCheck(audio) }

    DisposableEffect(check) { onDispose { check.stop() } }
    LaunchedEffect(check, check.isRunning) { check.follow() }

    return check
}

/** How late this device plays sound, measured once and kept on the device, as main keeps it in the browser. */
sealed interface DeviceDelay {
    data object Unset : DeviceDelay

    data object Skipped : DeviceDelay

    data class Measured(
        val ms: Int,
    ) : DeviceDelay
}

@Stable
class DeviceDelayStore internal constructor(
    context: Context,
) {
    private val preferences = context.applicationContext.getSharedPreferences(FILE, Context.MODE_PRIVATE)

    var delay by mutableStateOf(read())
        private set

    fun save(ms: Int) {
        preferences.edit { putString(KEY, "$ms") }
        delay = DeviceDelay.Measured(ms)
    }

    fun skip() {
        preferences.edit { putString(KEY, SKIPPED) }
        delay = DeviceDelay.Skipped
    }

    private fun read(): DeviceDelay {
        val stored = preferences.getString(KEY, null)
        return when {
            stored == SKIPPED -> DeviceDelay.Skipped
            else -> stored?.toIntOrNull()?.let { DeviceDelay.Measured(it) } ?: DeviceDelay.Unset
        }
    }

    internal companion object {
        const val FILE = "music"
        const val KEY = "rhythm_device_delay"
        private const val SKIPPED = "skipped"
    }
}

@Composable
internal fun rememberDeviceDelay(): DeviceDelayStore {
    val context = LocalContext.current
    return remember(context) { DeviceDelayStore(context) }
}
