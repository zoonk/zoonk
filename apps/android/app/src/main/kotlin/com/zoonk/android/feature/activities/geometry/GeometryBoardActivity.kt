package com.zoonk.android.feature.activities.geometry

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.listSaver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Fill
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalResources
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.activities.ActivityBadge
import com.zoonk.android.feature.activities.ActivityCanvas
import com.zoonk.android.feature.activities.ActivityCanvasLabel
import com.zoonk.android.feature.activities.ActivityProps
import com.zoonk.android.feature.activities.ActivityRenderer
import com.zoonk.android.feature.activities.ActivityTakeaway
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatAmount
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf6Fields.Measure
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf6FieldsPointsInner.Track
import kotlin.math.PI
import kotlin.math.ceil
import kotlin.math.roundToInt
import com.zoonk.api.models.PlayableLibraryStepAnyOfContent.PlayableLibraryStepAnyOfContentOneOf6Value as GeometryBoardContent
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOfCheck.PlayableLibraryStepAnyOfContentOneOfCheckOneOf2Value as NumericCheckValue

val geometryBoardRenderer =
    ActivityRenderer(
        badge = { ActivityBadge(R.string.activities_geometry_badge_drag_corner, R.drawable.ic_open_with) },
        canvas = { GeometryBoardActivity(it) },
    )

private val positionsSaver =
    listSaver<List<Vec>, Double>(
        save = { points -> points.flatMap { listOf(it.x, it.y) } },
        restore = { values -> values.chunked(2) { (x, y) -> Vec(x, y) } },
    )

@Composable
private fun GeometryBoardActivity(props: ActivityProps) {
    val content = (props.content as GeometryBoardContent).value
    val fields = content.fields
    val start = fields.points.map { Vec(it.x, it.y) }
    val corners = fields.points.map { BoardCorner(it.movable, it.track) }
    var points by rememberSaveable(stateSaver = positionsSaver) { mutableStateOf(start) }
    val step = BoardGeometry.gridStep(start)
    val bounds = BoardGeometry.bounds(fields.measure, start, step)
    val hideTotal = content.check is NumericCheckValue && !props.isChecked
    val reading = readBoard(points, fields.measure)
    val summary = describeBoard(fields.measure, reading, hideTotal)
    val moved = points != start

    fun moveTo(
        index: Int,
        to: Vec,
    ) {
        BoardGeometry
            .moveCorner(corners, points, index, to, bounds, fields.measure, BoardGeometry.minimumArea(start), step)
            ?.let { points = it }
    }

    val description =
        listOf(
            pluralStringResource(R.plurals.activities_geometry_board_shape, points.size, points.size),
            pluralStringResource(R.plurals.activities_geometry_board_moving, corners.count { it.movable }, corners.count { it.movable }),
            summary,
        ).filter { it.isNotEmpty() }.joinToString(" ")

    ActivityCanvas(description = description) {
        BoardDrawing(
            points = points,
            start = start,
            corners = corners,
            names = fields.points.mapIndexed { index, point -> point.label ?: ('A' + index).toString() },
            labels = fields.points.map { it.label },
            measure = fields.measure,
            reading = reading,
            hideTotal = hideTotal,
            bounds = bounds,
            step = step,
            summary = summary,
            enabled = !props.isLocked,
            onMoveTo = ::moveTo,
        )
        if (!props.isChecked) {
            ActivityCanvasLabel(stringResource(R.string.activities_geometry_board_hint))
        }
        BoardSummary(fields.measure, reading, hideTotal, isAnswer = content.check is NumericCheckValue && props.isChecked)
        if (!props.isChecked && moved) {
            OutlinedButton(
                onClick = { points = start },
                enabled = !props.isLocked,
                modifier = Modifier.heightIn(min = 48.dp),
                contentPadding = ButtonDefaults.ButtonWithIconContentPadding,
            ) {
                Icon(
                    painterResource(R.drawable.ic_restart_alt),
                    contentDescription = null,
                    modifier = Modifier.size(ButtonDefaults.IconSize),
                )
                Text(stringResource(R.string.activities_geometry_board_back_to_start), Modifier.padding(start = ButtonDefaults.IconSpacing))
            }
        }
        if (props.isChecked) ActivityTakeaway(fields.invariant)
    }
}

