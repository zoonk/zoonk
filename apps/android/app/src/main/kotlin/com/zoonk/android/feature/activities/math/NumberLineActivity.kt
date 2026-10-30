package com.zoonk.android.feature.activities.math

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.compositeOver
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.activities.ActivityBadge
import com.zoonk.android.feature.activities.ActivityCanvas
import com.zoonk.android.feature.activities.ActivityPlaceHandle
import com.zoonk.android.feature.activities.ActivityPlaceTrack
import com.zoonk.android.feature.activities.ActivityProps
import com.zoonk.android.feature.activities.ActivityReadout
import com.zoonk.android.feature.activities.ActivityRenderer
import com.zoonk.android.feature.activities.SnapRange
import com.zoonk.android.feature.activities.clamp
import com.zoonk.android.feature.activities.numericAnswer
import com.zoonk.android.feature.activities.numericValue
import com.zoonk.android.ui.components.LinearScale
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatAmount
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf1Fields
import kotlin.math.ceil
import com.zoonk.api.models.PlayableLibraryStepAnyOfContent.PlayableLibraryStepAnyOfContentOneOf1Value as NumberLineContent

private typealias NumberLineFields = PlayableLibraryStepAnyOfContentOneOf1Fields

val numberLineRenderer =
    ActivityRenderer(
        badge = { ActivityBadge(R.string.activities_math_badge_place_it, R.drawable.ic_arrow_range) },
        canvas = { NumberLineActivity(it) },
    )

private class Jump(
    val from: Double,
    val by: Double,
    val label: String,
    val color: Color,
) {
    val to get() = from + by
}

