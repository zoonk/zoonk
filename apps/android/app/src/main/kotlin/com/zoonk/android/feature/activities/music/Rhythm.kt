package com.zoonk.android.feature.activities.music

import kotlin.math.abs
import kotlin.math.roundToInt

/** A rhythm's fields: one bar of "x" (tap) and "." (rest) steps, played [rounds] times over a click on every beat. */
data class RhythmFields(
    val pattern: String,
    val rounds: Int,
    val stepsPerBeat: Int,
    val tempo: Int,
    val toleranceMs: Int,
) {
    val hitSteps: List<Int> get() = pattern.indices.filter { pattern[it] == 'x' }
    val stepMs: Double get() = MS_PER_MINUTE / tempo / stepsPerBeat
    val beatMs: Double get() = stepMs * stepsPerBeat
    val beats: Int get() = pattern.length / stepsPerBeat

    /** Core's `rhythmTapTimes`: when each tap falls, from the first round's first step. */
    val tapTimes: List<Double>
        get() = (0 until rounds).flatMap { round -> hitSteps.map { step -> (round * pattern.length + step) * stepMs } }

    private companion object {
        const val MS_PER_MINUTE = 60_000.0
    }
}

enum class TapStatus { Early, Late, Missed, OnTime }

data class HitResult(
    val offsetMs: Int?,
    val status: TapStatus,
)

data class RhythmResults(
    val extraTaps: Int,
    val hits: List<HitResult>,
)

/** Mirrors core's rhythm grading in `music.ts` and main's `rhythm-results.ts`. Times are milliseconds. */
object Rhythm {
    /** Allow audio-device latency without excusing performances shifted onto the wrong beats. */
    private const val MAX_EARLY_SHIFT_MS = 80.0
    private const val MAX_LATE_SHIFT_MS = 300.0
    private const val MAX_CALIBRATED_SHIFT_MS = 60.0
    private const val MIN_DEVICE_DELAY_MS = -100
    private const val MAX_DEVICE_DELAY_MS = 500
    private const val MIN_CALIBRATION_TAPS = 4
    private const val MATCH_WINDOW_SHARE = 0.5

    private fun median(values: List<Double>): Double {
        val sorted = values.sorted()
        val middle = sorted.size / 2
        return if (sorted.size % 2 == 0) (sorted[middle - 1] + sorted[middle]) / 2 else sorted[middle]
    }

    private fun delayShift(
        rawOffsetsMs: List<Double>,
        calibrated: Boolean,
    ): Double {
        val early = if (calibrated) MAX_CALIBRATED_SHIFT_MS else MAX_EARLY_SHIFT_MS
        val late = if (calibrated) MAX_CALIBRATED_SHIFT_MS else MAX_LATE_SHIFT_MS
        return median(rawOffsetsMs).coerceIn(-early, late)
    }

    /** How late this device's sound arrives, from taps along with steady clicks, or null when too few taps match a click. */
    fun estimateDeviceDelay(
        clicksMs: List<Double>,
        intervalMs: Double,
        tapsMs: List<Double>,
    ): Int? {
        val offsets =
            clicksMs.mapNotNull { click ->
                tapsMs.map { it - click }.filter { abs(it) <= intervalMs / 2 }.minByOrNull { abs(it) }
            }

        if (offsets.size < MIN_CALIBRATION_TAPS) return null

        val delay = median(offsets).roundToInt()
        return delay.takeIf { it in MIN_DEVICE_DELAY_MS..MAX_DEVICE_DELAY_MS }
    }

    /** Each expected time takes the nearest tap left within half a beat, or none. */
    private fun pairTaps(
        beatMs: Double,
        expectedMs: List<Double>,
        tapsMs: List<Double>,
    ): List<Double?> {
        val window = beatMs * MATCH_WINDOW_SHARE
        val used = mutableSetOf<Int>()

        return expectedMs.map { time ->
            tapsMs.indices
                .filter { it !in used && abs(tapsMs[it] - time) <= window }
                .minByOrNull { abs(tapsMs[it] - time) }
                ?.let {
                    used += it
                    tapsMs[it]
                }
        }
    }

    /** Each hit on time, early, late or missed after taking the device's steady delay out, and the taps that matched none. */
    fun results(
        beatMs: Double,
        deviceDelayMs: Double?,
        expectedMs: List<Double>,
        tapsMs: List<Double>,
        toleranceMs: Int,
    ): RhythmResults {
        val pairs = pairTaps(beatMs, expectedMs, tapsMs.map { it - (deviceDelayMs ?: 0.0) })
        val raw = pairs.mapIndexedNotNull { index, tap -> tap?.let { it - expectedMs[index] } }
        val shift = if (raw.isEmpty()) 0.0 else delayShift(raw, calibrated = deviceDelayMs != null)

        val hits =
            pairs.mapIndexed { index, tap ->
                if (tap == null) {
                    HitResult(null, TapStatus.Missed)
                } else {
                    val offset = Math.round(tap - expectedMs[index] - shift).toInt()
                    val status =
                        when {
                            abs(offset) <= toleranceMs -> TapStatus.OnTime
                            offset < 0 -> TapStatus.Early
                            else -> TapStatus.Late
                        }
                    HitResult(offset, status)
                }
            }

        return RhythmResults(tapsMs.size - raw.size, hits)
    }

    /** The hit to talk about: a missed one first, then the furthest off. */
    fun worstHit(hits: List<HitResult>): IndexedValue<HitResult>? {
        val off = hits.withIndex().filter { it.value.status != TapStatus.OnTime }
        return off.firstOrNull { it.value.status == TapStatus.Missed } ?: off.maxByOrNull { abs(it.value.offsetMs ?: 0) }
    }
}