@Composable
private fun BoardDrawing(
    points: List<Vec>,
    start: List<Vec>,
    corners: List<BoardCorner>,
    names: List<String>,
    labels: List<String?>,
    measure: Measure,
    reading: BoardReading,
    hideTotal: Boolean,
    bounds: BoardBounds,
    step: Double,
    summary: String,
    enabled: Boolean,
    onMoveTo: (Int, Vec) -> Unit,
) {
    val density = LocalDensity.current
    val locale = currentLocale()
    val resources = LocalResources.current
    val measurer = rememberTextMeasurer()
    val style =
        MaterialTheme.typography.labelLarge
            .withTabularFigures()
            .copy(fontWeight = FontWeight.SemiBold)
    val ink = MaterialTheme.colorScheme.onSurface
    val muted = MaterialTheme.colorScheme.onSurfaceVariant
    val grid = MaterialTheme.colorScheme.outlineVariant
    val halo = MaterialTheme.colorScheme.surface
    val tones = boardTones()
    val unit = if (measure == Measure.ANGLE_SUM) "°" else null

    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val scale =
            with(density) { BoardScale(bounds, maxWidth.toPx(), MAX_HEIGHT.toPx(), PADDING.toPx().toDouble()) }
        val pixels = points.map { scale.toPixel(it).offset() }
        val movable = corners.indices.filter { corners[it].movable }
        val nearest = { at: Offset -> movable.minByOrNull { (pixels[it] - at).getDistance() } }

        PointDragArea(
            enabled = enabled,
            pick = { at -> nearest(at)?.takeIf { at.reaches(pixels[it], density) } },
            onDrag = { index, at -> onMoveTo(index, scale.toData(at.vec())) },
            onTap = { at -> nearest(at)?.let { onMoveTo(it, scale.toData(at.vec())) } },
            modifier = Modifier.fillMaxWidth().height(with(density) { scale.height.toDp() }),
        ) {
            Canvas(Modifier.matchParentSize().clearAndSetSemantics {}) {
                val label = { text: String -> measurer.measure(text, style) }
                drawGrid(bounds, step, scale, grid)
                if (enabled) {
                    corners.forEachIndexed { index, corner ->
                        if (corner.movable && corner.track != null) drawTrack(bounds, points[index], corner.track, scale, muted)
                    }
                }
                when (measure) {
                    Measure.PYTHAGORAS -> {
                        drawSquares(points, reading, hideTotal, scale, tones, halo) { label(formatAmount(it, locale)) }
                    }

                    Measure.AREA -> {
                        drawPath(polygon(pixels), tones.accent.soft)
                    }

                    else -> {}
                }
                if (points != start) {
                    drawPath(
                        polygon(start.map { scale.toPixel(it).offset() }),
                        muted.copy(alpha = START_ALPHA),
                        style = Stroke(1.5.dp.toPx(), join = StrokeJoin.Round, pathEffect = dashes(4.dp.toPx(), 4.dp.toPx())),
                    )
                }
                drawPath(polygon(pixels), ink.copy(alpha = SHAPE_FILL_ALPHA))
                drawPath(polygon(pixels), ink, style = Stroke(2.dp.toPx(), join = StrokeJoin.Round))
                when (measure) {
                    Measure.ANGLE_SUM -> {
                        drawAngleWedges(pixels, reading, tones, halo) { label(formatAmount(it, locale, unit)) }
                    }

                    Measure.PERIMETER -> {
                        val middle = centroid(pixels.map { it.vec() })
                        pixels.forEachIndexed { index, pixel ->
                            val next = pixels[(index + 1) % pixels.size]
                            val midpoint = Vec((pixel.x + next.x) / 2.0, (pixel.y + next.y) / 2.0)
                            val at = awayFromMiddle(midpoint, middle, SIDE_LABEL_GAP.toPx().toDouble()).offset()
                            drawLabel(label(formatAmount(reading.parts.getOrElse(index) { 0.0 }, locale)), at, ink, halo)
                        }
                    }

                    else -> {}
                }
                val middle = centroid(pixels.map { it.vec() })
                pixels.forEachIndexed { index, pixel ->
                    labels[index]?.let {
                        drawLabel(label(it), awayFromMiddle(pixel.vec(), middle, CORNER_LABEL_GAP.toPx().toDouble()).offset(), ink, halo)
                    }
                    if (!corners[index].movable) {
                        drawCircle(halo, FIXED_RADIUS.toPx(), pixel)
                        drawCircle(ink, FIXED_RADIUS.toPx(), pixel, style = Stroke(2.dp.toPx()))
                    }
                }
            }

            movable.forEach { index ->
                val corner = corners[index]
                val moves =
                    listOf(
                        R.string.activities_geometry_board_move_left to Vec(-step, 0.0),
                        R.string.activities_geometry_board_move_right to Vec(step, 0.0),
                        R.string.activities_geometry_board_move_up to Vec(0.0, step),
                        R.string.activities_geometry_board_move_down to Vec(0.0, -step),
                    ).filter { (_, offset) ->
                        when (corner.track) {
                            Track.HORIZONTAL -> offset.y == 0.0
                            Track.VERTICAL -> offset.x == 0.0
                            null -> true
                        }
                    }
                val point = points[index]
                PointHandle(
                    center = pixels[index],
                    label = stringResource(R.string.activities_geometry_board_corner, names[index]),
                    value =
                        stringResource(
                            R.string.activities_geometry_board_corner_value,
                            formatAmount(point.x, locale),
                            formatAmount(point.y, locale),
                            summary,
                        ),
                    enabled = enabled,
                    onKey = { key ->
                        BoardGeometry.keyOffset(key, step, corner.track)?.let { onMoveTo(index, point + it) } != null
                    },
                    actions = {
                        customActions =
                            moves.map { (name, offset) ->
                                CustomAccessibilityAction(resources.getString(name)) {
                                    onMoveTo(index, point + offset)
                                    true
                                }
                            }
                    },
                )
            }
        }
    }
}

