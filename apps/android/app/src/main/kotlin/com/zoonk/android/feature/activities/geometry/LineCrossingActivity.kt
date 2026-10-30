package com.zoonk.android.feature.activities.geometry

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableDoubleStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.activities.ActivityBadge
import com.zoonk.android.feature.activities.ActivityCanvas
import com.zoonk.android.feature.activities.ActivityCanvasLabel
import com.zoonk.android.feature.activities.ActivityPlaceHandle
import com.zoonk.android.feature.activities.ActivityPlaceTrack
import com.zoonk.android.feature.activities.ActivityProps
import com.zoonk.android.feature.activities.ActivityRenderer
import com.zoonk.android.feature.activities.PlaceOrientation
import com.zoonk.android.feature.activities.numericAnswer
import com.zoonk.android.feature.activities.numericValue
import com.zoonk.android.feature.player.model.ActivityAnswer
import com.zoonk.android.ui.components.LinearScale
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatAmount
import com.zoonk.android.ui.richtext.RichText
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.models.LessonStepAnswerOneOf3AnswerOneOf2
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf15Fields
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf15FieldsLinesInner
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf15FieldsShift.Direction
import kotlin.math.abs
import com.zoonk.api.models.LessonStepAnswerOneOf3Answer.LessonStepAnswerOneOf3AnswerOneOf2Value as CurveShiftAnswerValue
import com.zoonk.api.models.PlayableLibraryStepAnyOfContent.PlayableLibraryStepAnyOfContentOneOf15Value as LineCrossingContent
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOfCheck.PlayableLibraryStepAnyOfContentOneOfCheckOneOf1Value as InteractionCheckValue
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOfCheck.PlayableLibraryStepAnyOfContentOneOfCheckOneOf2Value as NumericCheckValue

val lineCrossingRenderer =
    ActivityRenderer(
        badge = { ActivityBadge(R.string.activities_geometry_badge_move_curve, R.drawable.ic_swap_horiz) },
        canvas = { LineCrossingActivity(it) },
        showsData = { true },
    )

private typealias LineCrossingFields = PlayableLibraryStepAnyOfContentOneOf15Fields
private typealias FieldLine = PlayableLibraryStepAnyOfContentOneOf15FieldsLinesInner

private fun curveShiftAnswer(
    curve: String,
    offset: Double,
    axis: PlaceOrientation,
): ActivityAnswer? {
    if (offset == 0.0) return null
    val direction = LessonStepAnswerOneOf3AnswerOneOf2.Direction.valueOf(LineCrossingModel.direction(offset, axis).name)
    return CurveShiftAnswerValue(LessonStepAnswerOneOf3AnswerOneOf2(curve, direction, LessonStepAnswerOneOf3AnswerOneOf2.Kind.CURVE_SHIFT))
}

private val ActivityAnswer?.curveShift get() = (this as? CurveShiftAnswerValue)?.value

private fun FieldLine.line() = Line(intercept, slope)

