package com.zoonk.android.feature.activities.math

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Fill
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.activities.ActivityBadge
import com.zoonk.android.feature.activities.ActivityCanvas
import com.zoonk.android.feature.activities.ActivityPlaceHandle
import com.zoonk.android.feature.activities.ActivityProps
import com.zoonk.android.feature.activities.ActivityReadout
import com.zoonk.android.feature.activities.ActivityRenderer
import com.zoonk.android.feature.activities.SnapRange
import com.zoonk.android.feature.activities.numericAnswer
import com.zoonk.android.ui.components.LinearScale
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatAmount
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk
import kotlin.math.abs
import kotlin.math.max
import com.zoonk.api.models.PlayableLibraryStepAnyOfContent.PlayableLibraryStepAnyOfContentOneOf9Value as DistributionExplorerContent
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf9FieldsDistribution.PlayableLibraryStepAnyOfContentOneOf9FieldsDistributionOneOf1Value as UniformValue
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf9FieldsDistribution.PlayableLibraryStepAnyOfContentOneOf9FieldsDistributionOneOfValue as NormalValue
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOfCheck.PlayableLibraryStepAnyOfContentOneOfCheckOneOf2Value as NumericCheckValue

val distributionExplorerRenderer =
    ActivityRenderer(
        badge = { ActivityBadge(R.string.activities_math_badge_explore, R.drawable.ic_area_chart) },
        canvas = { DistributionExplorerActivity(it) },
        showsData = { true },
    )

/** The handles' place is the learner's; a numeric check's answer is the percent between them. */
@Composable
private fun DistributionExplorerActivity(props: ActivityProps) {
    val content = (props.content as DistributionExplorerContent).value
    val fields = content.fields
    val distribution = fields.distribution
    val locale = currentLocale()
    var handles by rememberSaveable { mutableStateOf(fields.handles.from to fields.handles.to) }
    val (low, high) = handles
    val domain = distributionDomain(fields).let { snapDomain(it, handleStep(fields, it)) }
    val step = handleStep(fields, distributionDomain(fields))
    val ends = farEnds(distribution)
    val between = percentBetween(distribution, Interval(low, high))
    val below = percentBetween(distribution, Interval(ends.from, low))
    val above = percentBetween(distribution, Interval(high, ends.to))
    val percent = { value: Double -> formatAmount(value, locale, "%", maximumFractionDigits = PERCENT_DIGITS) }
    val format = { value: Double -> formatAmount(value, locale) }
    val withUnit = { value: Double -> formatAmount(value, locale, fields.unit) }
    val change = { next: Pair<Double, Double> ->
        handles = next
        if (content.check is NumericCheckValue) {
            props.onAnswerChange(
                numericAnswer(percentBetween(distribution, Interval(next.first, next.second))),
            )
        }
    }
    val shape =
        when (distribution) {
            is NormalValue -> {
                stringResource(
                    R.string.activities_math_distribution_normal,
                    fields.valueLabel,
                    withUnit(distribution.value.mean),
                    withUnit(distribution.value.sd),
                )
            }

            is UniformValue -> {
                stringResource(
                    R.string.activities_math_distribution_uniform,
                    fields.valueLabel,
                    withUnit(distribution.value.min),
                    withUnit(distribution.value.max),
                )
            }
        }
    val shares =
        stringResource(
            R.string.activities_math_distribution_shares,
            percent(between),
            withUnit(low),
            withUnit(high),
            percent(below),
            percent(above),
        )
    val handleTexts =
        listOf(low, high).map {
            stringResource(R.string.activities_math_distribution_handle_value, withUnit(it), percent(between))
        }

    val targetLabel =
        stringResource(
            R.string.activities_math_distribution_target,
            format(fields.target.from),
            format(fields.target.to),
            percent(percentBetween(distribution, fields.target)),
        )

    ActivityCanvas(description = listOfNotNull(shape, shares, targetLabel.takeIf { props.isChecked }).joinToString(" ")) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(
                stringResource(R.string.activities_math_distribution_range, fields.valueLabel, format(low), format(high)),
                Modifier.weight(1f),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
            ActivityReadout(percent(between), Modifier.clearAndSetSemantics {}, color = MaterialTheme.zoonk.vizAccent)
        }
        DistributionPlot(
            distribution = distribution,
            domain = domain,
            handles = handles,
            target = fields.target.takeIf { props.isChecked },
            targetLabel = targetLabel,
            tails = percent(below) to percent(above),
            format = format,
        ) { x, pillCenter ->
            DistributionHandle(
                label = stringResource(R.string.activities_math_distribution_lower),
                value = low,
                range = SnapRange(domain.start, high - step, step),
                x = x,
                y = pillCenter,
                valueLabel = format(low),
                valueText = handleTexts[0],
                disabled = props.isLocked,
            ) { change(it to high) }
            DistributionHandle(
                label = stringResource(R.string.activities_math_distribution_upper),
                value = high,
                range = SnapRange(low + step, domain.endInclusive, step),
                x = x,
                y = pillCenter,
                valueLabel = format(high),
                valueText = handleTexts[1],
                disabled = props.isLocked,
            ) { change(low to it) }
        }
    }
}