/** Main's `BoardSummary`: the corners torn off and put side by side, then the parts adding up to the total. */
@Composable
private fun BoardSummary(
    measure: Measure,
    reading: BoardReading,
    hideTotal: Boolean,
    isAnswer: Boolean,
) {
    val locale = currentLocale()
    val tones = boardTones()
    val unit = if (measure == Measure.ANGLE_SUM) "°" else null
    val style =
        MaterialTheme.typography.headlineSmall
            .withTabularFigures()
            .copy(fontWeight = FontWeight.Medium)
    val totalColor =
        when {
            isAnswer -> MaterialTheme.colorScheme.tertiary
            measure == Measure.PYTHAGORAS -> tones.highlight.ink
            else -> MaterialTheme.colorScheme.onSurface
        }

    Column(Modifier.clearAndSetSemantics {}, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (measure == Measure.ANGLE_SUM && !hideTotal && reading.parts.size <= QUADRILATERAL_CORNERS) AngleFan(reading, tones)

        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), itemVerticalAlignment = Alignment.CenterVertically) {
            if (measure == Measure.AREA) {
                Text(
                    stringResource(R.string.activities_geometry_board_area),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.titleMedium,
                )
            } else {
                reading.parts.forEachIndexed { index, part ->
                    if (index > 0) Text(PLUS, style = style)
                    Text(formatAmount(part, locale, unit), color = partTone(index, measure, reading, tones).ink, style = style)
                }
                Text(EQUALS, style = style)
            }
            if (hideTotal) {
                UnknownTotal(style)
            } else {
                Text(formatAmount(reading.total, locale, unit), color = totalColor, style = style)
            }
        }
    }
}