/** A curve shift doesn't say how far the line moved, so a given one starts at the real shift's size. */
@Composable
private fun LineCrossingActivity(props: ActivityProps) {
    val content = (props.content as LineCrossingContent).value
    val fields = content.fields
    val (first, second) = fields.lines.takeIf { it.size == 2 } ?: return
    val axis = LineCrossingModel.axis(fields.shift.direction)
    val given = props.answer.curveShift
    var movedId by rememberSaveable { mutableStateOf(given?.curve) }
    var movedBy by rememberSaveable {
        mutableDoubleStateOf(given?.let { LineCrossingModel.offset(Direction.valueOf(it.direction.name), fields.shift.amount) } ?: 0.0)
    }
    val offsetOf = { line: FieldLine -> if (line.id == movedId) movedBy else 0.0 }
    val realOffset = LineCrossingModel.offset(fields.shift.direction, fields.shift.amount)
    val realOffsetOf = { line: FieldLine -> if (line.id == fields.shift.line) realOffset else 0.0 }
    val crossingWith = { offset: (FieldLine) -> Double ->
        LineCrossingModel.crossing(
            LineCrossingModel.moved(first.line(), offset(first), axis),
            LineCrossingModel.moved(second.line(), offset(second), axis),
        )
    }
    val before = crossingWith { 0.0 }
    val after = crossingWith(offsetOf)
    val moved = movedBy != 0.0
    val yChange = LineCrossingModel.change(before.y, after.y)
    val xChange = LineCrossingModel.change(before.x, after.x)
    val shifted = fields.lines.firstOrNull { it.id == fields.shift.line }
    val showsAnswer = props.isChecked && fields.lines.any { offsetOf(it) != realOffsetOf(it) }
    val numeric = content.check as? NumericCheckValue
    val readsX = numeric?.value?.output == "x"
    val changes = "${changeText(fields.yLabel, yChange)}. ${changeText(fields.xLabel, xChange)}."
    val locale = currentLocale()

    fun move(
        line: FieldLine,
        offset: Double,
    ) {
        movedId = line.id
        movedBy = offset
        when (content.check) {
            is InteractionCheckValue -> {
                props.onAnswerChange(curveShiftAnswer(line.id, offset, axis))
            }

            is NumericCheckValue -> {
                val point = crossingWith { if (it.id == line.id) offset else 0.0 }
                props.onAnswerChange(numericAnswer(if (readsX) point.x else point.y))
            }

            else -> {}
        }
    }

    val description =
        listOfNotNull(
            stringResource(R.string.activities_geometry_line_description, first.label, second.label, fields.yLabel, fields.xLabel),
            if (moved) {
                "${movedText(first, offsetOf(first), axis)}. ${movedText(second, offsetOf(second), axis)}. $changes"
            } else {
                stringResource(R.string.activities_geometry_line_unmoved)
            },
            props.expected.numericValue?.takeIf { props.isChecked && numeric != null }?.let {
                stringResource(R.string.activities_geometry_line_new_crossing, formatAmount(it, locale))
            },
        ).joinToString(" ")

    ActivityCanvas(description = description) {
        RichText(fields.change, style = MaterialTheme.typography.bodyMedium.copy(color = MaterialTheme.colorScheme.onSurfaceVariant))

        LineCrossingChart(
            fields = fields,
            axis = axis,
            offsetOf = offsetOf,
            answerLine = shifted?.takeIf { showsAnswer }?.let { LineCrossingModel.moved(it.line(), realOffset, axis) },
            enabled = !props.isLocked,
            valueText = { line -> "${movedText(line, offsetOf(line), axis)}. $changes" },
            onMove = ::move,
        )

        if (moved) {
            Column(Modifier.clearAndSetSemantics {}, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                ChangeRow(fields.yLabel, yChange, isVertical = true)
                ChangeRow(fields.xLabel, xChange, isVertical = false)
            }
        } else {
            ActivityCanvasLabel(stringResource(R.string.activities_geometry_line_hint))
        }

        if (showsAnswer && shifted != null) {
            val feedback =
                when {
                    content.check !is InteractionCheckValue -> null
                    movedId != fields.shift.line || !moved -> fields.feedback.wrongLine
                    LineCrossingModel.direction(movedBy, axis) != fields.shift.direction -> fields.feedback.wrongDirection
                    else -> null
                }
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    "${movedText(shifted, realOffset, axis)}.",
                    color = MaterialTheme.colorScheme.onTertiaryContainer,
                    style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium),
                )
                feedback?.let { RichText(it, style = MaterialTheme.typography.bodyMedium) }
            }
        }
    }
}

private class ChartColors(
    val ink: Color,
    val muted: Color,
    val halo: Color,
    val right: Color,
    val rightText: Color,
    val tones: List<Color>,
)

