package com.zoonk.android.feature.activities.geometry

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

internal data class LabelCircle(
    val center: Offset,
    val radius: Float,
)

internal data class LabelSegment(
    val from: Offset,
    val to: Offset,
)

internal data class LineLabel(
    val isUpper: Boolean,
    val segment: LabelSegment,
    val size: Size,
)

internal class LabelMarks(
    val circles: List<LabelCircle>,
    val lines: List<LabelSegment>,
    val segments: List<LabelSegment>,
)

/**
 * Main's `line-crossing-labels.ts`. Where each line's name sits, in order: by its end of the line on the
 * open side, or at the nearest spot that clears the lines, the marks (drag handles, crossings, arrows) and
 * the names placed before it. When no spot close by clears every line, it keeps off its own line and the
 * marks, then just off its own line, searching the whole chart when nothing near is free. Its halo never
 * cuts the line it names: with no free spot anywhere it stays by its end, on the line's open side. [unit]
 * is pixels per dp.
 */
internal fun placeLineLabels(
    area: Rect,
    labels: List<LineLabel>,
    marks: LabelMarks,
    unit: Float,
): List<Rect> =
    labels.fold(emptyList()) { placed, label ->
        placed + placeLineLabel(area, label, marks, placed, unit)
    }

private fun placeLineLabel(
    area: Rect,
    label: LineLabel,
    marks: LabelMarks,
    placed: List<Rect>,
    unit: Float,
): Rect {
    val clearance = CLEARANCE * unit
    val start = besideEnd(label, area, unit)
    val step = label.size.height / STEPS_PER_LABEL_HEIGHT

    fun Rect.fits(lines: List<LabelSegment>) =
        left >= area.left && right <= area.right && top >= area.top && bottom <= area.bottom &&
            (listOf(label.segment) + lines).none { touches(it, clearance) }

    fun Rect.clearsMarks() =
        marks.segments.none { touches(it, clearance) } &&
            marks.circles.none { touches(it, clearance) } &&
            placed.none { touches(it, clearance) }

    val isClear = { box: Rect -> box.fits(emptyList()) && box.clearsMarks() }
    val offItsLine = { box: Rect -> box.fits(emptyList()) }
    val passes =
        listOf<(Rect, Offset) -> Boolean>(
            { box, shift -> shift.getDistance() <= CLEAR_OF_ALL_STEPS && box.fits(marks.lines) && box.clearsMarks() },
            { box, _ -> isClear(box) },
            { box, _ -> offItsLine(box) },
        )
    val nearby = passes.firstNotNullOfOrNull { pass -> NEAREST_SHIFTS.firstOrNull { pass(start.translate(it * step), it) } }
    if (nearby != null) return start.translate(nearby * step)

    val spots = spotsAcross(area, start)
    return spots.firstOrNull(isClear) ?: spots.firstOrNull(offItsLine) ?: start
}

private fun spotsAcross(
    area: Rect,
    start: Rect,
): List<Rect> {
    val columns = floor((area.width - start.width) / start.height).toInt() + 1
    val rows = floor((area.height - start.height) / start.height).toInt() + 1
    if (columns < 1 || rows < 1) return emptyList()
    return (0 until columns * rows)
        .map { Rect(Offset(area.left + it % columns * start.height, area.top + it / columns * start.height), start.size) }
        .sortedBy { (it.topLeft - start.topLeft).getDistance() }
}

private fun besideEnd(
    label: LineLabel,
    area: Rect,
    unit: Float,
): Rect {
    val (from, to) = label.segment
    val (lower, upper) = if (from.y > to.y) from to to else to to from
    val end = if (label.isUpper) upper else lower
    val gap = LABEL_GAP * unit
    val left = if (end.x < area.center.x) end.x + gap else end.x - gap - label.size.width
    val top = if (label.isUpper) end.y - gap - label.size.height else end.y + gap
    return Rect(Offset(left, top), label.size)
}

private fun Rect.touches(
    segment: LabelSegment,
    clearance: Float,
): Boolean {
    val (from, to) = segment
    val low = max(top - clearance, min(from.y, to.y))
    val high = min(bottom + clearance, max(from.y, to.y))
    if (low > high) return false
    val xAt = { y: Float -> from.x + (y - from.y) / (to.y - from.y) * (to.x - from.x) }
    val xs = if (from.y == to.y) listOf(from.x, to.x) else listOf(xAt(low), xAt(high))
    return xs.max() >= left - clearance && xs.min() <= right + clearance
}

private fun Rect.touches(
    circle: LabelCircle,
    clearance: Float,
): Boolean {
    val nearest = Offset(circle.center.x.coerceIn(left, right), circle.center.y.coerceIn(top, bottom))
    return (nearest - circle.center).getDistance() < circle.radius + clearance
}

private fun Rect.touches(
    other: Rect,
    clearance: Float,
): Boolean =
    left < other.right + clearance && right > other.left - clearance && top < other.bottom + clearance && bottom > other.top - clearance

private const val LABEL_GAP = 8f
private const val CLEARANCE = 3f
private const val STEPS_PER_LABEL_HEIGHT = 6f
private const val SEARCH_STEPS = 30
private const val CLEAR_OF_ALL_STEPS = 12f

private val NEAREST_SHIFTS =
    (-SEARCH_STEPS..SEARCH_STEPS)
        .flatMap { row -> (-SEARCH_STEPS..SEARCH_STEPS).map { column -> Offset(column.toFloat(), row.toFloat()) } }
        .sortedBy { it.getDistance() }