@Composable
private fun UnknownTotal(style: androidx.compose.ui.text.TextStyle) {
    val border = MaterialTheme.colorScheme.outline
    Text(
        UNKNOWN,
        modifier =
            Modifier
                .drawBehind {
                    drawRoundRect(
                        border,
                        cornerRadius = CornerRadius(8.dp.toPx()),
                        style = Stroke(1.dp.toPx(), pathEffect = dashes(4.dp.toPx(), 3.dp.toPx())),
                    )
                }.padding(horizontal = 8.dp),
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        style = style,
    )
}

/** Main's `AngleFan`: a triangle's corners fill a straight line, a four-sided shape's a full turn. */
@Composable
private fun AngleFan(
    reading: BoardReading,
    tones: BoardTones,
) {
    val isTriangle = reading.parts.size == TRIANGLE_CORNERS
    val ink = MaterialTheme.colorScheme.onSurface
    val height = if (isTriangle) FAN_RADIUS + FAN_PADDING * 2 else FAN_RADIUS * 2 + FAN_PADDING * 2

    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        ActivityCanvasLabel(stringResource(R.string.activities_geometry_board_fan))
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Bottom) {
            Canvas(Modifier.size(FAN_WIDTH, height)) {
                val center = Offset(size.width / 2, (FAN_RADIUS + FAN_PADDING).toPx())
                val radius = FAN_RADIUS.toPx()
                fanWedges(reading.parts).forEachIndexed { index, wedge ->
                    drawWedge(center, radius, wedge, tones.corner(index, reading.parts.size), stroke = 1.5.dp.toPx())
                }
                if (isTriangle) {
                    val padding = FAN_PADDING.toPx()
                    drawLine(ink, Offset(padding, center.y), Offset(size.width - padding, center.y), 2.dp.toPx(), StrokeCap.Round)
                }
            }
            ActivityCanvasLabel(
                stringResource(
                    if (isTriangle) R.string.activities_geometry_board_straight_line else R.string.activities_geometry_board_full_turn,
                ),
                Modifier.padding(bottom = 4.dp),
            )
        }
    }
}

@Composable
private fun describeBoard(
    measure: Measure,
    reading: BoardReading,
    hideTotal: Boolean,
): String {
    val locale = currentLocale()
    val unit = if (measure == Measure.ANGLE_SUM) "°" else null
    val parts = reading.parts.joinToString(", ") { formatAmount(it, locale, unit) }
    val total = formatAmount(reading.total, locale, unit)
    return when (measure) {
        Measure.ANGLE_SUM -> {
            if (hideTotal) {
                stringResource(R.string.activities_geometry_board_angles, parts)
            } else {
                stringResource(R.string.activities_geometry_board_angles_total, parts, total)
            }
        }

        Measure.PERIMETER -> {
            if (hideTotal) {
                stringResource(R.string.activities_geometry_board_sides, parts)
            } else {
                stringResource(R.string.activities_geometry_board_sides_total, parts, total)
            }
        }

        Measure.AREA -> {
            if (hideTotal) "" else stringResource(R.string.activities_geometry_board_area_total, total)
        }

        Measure.PYTHAGORAS -> {
            if (hideTotal) {
                stringResource(R.string.activities_geometry_board_squares, parts)
            } else {
                stringResource(R.string.activities_geometry_board_squares_total, parts, total)
            }
        }
    }
}

/** Main's `BOARD_TONES`: a series color, its soft fill for marks, and its ink for numbers. */
private class BoardTone(
    val ink: Color,
    val soft: Color,
)

private class BoardTones(
    val accent: BoardTone,
    val highlight: BoardTone,
    val secondary: BoardTone,
    val neutral: BoardTone,
) {
    /** Main's `cornerTone`: the series in order, never ending on the first one's color beside it. */
    fun corner(
        index: Int,
        count: Int,
    ): BoardTone {
        val sequence = listOf(accent, highlight, secondary, neutral)
        val wrapsOntoFirst = index == count - 1 && index % sequence.size == 0 && index > 0
        return if (wrapsOntoFirst) secondary else sequence[index % sequence.size]
    }

    /** Main's `squareTone`: the longest side's square stands out, the two others differ. */
    fun square(
        index: Int,
        totalIndex: Int?,
    ): BoardTone =
        when {
            index == totalIndex -> highlight
            index == 0 || (totalIndex == 0 && index == 1) -> accent
            else -> secondary
        }
}