@Composable
private fun LineCrossingChart(
    fields: LineCrossingFields,
    axis: PlaceOrientation,
    offsetOf: (FieldLine) -> Double,
    answerLine: Line?,
    enabled: Boolean,
    valueText: @Composable (FieldLine) -> String,
    onMove: (FieldLine, Double) -> Unit,
) {
    val density = LocalDensity.current
    val measurer = rememberTextMeasurer()
    val axisStyle = MaterialTheme.typography.labelMedium
    val lineStyle = axisStyle.copy(fontWeight = FontWeight.SemiBold)
    val colors =
        ChartColors(
            ink = MaterialTheme.colorScheme.onSurface,
            muted = MaterialTheme.colorScheme.onSurfaceVariant,
            halo = MaterialTheme.colorScheme.surface,
            right = MaterialTheme.colorScheme.tertiary,
            rightText = MaterialTheme.colorScheme.onTertiaryContainer,
            tones = listOf(MaterialTheme.zoonk.vizHighlight, MaterialTheme.zoonk.vizSecondary),
        )
    val beforeLabel = stringResource(R.string.activities_geometry_line_before)
    val whatHappened = stringResource(R.string.activities_geometry_line_what_happened)
    val amount = fields.shift.amount
    val lines = fields.lines.map { it.line() }
    val domain = LineCrossingModel.domain(amount, axis, lines[0], lines[1])
    val range = LineCrossingModel.range(amount)
    val shown = fields.lines.map { LineCrossingModel.moved(it.line(), offsetOf(it), axis) }
    val movedLines = fields.lines.filter { offsetOf(it) != 0.0 }.map { it.line() }
    val before = LineCrossingModel.crossing(lines[0], lines[1])
    val after = LineCrossingModel.crossing(shown[0], shown[1])
    val band =
        with(density) {
            measurer
                .measure("0", axisStyle)
                .size.height
                .toDp()
        } + AXIS_LABEL_GAP

    BoxWithConstraints(Modifier.fillMaxWidth().height(PLOT_AREA * density.fontScale.coerceIn(1f, MAX_PLOT_GROWTH) + band * 2)) {
        val left = with(density) { PADDING_LEFT.toPx() }
        val right = constraints.maxWidth - with(density) { PADDING_RIGHT.toPx() }
        val top = with(density) { band.toPx() }
        val bottom = constraints.maxHeight - top
        val x = LinearScale(0.0..domain.x, left to right)
        val y = LinearScale(0.0..domain.y, bottom to top)
        val pixel = { point: Vec -> Offset(x.toPixel(point.x), y.toPixel(point.y)) }
        val segment = { line: Line -> LineCrossingModel.segment(line, domain).let { (from, to) -> pixel(from) to pixel(to) } }

        Canvas(Modifier.matchParentSize().clearAndSetSemantics {}) {
            val label = { text: String, color: Color, ends: Pair<Offset, Offset>, upper: Boolean ->
                lineLabel(measurer.measure(text, lineStyle), color, colors.halo, ends, upper, top)
            }
            drawAxes(left, right, top, bottom, colors.ink)
            drawText(measurer.measure(fields.yLabel, axisStyle.copy(color = colors.muted)), topLeft = Offset(left, 0f))
            measurer.measure(fields.xLabel, axisStyle.copy(color = colors.muted)).let {
                drawText(it, topLeft = Offset(right - it.size.width, bottom + AXIS_LABEL_GAP.toPx()))
            }

            clipRect(left, top, right, bottom) {
                movedLines.forEach { drawSegment(segment(it), colors.muted, dashed = true) }
                answerLine?.let { drawSegment(segment(it), colors.right, dashed = true) }
                shown.forEachIndexed { index, line -> drawSegment(segment(line), colors.tones[index], dashed = false) }
            }
            if (movedLines.isNotEmpty()) {
                crossingMark(pixel(before), left, bottom, isBefore = true, colors)
                changeArrows(pixel(before), pixel(after), left, bottom, colors.ink)
            }
            crossingMark(pixel(after), left, bottom, isBefore = false, colors)

            movedLines.forEach { label(beforeLabel, colors.muted, segment(it), false) }
            answerLine?.let { label(whatHappened, colors.rightText, segment(it), false) }
            shown.forEachIndexed { index, line -> label(fields.lines[index].label, colors.tones[index], segment(line), true) }
        }

        val handles =
            fields.lines.map { line ->
                val home = LineCrossingModel.along(line.line(), domain, HANDLE_SHARE)
                val (along, start) = if (axis == PlaceOrientation.Horizontal) x to home.x else y to home.y
                val scale = LinearScale(range.min..range.max, along.toPixel(start + range.min) to along.toPixel(start + range.max))
                val center =
                    if (axis == PlaceOrientation.Horizontal) {
                        Offset(scale.toPixel(offsetOf(line)), y.toPixel(home.y))
                    } else {
                        Offset(x.toPixel(home.x), scale.toPixel(offsetOf(line)))
                    }
                Triple(line, scale, center)
            }
        val reach = with(density) { TRACK_WIDTH.toPx() / 2 }
        handles.forEach { (line, scale, center) ->
            val ends = listOf(scale.toPixel(range.min), scale.toPixel(range.max))
            val track =
                if (axis == PlaceOrientation.Horizontal) {
                    Rect(ends.min(), center.y - reach, ends.max(), center.y + reach)
                } else {
                    Rect(center.x - reach, ends.min(), center.x + reach, ends.max())
                }
            ActivityPlaceTrack(track, scale, range, onChange = { onMove(line, it) }, orientation = axis, disabled = !enabled)
        }
        handles.forEachIndexed { index, (line, scale, center) ->
            ActivityPlaceHandle(
                center = center,
                scale = scale,
                range = range,
                value = offsetOf(line),
                label = stringResource(R.string.activities_geometry_line_move, line.label),
                valueText = valueText(line),
                onChange = { onMove(line, it) },
                orientation = axis,
                disabled = !enabled,
            ) { LineKnob(axis, colors.tones[index], colors.halo) }
        }
    }
}

