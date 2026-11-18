package com.zoonk.android.feature.activities.geometry

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import kotlin.math.ceil
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
    val guides: List<LabelSegment> = emptyList(),
)

internal fun placeChartLabels(
    area: Rect,
    shown: List<LineLabel>,
    revealed: List<LineLabel>,
    marks: LabelMarks,
    unit: Float,
): List<Rect?> {
    val visibleMarks = marks.copy(lines = shown.map { it.segment }, guides = marks.lines)
    val before = placeLineLabels(area, shown, visibleMarks, unit)
    if (revealed.isEmpty()) return before

    val answerLines = revealed.map { it.segment }
    val checkedMarks = visibleMarks.copy(lines = visibleMarks.lines + answerLines)
    val clearance = CLEARANCE * unit

    fun Rect.needsPlacement(named: LabelSegment) = answerLines.any { touches(it, clearance) } || !belongsWith(named, answerLines)

    val placed = before.mapIndexed { index, box -> box?.takeUnless { it.needsPlacement(shown[index].segment) } }.toMutableList()
    shown.forEachIndexed { index, label ->
        val origin = before[index]
        if (origin != null && placed[index] == null) {
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

    fun Rect.clearsAnswer() =
        left >= area.left && right <= area.right && top >= area.top && bottom <= area.bottom &&
            requiredLines.none { touches(it, clearance) }

    fun Rect.belongsToLine() = belongsWith(label.segment, marks.lines)

    fun Rect.avoidsBoxes() = marks.arrows.none { touches(it, clearance) }

    fun Rect.avoidsMarks() = avoidsBoxes() && marks.circles.none { touches(it, clearance) } && placed.none { touches(it, clearance) }

    val strokes = listOf(label.segment) + marks.lines + marks.guides

    fun Rect.clearsStrokes() = strokes.none { touches(it, clearance) }

    fun Rect.fits() = clearsAnswer() && belongsToLine()

    fun nearby(accepts: (Rect, Offset) -> Boolean): Rect? =
        NEAREST_SHIFTS.firstOrNull { accepts(start.translate(it * step), it) }?.let { start.translate(it * step) }

    val clear =
        nearby { box, shift ->
            (origin != null || shift.getDistance() <= CLEAR_OF_ALL_STEPS) && box.clearsStrokes() && box.avoidsMarks() && box.fits() &&
                marks.guides.all { box.gapTo(label.segment) < box.gapTo(it) }
        }
    if (clear != null) return clear

    val associated = { box: Rect -> box.avoidsMarks() && !box.touches(label.segment, clearance) && box.fits() }
    val close = nearby { box, _ -> associated(box) } ?: spotsAcross(area, start).firstOrNull(associated)
    if (close != null) return close

    val candidates = spotsAcross(area, start, min(unit, step)).filter { it.clearsAnswer() }
    val named = candidates.filter { it.belongsToLine() }
    val offLine = named.firstOrNull { it.avoidsMarks() && !it.touches(label.segment, 0f) }
    if (offLine != null) return offLine
    if (label.isOptional && origin == null) return null

    val owned =
        named.firstOrNull { !it.touches(label.segment, clearance) && it.avoidsBoxes() }
            ?: named.firstOrNull { it.avoidsMarks() }
            ?: named.firstOrNull()
            ?: edgeSpots(area, label.size).firstOrNull { it.fits() }
    if (owned != null) return owned

    if (requiredLines.isEmpty()) return start.takeIf { it.belongsToLine() }

    val sameSide = candidates.filter { box -> requiredLines.all { box.isOnNamedSide(label.segment, it) } }
    val open = sameSide.filter { it.avoidsMarks() }
    return open.ifEmpty { sameSide }.minByOrNull { it.gapTo(label.segment) }
        ?: candidates.firstOrNull { it.clearsStrokes() && it.avoidsMarks() }
        ?: candidates.firstOrNull()
}

private fun spotsAcross(
    area: Rect,
    start: Rect,
    spacing: Float = start.height,
): List<Rect> {
    val spanX = area.width - start.width
    val spanY = area.height - start.height
    if (spanX < 0 || spanY < 0) return emptyList()
    val columns = ceil(spanX / spacing).toInt() + 1
    val rows = ceil(spanY / spacing).toInt() + 1
    return (0 until columns * rows)
        .map {
            val x = area.left + min(spanX, it % columns * spacing)
            val y = area.top + min(spanY, it / columns * spacing)
            Rect(Offset(x, y), start.size)
        }.sortedBy { (it.topLeft - start.topLeft).getDistance() }
}

private fun edgeSpots(
    area: Rect,
    size: Size,
): Sequence<Rect> {
    val right = area.right - size.width
    val bottom = area.bottom - size.height
    if (right < area.left || bottom < area.top) return emptySequence()

    fun along(
        start: Float,
        end: Float,
    ) = (0..ceil((end - start) * 4).toInt()).asSequence().map { min(end, start + it / 4f) }

    return along(area.left, right)
        .flatMap { x -> sequenceOf(Offset(x, area.top), Offset(x, bottom)) }
        .plus(along(area.top, bottom).flatMap { y -> sequenceOf(Offset(area.left, y), Offset(right, y)) })
        .map { Rect(it, size) }
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

private fun LabelSegment.closestPoint(point: Offset): Offset {
    val vector = to - from
    val squared = vector.x * vector.x + vector.y * vector.y
    val delta = point - from
    val along = if (squared == 0f) 0f else ((delta.x * vector.x + delta.y * vector.y) / squared).coerceIn(0f, 1f)
    return from + vector * along
}

private fun LabelSegment.sideOf(point: Offset): Float = (to.x - from.x) * (point.y - from.y) - (to.y - from.y) * (point.x - from.x)

private fun Rect.isOnNamedSide(
    named: LabelSegment,
    line: LabelSegment,
): Boolean = line.sideOf(center) * line.sideOf(named.closestPoint(center)) >= 0f

private fun Rect.separatesName(
    named: LabelSegment,
    line: LabelSegment,
): Boolean {
    val connector = LabelSegment(center, named.closestPoint(center))
    return line.sideOf(connector.from) * line.sideOf(connector.to) < 0f &&
        connector.sideOf(line.from) * connector.sideOf(line.to) < 0f
}

private fun Rect.belongsWith(
    named: LabelSegment,
    lines: List<LabelSegment>,
): Boolean {
    val own = gapTo(named)
    return lines.all { it == named || (own < gapTo(it) && !separatesName(named, it)) }
}

private fun Rect.gapTo(segment: LabelSegment): Float {
    if (touches(segment, 0f)) return 0f
    val pointGap = { point: Offset ->
        Offset(maxOf(left - point.x, 0f, point.x - right), maxOf(top - point.y, 0f, point.y - bottom)).getDistance()
    }
    val corners = listOf(topLeft, topRight, bottomLeft, bottomRight)
    val cornerGap = corners.minOf { corner -> (corner - segment.closestPoint(corner)).getDistance() }
    return minOf(pointGap(segment.from), pointGap(segment.to), cornerGap)
}