@Composable
private fun boardTones(): BoardTones {
    val tone = { color: Color -> BoardTone(ink = color, soft = color.copy(alpha = SOFT_ALPHA)) }
    return BoardTones(
        accent = tone(MaterialTheme.zoonk.vizAccent),
        highlight = tone(MaterialTheme.zoonk.vizHighlight),
        secondary = tone(MaterialTheme.zoonk.vizSecondary),
        neutral =
            BoardTone(
                ink = MaterialTheme.colorScheme.onSurface,
                soft = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = SOFT_ALPHA),
            ),
    )
}

private fun partTone(
    index: Int,
    measure: Measure,
    reading: BoardReading,
    tones: BoardTones,
): BoardTone =
    when (measure) {
        Measure.PYTHAGORAS -> tones.square(reading.partIndexes.getOrElse(index) { index }, reading.totalIndex)
        Measure.ANGLE_SUM -> tones.corner(index, reading.parts.size)
        else -> tones.neutral
    }

private fun DrawScope.drawGrid(
    bounds: BoardBounds,
    step: Double,
    scale: BoardScale,
    color: Color,
) {
    val topLeft = scale.toPixel(Vec(bounds.minX, bounds.maxY)).offset()
    val bottomRight = scale.toPixel(Vec(bounds.maxX, bounds.minY)).offset()
    val width = 1.dp.toPx()
    gridValues(bounds.minX, bounds.maxX, step).forEach { x ->
        val px = scale.toPixel(Vec(x, 0.0)).x.toFloat()
        drawLine(color, Offset(px, topLeft.y), Offset(px, bottomRight.y), width)
    }
    gridValues(bounds.minY, bounds.maxY, step).forEach { y ->
        val py = scale.toPixel(Vec(0.0, y)).y.toFloat()
        drawLine(color, Offset(topLeft.x, py), Offset(bottomRight.x, py), width)
    }
}

/** Every grid line, or every few on a fine grid, so there are never more than main's 24. */
private fun gridValues(
    from: Double,
    to: Double,
    step: Double,
): List<Double> {
    val count = ((to - from) / step).roundToInt()
    val every = ceil((count + 1).toDouble() / MAX_GRID_LINES).toInt()
    return (0..count).filter { it % every == 0 }.map { from + it * step }
}

private fun DrawScope.drawTrack(
    bounds: BoardBounds,
    point: Vec,
    track: Track,
    scale: BoardScale,
    muted: Color,
) {
    val (from, to) =
        when (track) {
            Track.HORIZONTAL -> Vec(bounds.minX, point.y) to Vec(bounds.maxX, point.y)
            Track.VERTICAL -> Vec(point.x, bounds.minY) to Vec(point.x, bounds.maxY)
        }
    drawLine(
        muted.copy(alpha = TRACK_ALPHA),
        scale.toPixel(from).offset(),
        scale.toPixel(to).offset(),
        1.5.dp.toPx(),
        pathEffect = dashes(4.dp.toPx(), 5.dp.toPx()),
    )
}

private fun DrawScope.drawSquares(
    points: List<Vec>,
    reading: BoardReading,
    hideTotal: Boolean,
    scale: BoardScale,
    tones: BoardTones,
    halo: Color,
    measure: (Double) -> TextLayoutResult,
) {
    BoardGeometry.sideSquares(points).forEachIndexed { index, square ->
        val tone = tones.square(index, reading.totalIndex)
        val pixels = square.map { scale.toPixel(it).offset() }
        drawPath(polygon(pixels), tone.soft.copy(alpha = SOFT_ALPHA * SQUARE_SHARE))
        drawPath(polygon(pixels), tone.ink, style = Stroke(1.5.dp.toPx()))
        val isTotal = index == reading.totalIndex
        val at = centroid(pixels.map { it.vec() }).offset()
        val text =
            if (isTotal &&
                hideTotal
            ) {
                null
            } else {
                measure(if (isTotal) reading.total else reading.parts.getOrElse(reading.partIndexes.indexOf(index)) { 0.0 })
            }
        text?.let { drawLabel(it, at, tone.ink, halo) }
    }
}

