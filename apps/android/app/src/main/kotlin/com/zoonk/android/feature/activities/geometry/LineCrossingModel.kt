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

/** Main's `ChartDomain`: the chart's span, from its bottom left [min] to its top right [max]. */
internal data class ChartDomain(
    val min: Vec,
    val max: Vec,
)

/** Main's `chartSlides`: the chart's [domain] and each line's slide, in the lines' order. */
internal class ChartSlides(
    val domain: ChartDomain,
    val slides: List<LineSlide>,
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

    /**
     * Main's `chartDomain`: from the origin to past every crossing the learner can reach, reaching below zero
     * only as far as it takes for the resting and the right crossings to sit inside the handles' margin, with
     * room to spare. [real] is each line's real move.
     */
    private fun domain(
        amount: Double,
        axis: PlaceOrientation,
        lines: List<Line>,
        real: List<Double>,
    ): ChartDomain {
        val (first, second) = lines
        val reach = range(amount).max
        val reachable =
            listOf(-reach, 0.0, reach).flatMap { offset ->
                listOf(crossing(moved(first, offset, axis), second), crossing(first, moved(second, offset, axis)))
            }
        val kept = listOf(crossing(first, second), crossing(moved(first, real[0], axis), moved(second, real[1], axis)))
        val upper = Vec(reachable.maxOf { it.x } * HEADROOM, maxOf(reachable.maxOf { it.y }, first.intercept, second.intercept) * HEADROOM)
        return ChartDomain(Vec(lowerBound(kept.minOf { it.x }, upper.x), lowerBound(kept.minOf { it.y }, upper.y)), upper)
    }

    private fun lowerBound(
        lowest: Double,
        upper: Double,
    ) = min(0.0, (lowest - KEPT_MARGIN * upper) / (1 - KEPT_MARGIN))

    fun slides(
        amount: Double,
        axis: PlaceOrientation,
        lines: List<Line>,
        real: List<Double>,
    ): ChartSlides {
        val domain = domain(amount, axis, lines, real)
        val crossing = crossing(lines[0], lines[1])
        return ChartSlides(domain, lines.map { slide(amount, axis, it, domain, crossing) })
    }

    /** Main's `restoredOffset`: a saved answer keeps only its direction, so its line goes as far as the real move, or the furthest allowed stop that way. */
    fun restoredOffset(
        amount: Double,
        direction: Direction,
        range: SnapRange,
    ) = clamp(offset(direction, amount), range.min, range.max)

    /** The part of a line inside the chart, from its left end. */
    fun segment(
        line: Line,
        domain: ChartDomain,
    ): Pair<Vec, Vec> {
        val (start, end) = spanInside(line, domain.min, domain.max) ?: (0.0 to 0.0)
        return Vec(start, line.yAt(start)) to Vec(end, line.yAt(end))
    }

    /**
     * Main's `lineSlide`: twice the real shift each way, as far as the line still passes through the chart
     * inset by a handle's margin. At each shift the handle rides its moved line, at the point nearest its
     * resting spot inside that inset. It rests 82% along the line, or at the nearest point to that clear of
     * the resting [crossing], kept inside the inset.
     */
    private fun slide(
        amount: Double,
        axis: PlaceOrientation,
        line: Line,
        domain: ChartDomain,
        crossing: Vec,
    ): LineSlide {
        val size = Vec(domain.max.x - domain.min.x, domain.max.y - domain.min.y)
        val low = Vec(domain.min.x + size.x * HANDLE_MARGIN, domain.min.y + size.y * HANDLE_MARGIN)
        val high = Vec(domain.max.x - size.x * HANDLE_MARGIN, domain.max.y - size.y * HANDLE_MARGIN)
        val full = range(amount)
        val count = ((full.max - full.min) / full.step).roundToInt() + 1
        val offsets =
            (0 until count)
                .map { snapToStep(full.min + it * full.step, full) }
                .filter { spanInside(moved(line, it, axis), low, high) != null }
        val visible = spanInside(line, domain.min, domain.max) ?: (0.0 to 0.0)
        val (from, to) = spanInside(line, low, high) ?: visible
        val along = { share: Double -> clamp(visible.first + (visible.second - visible.first) * share, from, to) }
        val isClear = { x: Double -> hypot((x - crossing.x) / size.x, (line.yAt(x) - crossing.y) / size.y) >= CROSSING_GAP }
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
    private const val KEPT_MARGIN = HANDLE_MARGIN * 2
    private val HANDLE_SHARES =
        (0..HANDLE_SHARE_STEPS).map { it.toDouble() / HANDLE_SHARE_STEPS }.sortedBy { abs(it - HANDLE_SHARE) }
    private const val STEPS_PER_SHIFT = 4
    private const val RELATIVE_SLACK = 1e-9
    private const val FLOAT_SLACK = 1e-9
}
