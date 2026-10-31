package com.zoonk.android.feature.activities.geometry

import com.zoonk.android.feature.activities.PlaceOrientation
import com.zoonk.android.feature.activities.SnapRange
import com.zoonk.android.feature.activities.clamp
import com.zoonk.android.feature.activities.snapToStep
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf15FieldsShift.Direction
import kotlin.math.abs
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

internal data class Line(
    val intercept: Double,
    val slope: Double,
) {
    fun yAt(x: Double) = intercept + slope * x
}

internal enum class Change { Down, Same, Up }

/** Main's `LineSlide`: the shifts a line's handle can take, as [offsets] and as a [range], and where the handle sits [at] each. */
internal class LineSlide(
    val offsets: List<Double>,
    val range: SnapRange,
    val at: (Double) -> Vec,
)

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
        val (start, end) = spanInside(line, Vec(0.0, 0.0), domain) ?: (0.0 to 0.0)
        return Vec(start, line.yAt(start)) to Vec(end, line.yAt(end))
    }

    /**
     * Main's `lineSlide`: twice the real shift each way, as far as the line still passes through the chart
     * inset by a handle's margin. At each shift the handle rides its moved line, at the point nearest its
     * resting spot inside that inset. It rests 82% along the line, or at the nearest point to that clear of
     * the resting [crossing], kept inside the inset.
     */
    fun slide(
        amount: Double,
        axis: PlaceOrientation,
        line: Line,
        domain: Vec,
        crossing: Vec,
    ): LineSlide {
        val low = Vec(domain.x * HANDLE_MARGIN, domain.y * HANDLE_MARGIN)
        val high = Vec(domain.x - low.x, domain.y - low.y)
        val full = range(amount)
        val count = ((full.max - full.min) / full.step).roundToInt() + 1
        val offsets =
            (0 until count)
                .map { snapToStep(full.min + it * full.step, full) }
                .filter { spanInside(moved(line, it, axis), low, high) != null }
        val visible = spanInside(line, Vec(0.0, 0.0), domain) ?: (0.0 to 0.0)
        val (from, to) = spanInside(line, low, high) ?: visible
        val along = { share: Double -> clamp(visible.first + (visible.second - visible.first) * share, from, to) }
        val isClear = { x: Double -> hypot((x - crossing.x) / domain.x, (line.yAt(x) - crossing.y) / domain.y) >= CROSSING_GAP }
        val homeX = along(HANDLE_SHARES.firstOrNull { isClear(along(it)) } ?: HANDLE_SHARE)
        return LineSlide(offsets, SnapRange(offsets.min(), offsets.max(), full.step)) { offset ->
            val shifted = moved(line, offset, axis)
            val preferred = if (axis == PlaceOrientation.Horizontal) homeX + offset else homeX
            val x = spanInside(shifted, low, high)?.let { (start, end) -> clamp(preferred, start, end) } ?: preferred
            Vec(x, shifted.yAt(x))
        }
    }

    private fun spanInside(
        line: Line,
        low: Vec,
        high: Vec,
    ): Pair<Double, Double>? {
        if (line.slope == 0.0) return (low.x to high.x).takeIf { line.intercept in low.y..high.y }
        val atLow = (low.y - line.intercept) / line.slope
        val atHigh = (high.y - line.intercept) / line.slope
        val from = max(low.x, min(atLow, atHigh))
        val to = min(high.x, max(atLow, atHigh))
        return (from to to).takeIf { from <= to }
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
    private const val HANDLE_SHARE = 0.82
    private const val HANDLE_SHARE_STEPS = 100

    // Main's shares of the chart that fit a whole handle, and its gap from a crossing dot, on the smallest plot
    // (192dp), so a slide never depends on the screen's size.
    private const val HANDLE_MARGIN = 0.08
    private const val CROSSING_GAP = 0.135
    private val HANDLE_SHARES =
        (0..HANDLE_SHARE_STEPS).map { it.toDouble() / HANDLE_SHARE_STEPS }.sortedBy { abs(it - HANDLE_SHARE) }
    private const val MIN_SPAN = 1.0
    private const val STEPS_PER_SHIFT = 4
    private const val RELATIVE_SLACK = 1e-9
    private const val FLOAT_SLACK = 1e-9
}
