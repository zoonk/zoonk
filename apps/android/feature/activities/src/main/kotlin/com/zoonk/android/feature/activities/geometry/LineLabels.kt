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
    val isOptional: Boolean = false,
)

internal data class LabelMarks(
    val arrows: List<Rect>,
    val circles: List<LabelCircle>,
    val lines: List<LabelSegment>,
)

internal fun placeChartLabels(
    area: Rect,
    shown: List<LineLabel>,
    revealed: List<LineLabel>,
    marks: LabelMarks,
    unit: Float,
): List<Rect?> {
    val visibleMarks = marks.copy(lines = marks.lines + shown.map { it.segment })
    val before = placeLineLabels(area, shown, visibleMarks, unit)
    if (revealed.isEmpty()) return before

    val answerLines = revealed.map { it.segment }
    val checkedMarks = visibleMarks.copy(lines = visibleMarks.lines + answerLines)
    val clearance = CLEARANCE * unit

    fun Rect.crossesAnswer() = answerLines.any { touches(it, clearance) }

    val placed = before.map { box -> box?.takeUnless { it.crossesAnswer() } }.toMutableList()
    shown.forEachIndexed { index, label ->
        val origin = before[index]
        if (origin != null && origin.crossesAnswer()) {
            placed[index] = placeLineLabel(area, label, checkedMarks, placed.filterNotNull(), unit, origin, answerLines)
        }
    }

    return placed + placeLineLabels(area, revealed, checkedMarks, unit, placed.filterNotNull(), answerLines)
}

/** Places measured labels in order. [unit] is pixels per dp. */
internal fun placeLineLabels(
    area: Rect,
    labels: List<LineLabel>,
    marks: LabelMarks,
    unit: Float,
    placed: List<Rect> = emptyList(),
    requiredLines: List<LabelSegment> = emptyList(),
): List<Rect?> =
    labels.fold(emptyList()) { boxes, label ->
        boxes + placeLineLabel(area, label, marks, placed + boxes.filterNotNull(), unit, requiredLines = requiredLines)
    }

private fun placeLineLabel(
    area: Rect,
    label: LineLabel,
    marks: LabelMarks,
    placed: List<Rect>,
    unit: Float,
    origin: Rect? = null,
    requiredLines: List<LabelSegment>,
): Rect? {
    val clearance = CLEARANCE * unit
    val start = origin ?: besideEnd(label, area, unit)
    val step = label.size.height / STEPS_PER_LABEL_HEIGHT

    fun Rect.clearsRequired() =
        left >= area.left && right <= area.right && top >= area.top && bottom <= area.bottom &&
            requiredLines.none { touches(it, clearance) }

    fun Rect.fits(lines: List<LabelSegment>) =
        clearsRequired() && !touches(label.segment, clearance) && lines.none { touches(it, clearance) } &&
            marks.arrows.none { touches(it, clearance) }

    fun Rect.isNearestItsLine(): Boolean {
        val own = gapTo(label.segment)
        return marks.lines.all { it == label.segment || own < gapTo(it) }
    }

    fun Rect.clearsMarks() =
        marks.circles.none { touches(it, clearance) } &&
            placed.none { touches(it, clearance) }

    val clearsAll = { box: Rect -> box.fits(marks.lines) && box.clearsMarks() }
    val offItsLine = { box: Rect -> box.fits(emptyList()) && box.isNearestItsLine() }
    val isClear = { box: Rect -> offItsLine(box) && box.clearsMarks() }

    fun nearby(accepts: (Rect, Offset) -> Boolean): Rect? =
        NEAREST_SHIFTS.firstOrNull { accepts(start.translate(it * step), it) }?.let { start.translate(it * step) }

    val spots = spotsAcross(area, start)
    val clear =
        nearby { box, shift ->
            (origin != null || shift.getDistance() <= CLEAR_OF_ALL_STEPS) && clearsAll(box) && box.isNearestItsLine()
        } ?: nearby { box, _ -> isClear(box) } ?: spots.firstOrNull(isClear)
    if (clear != null || (label.isOptional && origin == null)) return clear

    return nearby { box, _ -> clearsAll(box) } ?: spots.firstOrNull(clearsAll)
        ?: nearby { box, _ -> offItsLine(box) } ?: spots.firstOrNull(offItsLine)
        ?: if (requiredLines.isEmpty()) {
            start
        } else {
            nearby { box, _ -> box.clearsRequired() } ?: spots.firstOrNull { it.clearsRequired() }
        }
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
    val end = upper
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

private fun Rect.gapTo(segment: LabelSegment): Float {
    if (touches(segment, 0f)) return 0f
    val pointGap = { point: Offset ->
        Offset(maxOf(left - point.x, 0f, point.x - right), maxOf(top - point.y, 0f, point.y - bottom)).getDistance()
    }
    val vector = segment.to - segment.from
    val squared = vector.x * vector.x + vector.y * vector.y
    val corners = listOf(topLeft, topRight, bottomLeft, bottomRight)
    val cornerGap =
        corners.minOf { corner ->
            val delta = corner - segment.from
            val along = if (squared == 0f) 0f else ((delta.x * vector.x + delta.y * vector.y) / squared).coerceIn(0f, 1f)
            (corner - (segment.from + vector * along)).getDistance()
        }
    return minOf(pointGap(segment.from), pointGap(segment.to), cornerGap)
}
