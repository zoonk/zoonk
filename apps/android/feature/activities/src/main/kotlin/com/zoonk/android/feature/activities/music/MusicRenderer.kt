package com.zoonk.android.feature.activities.music

import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.exp
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.math.sqrt
import kotlin.math.tanh

/**
 * The synthesizer, run on the audio thread. Events come in through a lock the audio thread only tries, so it never waits
 * on the main thread, and every voice lives in storage allocated up front, so rendering allocates nothing.
 */
internal class MusicRenderer(
    private val sampleRate: Double,
) {
    enum class Voice { Piano, Guitar, Click }

    class Event(
        /** Seconds on [MusicClock]. */
        val heardAt: Double,
        val voice: Voice,
        val midi: Int = 0,
        val duration: Double = 0.0,
        val click: MusicClick = MusicClick.Beat,
    )

    private class VoiceState {
        var isActive = false
        var voice = Voice.Piano

        /** Frames of silence before it starts, in the buffer it starts in. */
        var wait = 0
        var age = 0
        var length = 0
        var releaseFrames = 1
        var releaseAge = -1
        var gain = 0f
        var frequency = 0.0
        var click = MusicClick.Beat

        // A guitar string's loop: its delay line, the fractional delay's allpass and the loss.
        var period = 0
        var index = 0
        var allpass = 0.0
        var allpassInput = 0.0
        var allpassOutput = 0.0
        var loss = 0.0
    }

    private val lock = ReentrantLock()
    private val inbox = ArrayList<Event>()
    private var inboxStops = 0

    @Volatile private var silent = true

    private val voices = Array(VOICE_COUNT) { VoiceState() }

    /** Per piano voice and partial: amplitude, its loss per frame, and the oscillator's phase as a rotating vector (re, im) with its turn per frame (cos, sin). */
    private val partialState = DoubleArray(VOICE_COUNT * PARTIALS * 6)
    private val delayLines = FloatArray(VOICE_COUNT * DELAY_LENGTH)
    private val pending = arrayOfNulls<Event>(PENDING_CAPACITY)
    private var pendingCount = 0
    private var stopsSeen = 0
    private var noise = 0x9E3779B9.toInt()

    val isSilent: Boolean get() = silent && lock.withLock { inbox.isEmpty() }

    /** The last buffer sounded nothing and nothing waited to; read on the audio thread, where taking the lock could wait. */
    val wasSilent: Boolean get() = silent

    fun schedule(events: List<Event>) {
        if (events.isEmpty()) return
        lock.withLock { inbox.addAll(events) }
        silent = false
    }

    fun stopAll() {
        lock.withLock {
            inbox.clear()
            inboxStops += 1
        }
    }

    /** Fills the first [frameCount] frames of [output], the first of them heard at [heardAt] seconds on [MusicClock]. */
    fun render(
        output: FloatArray,
        frameCount: Int,
        heardAt: Double,
    ) {
        output.fill(0f, 0, frameCount)
        takeInbox()
        startDueEvents(heardAt, frameCount)

        var isSounding = false

        for (slot in 0 until VOICE_COUNT) {
            if (!voices[slot].isActive) continue
            isSounding = true
            renderVoice(slot, output, frameCount)
        }

        for (frame in 0 until frameCount) output[frame] = tanh(output[frame])

        silent = !isSounding && pendingCount == 0
    }

    private fun takeInbox() {
        if (!lock.tryLock()) return

        try {
            if (inboxStops != stopsSeen) {
                stopsSeen = inboxStops
                pendingCount = 0

                for (slot in 0 until VOICE_COUNT) {
                    if (voices[slot].isActive) release(slot, (sampleRate * STOP_SECONDS).toInt())
                }
            }

            for (index in inbox.indices) {
                if (pendingCount == PENDING_CAPACITY) break
                pending[pendingCount] = inbox[index]
                pendingCount += 1
            }

            inbox.clear()
        } finally {
            lock.unlock()
        }
    }

    private fun startDueEvents(
        bufferHeardAt: Double,
        frameCount: Int,
    ) {
        var index = 0

        while (index < pendingCount) {
            val event = pending[index] ?: break
            val offset = ((event.heardAt - bufferHeardAt) * sampleRate).roundToInt()

            if (offset < frameCount) {
                startVoice(event, max(0, offset))
                pendingCount -= 1
                pending[index] = pending[pendingCount]
                pending[pendingCount] = null
            } else {
                index += 1
            }
        }
    }

    private fun freeSlot(): Int {
        var oldest = 0

        for (slot in 0 until VOICE_COUNT) {
            if (!voices[slot].isActive) return slot
            if (voices[slot].age > voices[oldest].age) oldest = slot
        }

        return oldest
    }

    private fun startVoice(
        event: Event,
        wait: Int,
    ) {
        val slot = freeSlot()
        val voice = voices[slot]

        voice.isActive = true
        voice.voice = event.voice
        voice.wait = wait
        voice.age = 0
        voice.releaseAge = -1
        voice.frequency = 440 * 2.0.pow((event.midi - 69) / 12.0)

        when (event.voice) {
            Voice.Piano -> {
                voice.gain = PIANO_GAIN
                voice.length = (min(event.duration, LONGEST_NOTE) * sampleRate).toInt()
                voice.releaseFrames = (PIANO_RELEASE * sampleRate).toInt()
                startPiano(slot, voice.frequency)
            }

            Voice.Guitar -> {
                voice.gain = GUITAR_GAIN
                voice.length = (min(event.duration, LONGEST_NOTE) * sampleRate).toInt()
                voice.releaseFrames = (GUITAR_RELEASE * sampleRate).toInt()
                startString(voice, slot)
            }

            Voice.Click -> {
                voice.gain = 1f
                voice.click = event.click
                voice.length = (CLICK_SECONDS * sampleRate).toInt()
                voice.releaseFrames = 1
            }
        }
    }

    /** A piano note: a few partials, slightly stretched as a real string's are, the higher ones fading sooner, and lower notes ringing longer. */
    private fun startPiano(
        slot: Int,
        frequency: Double,
    ) {
        val ring = (2.4 * sqrt(261.6 / frequency)).coerceIn(0.5, 4.0)
        val base = slot * PARTIALS * 6

        for (partial in 0 until PARTIALS) {
            val number = (partial + 1).toDouble()
            val partialFrequency = frequency * number * sqrt(1 + 0.0004 * number * number)
            val turn = 2 * PI * partialFrequency / sampleRate
            val decay = (1 + 0.8 * partial) / ring
            val state = base + partial * 6

            partialState[state] = if (partialFrequency < sampleRate / 2) PIANO_PARTIALS[partial] else 0.0
            partialState[state + 1] = exp(-decay / sampleRate)
            partialState[state + 2] = 1.0
            partialState[state + 3] = 0.0
            partialState[state + 4] = cos(turn)
            partialState[state + 5] = sin(turn)
        }
    }

    /** A plucked steel string (Karplus–Strong): a burst of noise circulating in a loop a period long, softened a little on every pass. */
    private fun startString(
        voice: VoiceState,
        slot: Int,
    ) {
        val exact = sampleRate / voice.frequency - 0.5
        var period = exact.toInt()
        var fraction = exact - period

        if (fraction < 0.1) {
            period -= 1
            fraction += 1
        }

        period = period.coerceIn(2, DELAY_LENGTH - 1)
        voice.period = period
        voice.index = 0
        voice.allpass = (1 - fraction) / (1 + fraction)
        voice.allpassInput = 0.0
        voice.allpassOutput = 0.0
        voice.loss = 0.996 - min(voice.frequency / 20_000, 0.01)

        val line = slot * DELAY_LENGTH
        var smoothed = 0f

        for (index in 0 until period) {
            noise = noise xor (noise shl 13)
            noise = noise xor (noise ushr 17)
            noise = noise xor (noise shl 5)
            val random = (noise.toUInt().toDouble() / UInt.MAX_VALUE.toDouble() * 2 - 1).toFloat()
            smoothed = smoothed * 0.4f + random * 0.6f
            delayLines[line + index] = smoothed
        }
    }

    private fun renderVoice(
        slot: Int,
        output: FloatArray,
        frameCount: Int,
    ) {
        val voice = voices[slot]
        val state = slot * PARTIALS * 6
        val line = slot * DELAY_LENGTH
        var frame = min(voice.wait, frameCount)
        voice.wait -= frame

        while (frame < frameCount && voice.isActive) {
            var sample =
                when (voice.voice) {
                    Voice.Piano -> pianoSample(voice, state)
                    Voice.Guitar -> stringSample(voice, line)
                    Voice.Click -> clickSample(voice)
                }

            if (voice.age >= voice.length && voice.releaseAge < 0) voice.releaseAge = 0

            if (voice.releaseAge >= 0) {
                val left = max(1 - voice.releaseAge.toDouble() / voice.releaseFrames, 0.0)
                sample *= left * left
                voice.releaseAge += 1
                if (voice.releaseAge >= voice.releaseFrames) voice.isActive = false
            }

            output[frame] += sample.toFloat() * voice.gain
            voice.age += 1
            frame += 1
        }
    }

    private fun pianoSample(
        voice: VoiceState,
        state: Int,
    ): Double {
        var sample = 0.0

        for (partial in 0 until PARTIALS) {
            val base = state + partial * 6
            val re = partialState[base + 2]
            val im = partialState[base + 3]
            sample += partialState[base] * im
            partialState[base] *= partialState[base + 1]
            partialState[base + 2] = re * partialState[base + 4] - im * partialState[base + 5]
            partialState[base + 3] = re * partialState[base + 5] + im * partialState[base + 4]
        }

        if (partialState[state] < 0.0005) voice.isActive = false

        return sample * min(voice.age / (PIANO_ATTACK * sampleRate), 1.0)
    }

    private fun stringSample(
        voice: VoiceState,
        line: Int,
    ): Double {
        val next = (voice.index + 1) % voice.period
        val current = delayLines[line + voice.index].toDouble()
        val averaged = 0.5 * (current + delayLines[line + next]) * voice.loss
        val tuned = voice.allpass * averaged + voice.allpassInput - voice.allpass * voice.allpassOutput

        voice.allpassInput = averaged
        voice.allpassOutput = tuned
        delayLines[line + voice.index] = tuned.toFloat()
        voice.index = next
        return current
    }

    /** main's `scheduleClick`: a sine (a triangle for a rhythm's hits) that swells in 2 ms and dies away by 50 ms, both exponentially. */
    private fun clickSample(voice: VoiceState): Double {
        val frequency: Double
        val peak: Double

        when (voice.click) {
            MusicClick.Accent -> {
                frequency = 1760.0
                peak = 0.5
            }

            MusicClick.Beat -> {
                frequency = 1320.0
                peak = 0.3
            }

            MusicClick.Hit -> {
                frequency = 2400.0
                peak = 0.6
            }
        }

        val time = voice.age / sampleRate
        val envelope =
            if (time < CLICK_ATTACK) {
                CLICK_FLOOR * (peak / CLICK_FLOOR).pow(time / CLICK_ATTACK)
            } else {
                peak * (CLICK_FLOOR / peak).pow((time - CLICK_ATTACK) / (CLICK_SECONDS - CLICK_ATTACK))
            }
        val phase = (time * frequency) % 1
        val wave = if (voice.click == MusicClick.Hit) 1 - 4 * abs(phase - 0.5) else sin(2 * PI * phase)

        return wave * envelope
    }

    private fun release(
        slot: Int,
        frames: Int,
    ) {
        voices[slot].releaseFrames = max(frames, 1)
        voices[slot].releaseAge = 0
        voices[slot].wait = 0
    }

    private companion object {
        const val VOICE_COUNT = 32

        /** A written length past this rings no longer: no sound decays slower. */
        const val LONGEST_NOTE = 30.0
        const val PARTIALS = 6
        const val DELAY_LENGTH = 2048

        /** Room for every note of the longest melody core accepts (1,000 characters, played twice through its repeats) before any of it sounds. */
        const val PENDING_CAPACITY = 4096
        val PIANO_PARTIALS = doubleArrayOf(1.0, 0.45, 0.25, 0.14, 0.08, 0.05)
        const val PIANO_GAIN = 0.22f
        const val PIANO_RELEASE = 0.3
        const val PIANO_ATTACK = 0.003
        const val GUITAR_GAIN = 0.5f
        const val GUITAR_RELEASE = 0.25
        const val STOP_SECONDS = 0.01
        const val CLICK_SECONDS = 0.05
        const val CLICK_ATTACK = 0.002
        const val CLICK_FLOOR = 0.0001
    }
}