private fun DrawScope.drawAngleWedges(
    pixels: List<Offset>,
    reading: BoardReading,
    tones: BoardTones,
    halo: Color,
    measure: (Double) -> TextLayoutResult,
) {
    val points = pixels.map { it.vec() }
    val angles = BoardGeometry.interiorAngles(points)
    points.forEachIndexed { index, corner ->
        val previous = points[Math.floorMod(index - 1, points.size)]
        val next = points[(index + 1) % points.size]
        val shortest = minOf((previous - corner).length(), (next - corner).length())
        val radius = (shortest * WEDGE_SHARE).coerceIn(MIN_WEDGE_RADIUS.toPx().toDouble(), WEDGE_RADIUS.toPx().toDouble())
        val (wedge, labelAt) = cornerWedge(angles[index], corner, next, previous, radius, ANGLE_LABEL_GAP.toPx().toDouble())
        val tone = tones.corner(index, points.size)
        drawWedge(corner.offset(), radius.toFloat(), wedge, tone, stroke = 1.5.dp.toPx())
        drawLabel(measure(reading.parts.getOrElse(index) { 0.0 }), labelAt.offset(), tone.ink, halo)
    }
}

private fun DrawScope.drawWedge(
    center: Offset,
    radius: Float,
    wedge: Wedge,
    tone: BoardTone,
    stroke: Float,
) {
    val topLeft = center - Offset(radius, radius)
    val size = Size(radius * 2, radius * 2)
    val start = (wedge.from * HALF_TURN / PI).toFloat()
    val sweep = (wedge.sweep * HALF_TURN / PI).toFloat()
    drawArc(tone.soft, start, sweep, useCenter = true, topLeft = topLeft, size = size, style = Fill)
    drawArc(tone.ink, start, sweep, useCenter = true, topLeft = topLeft, size = size, style = Stroke(stroke, join = StrokeJoin.Round))
}

private fun polygon(pixels: List<Offset>) =
    Path().apply {
        pixels.forEachIndexed { index, pixel -> if (index == 0) moveTo(pixel.x, pixel.y) else lineTo(pixel.x, pixel.y) }
        close()
    }

private fun dashes(
    dash: Float,
    gap: Float,
) = PathEffect.dashPathEffect(floatArrayOf(dash, gap))

private fun Vec.offset() = Offset(x.toFloat(), y.toFloat())

private fun Offset.vec() = Vec(x.toDouble(), y.toDouble())

private fun Vec.length() = kotlin.math.hypot(x, y)

private val MAX_HEIGHT = 340.dp
private val PADDING = 20.dp
private val FIXED_RADIUS = 5.5.dp
private val CORNER_LABEL_GAP = 30.dp
private val SIDE_LABEL_GAP = 14.dp
private val ANGLE_LABEL_GAP = 14.dp
private val WEDGE_RADIUS = 26.dp
private val MIN_WEDGE_RADIUS = 12.dp
private val FAN_RADIUS = 44.dp
private val FAN_WIDTH = 180.dp
private val FAN_PADDING = 6.dp
private const val WEDGE_SHARE = 0.35
private const val MAX_GRID_LINES = 24
private const val TRIANGLE_CORNERS = 3
private const val QUADRILATERAL_CORNERS = 4
private const val HALF_TURN = 180.0
private const val SOFT_ALPHA = 0.22f
private const val SQUARE_SHARE = 0.7f
private const val SHAPE_FILL_ALPHA = 0.03f
private const val START_ALPHA = 0.7f
private const val TRACK_ALPHA = 0.6f
private const val PLUS = "+"
private const val EQUALS = "="
private const val UNKNOWN = "?"