@Composable
private fun LineKnob(
    axis: PlaceOrientation,
    tone: Color,
    fill: Color,
) {
    Canvas(Modifier.size(KNOB_RADIUS * 2)) {
        drawCircle(fill)
        drawCircle(tone, radius = KNOB_RADIUS.toPx() - KNOB_STROKE.toPx() / 2, style = Stroke(KNOB_STROKE.toPx()))
        val chevron = CHEVRON.toPx()
        val gap = CHEVRON_GAP.toPx()
        val (cx, cy) = center
        val path =
            Path().apply {
                if (axis == PlaceOrientation.Horizontal) {
                    moveTo(cx - gap, cy - chevron)
                    relativeLineTo(-chevron, chevron)
                    relativeLineTo(chevron, chevron)
                    moveTo(cx + gap, cy - chevron)
                    relativeLineTo(chevron, chevron)
                    relativeLineTo(-chevron, chevron)
                } else {
                    moveTo(cx - chevron, cy - gap)
                    relativeLineTo(chevron, -chevron)
                    relativeLineTo(chevron, chevron)
                    moveTo(cx - chevron, cy + gap)
                    relativeLineTo(chevron, chevron)
                    relativeLineTo(chevron, -chevron)
                }
            }
        drawPath(path, tone, style = Stroke(2.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round))
    }
}

/** The chart's x axis reads left to right in every language, so its arrows never mirror. */
@Composable
private fun ChangeRow(
    axisLabel: String,
    change: Change,
    isVertical: Boolean,
) {
    val icon =
        when (change) {
            Change.Same -> R.drawable.ic_remove
            Change.Up -> if (isVertical) R.drawable.ic_arrow_upward else R.drawable.ic_east
            Change.Down -> if (isVertical) R.drawable.ic_arrow_downward else R.drawable.ic_west
        }
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(painterResource(icon), contentDescription = null, modifier = Modifier.size(16.dp))
        Text(changeText(axisLabel, change), style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium))
    }
}

@Composable
private fun changeText(
    axisLabel: String,
    change: Change,
): String =
    stringResource(
        when (change) {
            Change.Down -> R.string.activities_geometry_line_goes_down
            Change.Same -> R.string.activities_geometry_line_stays
            Change.Up -> R.string.activities_geometry_line_goes_up
        },
        axisLabel,
    )

@Composable
private fun movedText(
    line: FieldLine,
    offset: Double,
    axis: PlaceOrientation,
): String =
    stringResource(
        if (offset == 0.0) {
            R.string.activities_geometry_line_unmoved_line
        } else {
            when (LineCrossingModel.direction(offset, axis)) {
                Direction.RIGHT -> R.string.activities_geometry_line_moved_right
                Direction.LEFT -> R.string.activities_geometry_line_moved_left
                Direction.UP -> R.string.activities_geometry_line_moved_up
                Direction.DOWN -> R.string.activities_geometry_line_moved_down
            }
        },
        line.label,
    )

private fun DrawScope.drawAxes(
    left: Float,
    right: Float,
    top: Float,
    bottom: Float,
    ink: Color,
) {
    val path =
        Path().apply {
            moveTo(left, top)
            lineTo(left, bottom)
            lineTo(right, bottom)
        }
    drawPath(path, ink.copy(alpha = AXIS_ALPHA), style = Stroke(1.5.dp.toPx()))
}

private fun DrawScope.drawSegment(
    ends: Pair<Offset, Offset>,
    color: Color,
    dashed: Boolean,
) {
    val dash = LINE_DASH.toPx()
    drawLine(
        color,
        ends.first,
        ends.second,
        (if (dashed) 2.dp else 3.dp).toPx(),
        StrokeCap.Round,
        pathEffect = if (dashed) PathEffect.dashPathEffect(floatArrayOf(dash, dash)) else null,
    )
}