@Composable
private fun DistributionPlot(
    distribution: Distribution,
    domain: ClosedFloatingPointRange<Double>,
    handles: Pair<Double, Double>,
    target: Interval?,
    targetLabel: String,
    tails: Pair<String, String>,
    format: (Double) -> String,
    overlay: @Composable (x: LinearScale, pillCenter: Float) -> Unit,
) {
    val density = LocalDensity.current
    val measurer = rememberTextMeasurer()
    val labelStyle = MaterialTheme.typography.labelSmall.withTabularFigures()
    val targetStyle = labelStyle.copy(fontWeight = FontWeight.SemiBold)
    val pillStyle =
        MaterialTheme.typography.labelLarge
            .withTabularFigures()
            .copy(fontWeight = FontWeight.SemiBold)
    val labelHeight = measurer.measure("0", labelStyle).size.height
    val pillHeight =
        max(
            with(density) { PILL_HEIGHT.toPx() },
            measurer.measure("0", pillStyle).size.height + with(density) { PILL_INSET.toPx() },
        )
    val top = labelHeight + with(density) { TARGET_RISE.toPx() * 2 }
    val area = with(density) { AREA.toPx() }
    val axis = top + area
    val pillCenter = axis + with(density) { PILL_GAP.toPx() } + pillHeight / 2
    val height = pillCenter + pillHeight / 2 + with(density) { BOTTOM.toPx() }
    val curve = densityCurve(distribution, domain)
    val peak = curve.maxOf { it.second } * HEADROOM
    val accent = MaterialTheme.zoonk.vizAccent
    val muted = MaterialTheme.colorScheme.onSurfaceVariant
    val border = MaterialTheme.colorScheme.outlineVariant
    val ring = MaterialTheme.colorScheme.surface
    val right = MaterialTheme.colorScheme.tertiary

    BoxWithConstraints(Modifier.fillMaxWidth().height(with(density) { height.toDp() })) {
        val side = with(density) { SIDE.toPx() }
        val x = LinearScale(domain, side to constraints.maxWidth - side)
        val y = LinearScale(0.0..peak, axis to top)
        val at = { point: Pair<Double, Double> -> Offset(x.toPixel(point.first), y.toPixel(point.second)) }
        val (from, to) = handles

        Canvas(Modifier.matchParentSize().clearAndSetSemantics {}) {
            val inside = curve.filter { it.first in from..to }
            if (inside.isNotEmpty()) {
                val shaded =
                    Path().apply {
                        inside.forEachIndexed { index, point ->
                            at(point).let {
                                if (index ==
                                    0
                                ) {
                                    moveTo(it.x, it.y)
                                } else {
                                    lineTo(it.x, it.y)
                                }
                            }
                        }
                        lineTo(x.toPixel(inside.last().first), axis)
                        lineTo(x.toPixel(inside.first().first), axis)
                        close()
                    }
                drawPath(shaded, accent.copy(alpha = SOFT))
            }
            if (distribution is NormalValue) {
                val mean = x.toPixel(distribution.value.mean)
                val dash = MEAN_DASH.toPx()
                drawLine(
                    muted.copy(alpha = HALF),
                    Offset(mean, axis),
                    Offset(mean, top),
                    pathEffect = PathEffect.dashPathEffect(floatArrayOf(dash, dash)),
                )
            }
            drawPath(
                Path().apply {
                    curve.forEachIndexed { index, point ->
                        at(point).let {
                            if (index ==
                                0
                            ) {
                                moveTo(it.x, it.y)
                            } else {
                                lineTo(it.x, it.y)
                            }
                        }
                    }
                },
                accent,
                style = Stroke(CURVE_WIDTH.toPx()),
            )
            drawLine(border, Offset(x.range.first, axis), Offset(x.range.second, axis), AXIS_WIDTH.toPx())
            val pillHalves = listOf(from, to).map { it to measurer.measure(format(it), pillStyle).size.width / 2f + PILL_PADDING.toPx() }
            distributionTicks(distribution, domain).forEach { tick ->
                val label = measurer.measure(format(tick), labelStyle.copy(color = muted))
                val clear =
                    pillHalves.all { (handle, half) ->
                        abs(x.toPixel(tick) - x.toPixel(handle)) >=
                            half + label.size.width / 2f + TICK_GAP.toPx()
                    }
                if (clear) drawText(label, topLeft = Offset(x.toPixel(tick) - label.size.width / 2, pillCenter - label.size.height / 2))
            }
            if (target != null) {
                val dash = TARGET_DASH.toPx()
                listOf(target.from, target.to).forEach {
                    drawLine(
                        right,
                        Offset(x.toPixel(it), axis),
                        Offset(x.toPixel(it), top),
                        TARGET_WIDTH.toPx(),
                        pathEffect =
                            PathEffect.dashPathEffect(
                                floatArrayOf(
                                    dash,
                                    dash * 3 / 4,
                                ),
                            ),
                    )
                }
                val label = measurer.measure(targetLabel, targetStyle.copy(color = right))
                val middle = (x.toPixel(target.from) + x.toPixel(target.to)) / 2
                drawText(
                    label,
                    topLeft =
                        Offset(
                            (middle - label.size.width / 2).coerceIn(0f, size.width - label.size.width),
                            top - TARGET_RISE.toPx() - label.size.height,
                        ),
                )
            }
            val tailGap = TAIL_GAP.toPx()
            val tailY = axis - TAIL_RISE.toPx()
            listOf(
                Triple(tails.first, x.toPixel(from) - x.range.first, true),
                Triple(tails.second, x.range.second - x.toPixel(to), false),
            ).forEach { (text, room, isBelow) ->
                val label = measurer.measure(text, labelStyle.copy(color = muted))
                if (room < label.size.width + tailGap) return@forEach
                val left = if (isBelow) x.toPixel(from) - tailGap - label.size.width else x.toPixel(to) + tailGap
                val topLeft = Offset(left, tailY - label.size.height)
                drawText(
                    measurer.measure(text, labelStyle.copy(color = ring, drawStyle = Stroke(HALO.toPx(), join = StrokeJoin.Round))),
                    topLeft = topLeft,
                )
                drawText(label, topLeft = topLeft, drawStyle = Fill)
            }
            listOf(
                from,
                to,
            ).forEach { drawLine(accent, Offset(x.toPixel(it), top), Offset(x.toPixel(it), pillCenter), HANDLE_WIDTH.toPx()) }
        }
        overlay(x, pillCenter)
    }
}

