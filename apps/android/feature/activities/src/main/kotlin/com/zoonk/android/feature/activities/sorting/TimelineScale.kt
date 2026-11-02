package com.zoonk.android.feature.activities.sorting

import com.zoonk.android.feature.activities.twoSignificant
import com.zoonk.android.ui.components.niceTicks
import kotlin.math.abs
import kotlin.math.roundToLong

internal enum class Era { Bce, Ce }

/** A year as written: BCE for negative years, and CE only on an axis that reaches BCE. */
internal fun yearLabel(
    year: Long,
    start: Long,
): Pair<Long, Era?> = if (year < 0) -year to Era.Bce else year to Era.Ce.takeIf { start < 0 }

/** Round years for the axis; there is no year 0. */
internal fun yearTicks(
    start: Long,
    end: Long,
): List<Long> = niceTicks(start.toDouble()..end.toDouble(), TICK_COUNT).filter { it != 0.0 && it % 1.0 == 0.0 }.map { it.toLong() }

/** About a hundredth of the axis, in a round number of years. */
internal fun yearStep(
    start: Long,
    end: Long,
): Long {
    val rough = (end - start).toDouble() / POSITIONS
    return STEPS.firstOrNull { it >= rough } ?: STEPS.last()
}

internal fun snapYear(
    year: Double,
    start: Long,
    end: Long,
): Long {
    val step = yearStep(start, end)
    return (start + ((year - start) / step).roundHalfUp() * step).coerceIn(start, end)
}

/** JavaScript's `Math.round`, which rounds halves up, also below zero. */
private fun Double.roundHalfUp(): Long = kotlin.math.floor(this + 0.5).toLong()

internal fun roundedGap(gap: Long): Long {
    val size = abs(gap)
    return if (size < ROUND_FROM) size else twoSignificant(size.toDouble()).roundToLong()
}

/** Years between two dates; going from BCE to CE skips the missing year 0. */
internal fun yearsBetween(
    first: Long,
    second: Long,
): Long {
    val from = minOf(first, second)
    val to = maxOf(first, second)
    return to - from - if (from < 0 && to > 0) 1 else 0
}

/** Moves labels apart until each is [gap] from the next, keeping them between [top] and [bottom]. */
internal fun spreadLabels(
    positions: List<Float>,
    gap: Float,
    top: Float,
    bottom: Float,
): List<Float> {
    val order = positions.indices.sortedBy { positions[it] }
    val downward = mutableListOf<Float>()
    order.forEach { index -> downward += maxOf(positions[index], top, downward.lastOrNull()?.plus(gap) ?: top) }
    val upward = downward.toMutableList()
    for (index in upward.indices.reversed()) {
        upward[index] = minOf(upward[index], bottom, upward.getOrNull(index + 1)?.minus(gap) ?: bottom)
    }
    val byIndex = order.withIndex().associate { (sorted, index) -> index to upward[sorted] }
    return positions.indices.map { byIndex.getValue(it) }
}

/** Placed events by year, then by when the learner placed them. */
internal fun placedOrder(placements: List<Pair<String, Long>>): List<String> = placements.sortedBy { it.second }.map { it.first }

private const val POSITIONS = 100
private const val TICK_COUNT = 5
private const val ROUND_FROM = 100
private val STEPS = listOf(1L, 2L, 5L, 10L, 20L, 25L, 50L, 100L, 200L, 250L, 500L, 1000L)
