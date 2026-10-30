package com.zoonk.android.feature.activities

import androidx.compose.ui.input.key.Key
import com.zoonk.android.ui.components.cleanFloat
import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

/** Main's `snap-value.ts`: the values something placed along an axis can take. */
data class SnapRange(
    val min: Double,
    val max: Double,
    val step: Double,
)

/** Main's `clamp`, which never throws when [low] is above [high]. */
fun clamp(
    value: Double,
    low: Double,
    high: Double,
): Double = min(max(value, low), high)

fun isMultiple(
    value: Double,
    step: Double,
): Boolean {
    val ratio = value / step
    return abs(ratio - jsRound(ratio)) < MULTIPLE_SLACK * max(1.0, abs(ratio))
}

/** Counts whole steps from [SnapRange.min], so a range whose ends aren't multiples of its step still lands on its own grid. */
fun snapToStep(
    value: Double,
    range: SnapRange,
): Double {
    val steps = jsRound((clamp(value, range.min, range.max) - range.min) / range.step)
    return clamp(cleanFloat(range.min + steps * range.step), range.min, range.max)
}

/** A slider's stops: its whole steps from [SnapRange.min], plus [SnapRange.max] when they don't land on it, which main's End key reaches. */
fun sliderStops(range: SnapRange): Int {
    val steps = (range.max - range.min) / range.step
    return if (isMultiple(range.max - range.min, range.step)) jsRound(steps).toInt() else floor(steps).toInt() + 1
}

fun sliderStop(
    value: Double,
    range: SnapRange,
): Int = if (value >= range.max) sliderStops(range) else jsRound((clamp(value, range.min, range.max) - range.min) / range.step).toInt()

fun sliderValue(
    stop: Int,
    range: SnapRange,
): Double = if (stop >= sliderStops(range)) range.max else snapToStep(range.min + stop * range.step, range)

/** Moves like a native slider: arrows a step, Page Up and Down ten, Home and End to the ends; other keys give null. */
fun valueAfterKey(
    key: Key,
    value: Double,
    range: SnapRange,
): Double? =
    when (key) {
        Key.MoveHome -> range.min
        Key.MoveEnd -> range.max
        else -> KEY_STEPS[key]?.let { snapToStep(value + it * range.step, range) }
    }

private val KEY_STEPS =
    mapOf(
        Key.DirectionDown to -1,
        Key.DirectionLeft to -1,
        Key.DirectionRight to 1,
        Key.DirectionUp to 1,
        Key.PageDown to -10,
        Key.PageUp to 10,
    )

private const val MULTIPLE_SLACK = 1e-9