@Composable
private fun DistributionHandle(
    label: String,
    value: Double,
    range: SnapRange,
    x: LinearScale,
    y: Float,
    valueLabel: String,
    valueText: String,
    disabled: Boolean,
    onChange: (Double) -> Unit,
) {
    ActivityPlaceHandle(
        center = Offset(x.toPixel(value), y),
        scale = x,
        range = range,
        value = value,
        label = label,
        valueText = valueText,
        onChange = onChange,
        disabled = disabled,
    ) {
        Surface(shape = CircleShape, color = MaterialTheme.zoonk.vizAccent, contentColor = MaterialTheme.colorScheme.surface) {
            Text(
                valueLabel,
                Modifier.padding(horizontal = PILL_PADDING, vertical = 4.dp),
                style =
                    MaterialTheme.typography.labelLarge
                        .withTabularFigures()
                        .copy(fontWeight = FontWeight.SemiBold),
                textAlign = TextAlign.Center,
            )
        }
    }
}

private const val PERCENT_DIGITS = 1
private const val HEADROOM = 1.08
private const val SOFT = 0.18f
private const val HALF = 0.5f
private val SIDE = 12.dp
private val AREA = 128.dp
private val BOTTOM = 8.dp
private val PILL_HEIGHT = 26.dp
private val PILL_INSET = 8.dp
private val PILL_GAP = 6.dp
private val TARGET_RISE = 4.dp
private val TICK_GAP = 4.dp
private val PILL_PADDING = 10.dp
private val TAIL_GAP = 6.dp
private val TAIL_RISE = 14.dp
private val HALO = 4.dp
private val MEAN_DASH = 3.dp
private val TARGET_DASH = 4.dp
private val CURVE_WIDTH = 2.dp
private val AXIS_WIDTH = 1.5.dp
private val TARGET_WIDTH = 2.dp
private val HANDLE_WIDTH = 2.dp
