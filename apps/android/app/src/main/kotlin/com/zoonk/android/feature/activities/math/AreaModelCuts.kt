package com.zoonk.android.feature.activities.math

import com.zoonk.android.feature.activities.SnapRange
import com.zoonk.android.feature.activities.isMultiple
import com.zoonk.android.feature.activities.snapToStep
import com.zoonk.android.ui.components.cleanFloat

/** One side of an area or bar model: where it's cut, the step a cut moves by and its whole length. */
internal data class SideCuts(
    val cuts: List<Double>,
    val step: Double,
    val total: Double,
)

internal fun sideCuts(
    parts: List<Double>,
    total: Double,
) = SideCuts(partsToCuts(parts), splitStep(parts), total)

internal fun partsToCuts(parts: List<Double>): List<Double> = parts.dropLast(1).runningReduce(Double::plus)

internal fun cutsToParts(
    cuts: List<Double>,
    total: Double,
): List<Double> = (listOf(0.0) + cuts + total).zipWithNext { from, to -> cleanFloat(to - from) }

/** The roundest step every part is a whole number of, so the starting cuts sit on it. */
internal fun splitStep(parts: List<Double>): Double =
    DECIMAL_STEPS.find { step -> parts.all { isMultiple(it, step) } } ?: DECIMAL_STEPS.last()

/** Moves one cut, keeping at least a step between it and its neighbors. */
internal fun moveCut(
    side: SideCuts,
    index: Int,
    value: Double,
): List<Double> {
    val range = cutRange(side, index)
    if (range.min > range.max) return side.cuts
    return side.cuts.mapIndexed { position, cut -> if (position == index) snapToStep(value, range) else cut }
}

internal fun cutRange(
    side: SideCuts,
    index: Int,
) = SnapRange(
    min = (side.cuts.getOrNull(index - 1) ?: 0.0) + side.step,
    max = (side.cuts.getOrNull(index + 1) ?: side.total) - side.step,
    step = side.step,
)

/** Every cell of the grid, row by row, or the bar's parts. */
internal fun pieces(sides: List<List<Double>>): List<Double> {
    val first = sides.firstOrNull() ?: return emptyList()
    val second = sides.getOrNull(1) ?: return first
    return second.flatMap { height -> first.map { width -> width * height } }
}

private val DECIMAL_STEPS = listOf(1.0, 0.5, 0.25, 0.1, 0.05, 0.01)