private fun DrawScope.lineLabel(
    text: TextLayoutResult,
    color: Color,
    halo: Color,
    ends: Pair<Offset, Offset>,
    upper: Boolean,
    top: Float,
) {
    val (lower, higher) = if (ends.first.y > ends.second.y) ends else ends.second to ends.first
    val end = if (upper) higher else lower
    val gap = LABEL_GAP.toPx()
    val baseline = maxOf(end.y - gap, top + gap)
    val middle = baseline - text.firstBaseline + text.size.height / 2f
    val inLeftHalf = end.x < size.width / 2
    val at = Offset(if (inLeftHalf) end.x + gap else end.x - gap, middle)
    drawLabel(text, at, color, halo, if (inLeftHalf) LabelAnchor.Start else LabelAnchor.End)
}

private fun DrawScope.crossingMark(
    at: Offset,
    left: Float,
    bottom: Float,
    isBefore: Boolean,
    colors: ChartColors,
) {
    val guide = if (isBefore) colors.muted.copy(alpha = BEFORE_GUIDE_ALPHA) else colors.ink.copy(alpha = AFTER_GUIDE_ALPHA)
    val path =
        Path().apply {
            moveTo(left, at.y)
            lineTo(at.x, at.y)
            lineTo(at.x, bottom)
        }
    val dash = GUIDE_DASH.toPx()
    drawPath(path, guide, style = Stroke(1.5.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(dash, dash))))
    val radius = DOT_RADIUS.toPx()
    if (isBefore) {
        drawCircle(colors.halo, radius, at)
        drawCircle(colors.muted, radius, at, style = Stroke(DOT_STROKE.toPx()))
    } else {
        drawCircle(colors.halo, radius + DOT_STROKE.toPx() / 2, at)
        drawCircle(colors.ink, radius - DOT_STROKE.toPx() / 2, at)
    }
}

private fun DrawScope.changeArrows(
    before: Offset,
    after: Offset,
    left: Float,
    bottom: Float,
    ink: Color,
) {
    val inset = ARROW_OFFSET.toPx()
    val dot = DOT_RADIUS.toPx()
    if (abs(after.y - before.y) > dot) arrow(Offset(left + inset, before.y), Offset(left + inset, after.y), ink)
    if (abs(after.x - before.x) > dot) arrow(Offset(before.x, bottom - inset), Offset(after.x, bottom - inset), ink)
}

private fun DrawScope.arrow(
    from: Offset,
    to: Offset,
    ink: Color,
) {
    val width = 2.dp.toPx()
    drawLine(ink, from, to, width)
    val length = (to - from).getDistance()
    val direction = (to - from) / length
    val back = to - direction * ARROW_HEAD.toPx()
    val side = Offset(-direction.y, direction.x) * (ARROW_HEAD.toPx() * ARROW_SPREAD)
    val head =
        Path().apply {
            moveTo((back + side).x, (back + side).y)
            lineTo(to.x, to.y)
            lineTo((back - side).x, (back - side).y)
        }
    drawPath(head, ink, style = Stroke(width, cap = StrokeCap.Round, join = StrokeJoin.Round))
}

private val PLOT_AREA = 192.dp
private val AXIS_LABEL_GAP = 8.dp
private val PADDING_LEFT = 22.dp
private val PADDING_RIGHT = 18.dp
private val TRACK_WIDTH = 48.dp
private val KNOB_RADIUS = 14.dp
private val KNOB_STROKE = 2.5.dp
private val CHEVRON = 4.dp
private val CHEVRON_GAP = 2.dp
private val LINE_DASH = 5.dp
private val GUIDE_DASH = 3.dp
private val LABEL_GAP = 8.dp
private val DOT_RADIUS = 6.dp
private val DOT_STROKE = 2.dp
private val ARROW_OFFSET = 10.dp
private val ARROW_HEAD = 6.dp
private const val ARROW_SPREAD = 0.6f
private const val MAX_PLOT_GROWTH = 1.5f
private const val HANDLE_SHARE = 0.82
private const val AXIS_ALPHA = 0.4f
private const val BEFORE_GUIDE_ALPHA = 0.5f
private const val AFTER_GUIDE_ALPHA = 0.6f
