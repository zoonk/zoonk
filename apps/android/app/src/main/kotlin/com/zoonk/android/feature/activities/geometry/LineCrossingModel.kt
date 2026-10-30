package com.zoonk.android.feature.activities.geometry

import com.zoonk.android.feature.activities.PlaceOrientation
import com.zoonk.android.feature.activities.SnapRange
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf15FieldsShift.Direction
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

/** A straight line, y = intercept + slope × x. */
internal data class Line(
    val intercept: Double,
    val slope: Double,
) {
    fun yAt(x: Double) = intercept + slope * x
}

internal enum class Change { Down, Same, Up }

/** Main's `line-crossing-model.ts` with core's `shiftLine` and `crossing`. Offsets are right or up when positive. */
internal object LineCrossingModel {
    fun axis(direction: Direction): PlaceOrientation =
        if (direction == Direction.LEFT || direction == Direction.RIGHT) PlaceOrientation.Horizontal else PlaceOrientation.Vertical

    fun offset(
        direction: Direction,
        amount: Double,
    ): Double = if (direction == Direction.RIGHT || direction == Direction.UP) amount else -amount

    fun direction(
        offset: Double,
        axis: PlaceOrientation,
    ): Direction =
        when (axis) {
            PlaceOrientation.Horizontal -> if (offset > 0) Direction.RIGHT else Direction.LEFT
            PlaceOrientation.Vertical -> if (offset > 0) Direction.UP else Direction.DOWN
        }

    fun moved(
        line: Line,
        offset: Double,
        axis: PlaceOrientation,
    ): Line =
        when (axis) {
            PlaceOrientation.Vertical -> line.copy(intercept = line.intercept + offset)
            PlaceOrientation.Horizontal -> line.copy(intercept = line.intercept - line.slope * offset)
        }

    /** Where two lines cross; the origin for parallel lines, which never do. */
    fun crossing(
        first: Line,
        second: Line,
    ): Vec {
        if (abs(first.slope - second.slope) <= FLOAT_SLACK * max(1.0, abs(second.slope))) return Vec(0.0, 0.0)
        val x = (second.intercept - first.intercept) / (first.slope - second.slope)
        return Vec(x, first.yAt(x))
    }

    /** Four steps per real shift, up to twice it either way. */
    fun range(amount: Double) = SnapRange(min = -amount * 2, max = amount * 2, step = amount / STEPS_PER_SHIFT)

    /** The chart's top right corner: room for every crossing the handles can reach, and a little more. */
    fun domain(
        amount: Double,
        axis: PlaceOrientation,
        first: Line,
        second: Line,
    ): Vec {
        val reach = range(amount).max
        val points =
            listOf(-reach, 0.0, reach).flatMap { offset ->
                listOf(crossing(moved(first, offset, axis), second), crossing(first, moved(second, offset, axis)))
            }
        val x = maxOf(points.maxOf { it.x }, MIN_SPAN)
        val y = maxOf(points.maxOf { it.y }, first.intercept, second.intercept, MIN_SPAN)
        return Vec(x * HEADROOM, y * HEADROOM)
    }

    /** The part of a line inside the chart, from its left end. */
    fun segment(
        line: Line,
        domain: Vec,
    ): Pair<Vec, Vec> {
        if (line.slope == 0.0) return Vec(0.0, line.intercept) to Vec(domain.x, line.intercept)
        val atBottom = -line.intercept / line.slope
        val atTop = (domain.y - line.intercept) / line.slope
        val from = max(0.0, min(atBottom, atTop))
        val to = min(domain.x, max(atBottom, atTop))
        val (start, end) = if (from <= to) from to to else 0.0 to 0.0
        return Vec(start, line.yAt(start)) to Vec(end, line.yAt(end))
    }

    /** The point [share] of the way along a line's visible part. */
    fun along(
        line: Line,
        domain: Vec,
        share: Double,
    ): Vec {
        val (from, to) = segment(line, domain)
        val x = from.x + (to.x - from.x) * share
        return Vec(x, line.yAt(x))
    }

    fun change(
        before: Double,
        after: Double,
    ): Change {
        val slack = max(abs(before), 1.0) * RELATIVE_SLACK
        return when {
            abs(after - before) <= slack -> Change.Same
            after > before -> Change.Up
            else -> Change.Down
        }
    }

    private const val HEADROOM = 1.25
    private const val MIN_SPAN = 1.0
    private const val STEPS_PER_SHIFT = 4
    private const val RELATIVE_SLACK = 1e-9
    private const val FLOAT_SLACK = 1e-9
}