/** The dot's place is the numeric answer; once checked, the line draws the moves the answer takes. */
@Composable
private fun NumberLineActivity(props: ActivityProps) {
    val fields = (props.content as NumberLineContent).value.fields
    val locale = currentLocale()
    val format = { value: Double -> formatAmount(value, locale) }
    val withUnit = { value: Double -> formatAmount(value, locale, fields.unit) }
    val position = props.answer.numericValue?.let { clamp(it, fields.min, fields.max) } ?: fields.start
    val stops = jumpStops(fields.start, fields.moves.map { it.by })
    val landing = stops.last()
    val highlight = MaterialTheme.zoonk.vizHighlight
    val secondary = MaterialTheme.zoonk.vizSecondary
    val jumps =
        if (props.isChecked) {
            fields.moves.mapIndexed { index, move ->
                val label = move.label ?: formatAmount(move.by, locale, signed = true)
                Jump(stops[index], move.by, label, if (index % 2 == 0) secondary else highlight)
            }
        } else {
            listOfNotNull(
                Jump(fields.start, position - fields.start, formatAmount(position - fields.start, locale, signed = true), highlight)
                    .takeIf { position != fields.start },
            )
        }
    val description =
        listOfNotNull(
            stringResource(
                R.string.activities_math_number_line_description,
                fields.label,
                format(fields.min),
                format(fields.max),
                withUnit(fields.start),
                withUnit(position),
            ),
            if (props.isChecked) {
                stringResource(
                    R.string.activities_math_number_line_jumps,
                    fields.moves.joinToString(", ") { formatAmount(it.by, locale, signed = true) },
                    withUnit(landing),
                )
            } else {
                null
            },
        ).joinToString(" ")

    ActivityCanvas(description = description) {
        Text(
            fields.unit?.let { stringResource(R.string.activities_math_number_line_label, fields.label, it) } ?: fields.label,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
        NumberLinePlot(
            fields = fields,
            position = position,
            jumps = jumps,
            landing = landing.takeIf { props.isChecked },
            locked = props.isLocked,
            valueText = withUnit(position),
            format = format,
            onPlace = { props.onAnswerChange(numericAnswer(it)) },
        )
        ActivityReadout(
            numberLineEquation(fields.start, jumps.map { it.by }, format),
            Modifier.clearAndSetSemantics {},
        )
    }
}

@Composable
private fun NumberLinePlot(
    fields: NumberLineFields,
    position: Double,
    jumps: List<Jump>,
    landing: Double?,
    locked: Boolean,
    valueText: String,
    format: (Double) -> String,
    onPlace: (Double) -> Unit,
) {
    val density = LocalDensity.current
    val measurer = rememberTextMeasurer()
    val tickStyle = MaterialTheme.typography.labelSmall.withTabularFigures()
    val jumpStyle =
        MaterialTheme.typography.labelLarge
            .withTabularFigures()
            .copy(fontWeight = FontWeight.SemiBold)
    val jumpLabelHeight = measurer.measure("0", jumpStyle).size.height
    val tickLabelHeight = measurer.measure("0", tickStyle).size.height
    val baseline = with(density) { (TOP + TICK + MAX_ARC + ARROW_HEAD).toPx() } + jumpLabelHeight
    val height = baseline + with(density) { (ZERO_TICK + LABEL_GAP + BOTTOM).toPx() } + tickLabelHeight
    val range = SnapRange(fields.min, fields.max, fields.step)
    val colors =
        LineColors(
            ink = MaterialTheme.colorScheme.onSurface,
            muted = MaterialTheme.colorScheme.onSurfaceVariant,
            axis = MaterialTheme.colorScheme.outlineVariant,
            ring = MaterialTheme.colorScheme.surface,
            start = MaterialTheme.zoonk.vizSecondary,
        )
    val highlight = MaterialTheme.zoonk.vizHighlight
    val right = MaterialTheme.colorScheme.tertiary

    BoxWithConstraints(Modifier.fillMaxWidth().height(with(density) { height.toDp() })) {
        val side = with(density) { SIDE.toPx() }
        val x = LinearScale(fields.min..fields.max, side to constraints.maxWidth - side)
        val ticks = numberLineTicks(fields.min, fields.max, fields.step)
        val widest = ticks.maxOf { measurer.measure(format(it.value), tickStyle).size.width } + with(density) { LABEL_SPACE.toPx() }
        val spacing = (x.range.second - x.range.first) / (ticks.size - 1).coerceAtLeast(1)
        val labelled = numberLineTicks(fields.min, fields.max, fields.step, minEvery = ceil(widest / spacing).toInt())
        val trackHalf = with(density) { TRACK_HALF.toPx() }

        Canvas(Modifier.matchParentSize().clearAndSetSemantics {}) {
            drawAxis(x, baseline, labelled, format, measurer, tickStyle, colors)
            jumps.forEach { jump ->
                drawJump(x.toPixel(jump.from), x.toPixel(jump.to), baseline - TICK.toPx(), jump, measurer.measure(jump.label, jumpStyle))
            }
            val start = Offset(x.toPixel(fields.start), baseline)
            drawCircle(colors.ring, (START_RADIUS + START_RING).toPx(), start)
            drawCircle(colors.start, (START_RADIUS - START_RING).toPx(), start)
        }
        ActivityPlaceTrack(
            area = Rect(x.range.first, baseline - trackHalf, x.range.second, baseline + trackHalf),
            scale = x,
            range = range,
            onChange = onPlace,
            disabled = locked,
        )
        ActivityPlaceHandle(
            center = Offset(x.toPixel(position), baseline),
            scale = x,
            range = range,
            value = position,
            label = stringResource(R.string.activities_math_number_line_answer),
            valueText = valueText,
            onChange = onPlace,
            disabled = locked,
        ) {
            Canvas(Modifier.size(HALO * 2)) {
                drawCircle(highlight.copy(alpha = SOFT).compositeOver(colors.ring))
                drawCircle(colors.ring, (DOT + DOT_RING).toPx())
                drawCircle(highlight, (DOT - DOT_RING).toPx())
            }
        }
        if (landing != null) {
            Canvas(Modifier.matchParentSize().clearAndSetSemantics {}) {
                drawCircle(right, LANDING.toPx(), Offset(x.toPixel(landing), baseline), style = Stroke(LANDING_STROKE.toPx()))
            }
        }
    }
}

private class LineColors(
    val ink: Color,
    val muted: Color,
    val axis: Color,
    val ring: Color,
    val start: Color,
)

private fun DrawScope.drawAxis(
    x: LinearScale,
    baseline: Float,
    ticks: List<NumberLineTick>,
    format: (Double) -> String,
    measurer: TextMeasurer,
    style: TextStyle,
    colors: LineColors,
) {
    drawLine(colors.axis, Offset(x.range.first, baseline), Offset(x.range.second, baseline), AXIS_STROKE.toPx())
    ticks.forEach { tick ->
        val zero = tick.value == 0.0
        val px = x.toPixel(tick.value)
        val length = (if (zero) ZERO_TICK else TICK).toPx()
        drawLine(
            if (zero) colors.ink else colors.muted,
            Offset(px, baseline - length),
            Offset(px, baseline + length),
            (if (zero) ZERO_TICK_STROKE else TICK_STROKE).toPx(),
        )
        if (tick.isLabelled) {
            val label =
                measurer.measure(
                    format(tick.value),
                    if (zero) style.copy(color = colors.ink, fontWeight = FontWeight.SemiBold) else style.copy(color = colors.muted),
                )
            drawText(label, topLeft = Offset(px - label.size.width / 2, baseline + (ZERO_TICK + LABEL_GAP).toPx()))
        }
    }
}

private fun DrawScope.drawJump(
    from: Float,
    to: Float,
    baseline: Float,
    jump: Jump,
    label: TextLayoutResult,
) {
    val arc = jumpArc(baseline, from, to, unit = density)
    val stroke = Stroke(JUMP_STROKE.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round)
    val curve =
        Path().apply {
            moveTo(from, baseline)
            quadraticTo(arc.control.x, arc.control.y, to, baseline)
        }
    val head =
        Path().apply {
            moveTo(arc.wings.first.x, arc.wings.first.y)
            lineTo(to, baseline)
            lineTo(arc.wings.second.x, arc.wings.second.y)
        }
    drawPath(curve, jump.color, style = stroke)
    drawPath(head, jump.color, style = stroke)
    drawText(label, color = jump.color, topLeft = Offset(arc.label.x - label.size.width / 2, arc.label.y - label.size.height))
}

private val TOP = 4.dp
private val BOTTOM = 8.dp
private val SIDE = 20.dp
private val TICK = 6.dp
private val ZERO_TICK = 12.dp
private val LABEL_GAP = 4.dp
private val LABEL_SPACE = 6.dp
private val MAX_ARC = 64.dp
private val ARROW_HEAD = 7.dp
private val TRACK_HALF = 22.dp
private val AXIS_STROKE = 2.dp
private val TICK_STROKE = 1.5.dp
private val ZERO_TICK_STROKE = 2.dp
private val JUMP_STROKE = 2.5.dp
private val START_RADIUS = 7.dp
private val START_RING = 1.dp
private val DOT = 10.dp
private val DOT_RING = 1.25.dp
private val HALO = 15.dp
private val LANDING = 14.dp
private val LANDING_STROKE = 3.dp
private const val SOFT = 0.18f
