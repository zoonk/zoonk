package com.zoonk.android.feature.activities.geometry

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableDoubleStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalResources
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.setProgress
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.activities.ActivityBadge
import com.zoonk.android.feature.activities.ActivityCanvas
import com.zoonk.android.feature.activities.ActivityCanvasLabel
import com.zoonk.android.feature.activities.ActivityPlot
import com.zoonk.android.feature.activities.ActivityProps
import com.zoonk.android.feature.activities.ActivityRenderer
import com.zoonk.android.feature.activities.geometry.UnitCircleAngle.FULL_TURN
import com.zoonk.android.feature.activities.geometry.UnitCircleAngle.HALF_TURN
import com.zoonk.android.feature.activities.numericAnswer
import com.zoonk.android.feature.activities.numericValue
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatAmount
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.richtext.RichText
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf7Fields.AngleUnit
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.roundToInt
import kotlin.math.sin
import com.zoonk.api.models.PlayableLibraryStepAnyOfContent.PlayableLibraryStepAnyOfContentOneOf7Value as UnitCircleContent
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf7Fields.Show as Trig
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOfCheck.PlayableLibraryStepAnyOfContentOneOfCheckOneOf2Value as NumericCheckValue

val unitCircleRenderer =
    ActivityRenderer(
        badge = { ActivityBadge(R.string.activities_geometry_badge_turn_it, R.drawable.ic_rotate_right) },
        canvas = { UnitCircleActivity(it) },
    )

private class CheckTarget(
    val degrees: Double,
    val output: Trig,
)

private class ExpectedMark(
    val degrees: Double,
    val label: String,
)

private fun checkTarget(content: UnitCircleContent): CheckTarget? {
    val check = (content.value.check as? NumericCheckValue)?.value ?: return null
    val fields = content.value.fields
    val angle = check.inputs?.find { it.name == "angle" }?.value ?: fields.startAngle
    val output = fields.show.find { it.value == check.output } ?: fields.show.firstOrNull() ?: return null
    return CheckTarget(toDegrees(angle, fields.angleUnit), output)
}

private fun toDegrees(
    angle: Double,
    unit: AngleUnit,
): Double = if (unit == AngleUnit.DEGREES) angle else angle * HALF_TURN / PI

@Composable
private fun UnitCircleActivity(props: ActivityProps) {
    val content = props.content as UnitCircleContent
    val fields = content.value.fields
    val target = checkTarget(content)
    val start = toDegrees(fields.startAngle, fields.angleUnit)
    val step = UnitCircleAngle.step(listOfNotNull(start, target?.degrees))
    var degrees by rememberSaveable { mutableDoubleStateOf(UnitCircleAngle.snap(start, step)) }
    val formatAngle = angleFormat(fields.angleUnit)
    val formatTrig = trigFormat()
    val names = trigNames()
    val values = fields.show.associateWith { UnitCircleAngle.value(it, degrees) }
    val valueList = values.entries.joinToString(", ") { (trig, value) -> "${names.getValue(trig)} = ${formatTrig(value)}" }
    val expected = props.expected.numericValue?.takeIf { props.isChecked }
    val mark = if (target != null && expected != null) ExpectedMark(target.degrees, formatAngle(target.degrees)) else null
    val angle = formatAngle(degrees)
    val description =
        listOfNotNull(
            stringResource(R.string.activities_geometry_unit_circle_description, angle, valueList),
            if (target != null && mark != null) {
                stringResource(
                    R.string.activities_geometry_unit_circle_asks,
                    mark.label,
                    names.getValue(target.output),
                    formatTrig(expected),
                )
            } else {
                null
            },
        ).joinToString(" ")

    fun turn(next: Double) {
        degrees = next
        target?.let { props.onAnswerChange(UnitCircleAngle.value(it.output, next)?.let(::numericAnswer)) }
    }

    ActivityCanvas(description = description) {
        RichText(fields.frame, style = MaterialTheme.typography.bodyMedium.copy(color = MaterialTheme.colorScheme.onSurfaceVariant))
        UnitCircleDial(
            degrees = degrees,
            step = step,
            enabled = !props.isLocked,
            show = fields.show,
            values = values,
            names = names,
            angle = angle,
            valueText = stringResource(R.string.activities_geometry_unit_circle_value, angle, valueList),
            mark = mark,
            formatTrig = formatTrig,
            onTurn = ::turn,
        )
        val waves = fields.show.filter { it != Trig.TAN }
        if (waves.isNotEmpty()) UnitCircleWaves(degrees, waves, names, formatAngle)
    }
}

@Composable
private fun UnitCircleDial(
    degrees: Double,
    step: Double,
    enabled: Boolean,
    show: List<Trig>,
    values: Map<Trig, Double?>,
    names: Map<Trig, String>,
    angle: String,
    valueText: String,
    mark: ExpectedMark?,
    formatTrig: (Double?) -> String,
    onTurn: (Double) -> Unit,
) {
    val density = LocalDensity.current
    val measurer = rememberTextMeasurer()
    val valueStyle =
        MaterialTheme.typography.labelLarge
            .withTabularFigures()
            .copy(fontWeight = FontWeight.SemiBold)
    val angleStyle = MaterialTheme.typography.labelMedium.withTabularFigures()
    val colors = dialColors()
    val tones = trigTones()

    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val side = minOf(maxWidth, MAX_SIZE)
        val width = with(density) { maxWidth.toPx() }
        val height = with(density) { side.toPx() }
        val radius = height * RADIUS_SHARE
        val center = Offset(width / 2, height / 2)
        val point = onCircle(center, radius, degrees)

        PointDragArea(
            enabled = enabled,
            pick = { at -> 0.takeIf { at.reaches(point, density) } },
            onDrag = { _, at -> onTurn(UnitCircleAngle.snap(UnitCircleAngle.pointerAngle(center, at), step)) },
            onTap = { at -> onTurn(UnitCircleAngle.snap(UnitCircleAngle.pointerAngle(center, at), step)) },
            modifier = Modifier.fillMaxWidth().height(side),
        ) {
            Canvas(Modifier.matchParentSize().clearAndSetSemantics {}) {
                val label = { text: String, style: TextStyle -> measurer.measure(text, style) }
                val reach = radius + HIT_REACH.toPx()
                val axis = Stroke(1.5.dp.toPx())
                drawLine(colors.axis, Offset(center.x - reach, center.y), Offset(center.x + reach, center.y), axis.width)
                drawLine(colors.axis, Offset(center.x, center.y - reach), Offset(center.x, center.y + reach), axis.width)
                drawCircle(colors.circle, radius, center, style = Stroke(2.dp.toPx()))

                mark?.let {
                    val anchor = sideAnchor(it.degrees)
                    drawLabel(
                        label(it.label, valueStyle),
                        onCircle(center, radius + TARGET_LABEL_GAP.toPx(), it.degrees),
                        colors.right,
                        colors.halo,
                        anchor,
                    )
                    val at = onCircle(center, radius, it.degrees)
                    drawCircle(colors.halo, TARGET_RADIUS.toPx(), at)
                    drawCircle(colors.right, TARGET_RADIUS.toPx(), at, style = Stroke(2.5.dp.toPx()))
                }

                if (degrees > 0 && degrees < FULL_TURN) {
                    val arc = ARC_RADIUS.toPx()
                    drawArc(
                        colors.circle,
                        startAngle = 0f,
                        sweepAngle = -degrees.toFloat(),
                        useCenter = false,
                        topLeft = center - Offset(arc, arc),
                        size = Size(arc * 2, arc * 2),
                        style = Stroke(1.5.dp.toPx()),
                    )
                }
                drawLine(colors.ink, center, point, 2.dp.toPx())

                trigLegs(center, point, show, values, names, formatTrig, tones, colors.halo) { label(it, valueStyle) }
                if (Trig.TAN in show) {
                    tangent(
                        center,
                        radius,
                        size.height / 2 - LABEL_GAP.toPx(),
                        values[Trig.TAN],
                        names.getValue(Trig.TAN),
                        formatTrig,
                        tones.tan,
                        colors.halo,
                    ) {
                        label(it, valueStyle)
                    }
                }

                drawLabel(
                    label(angle, angleStyle),
                    onCircle(center, (ARC_RADIUS + ANGLE_LABEL_GAP).toPx(), angleLabelDirection(degrees)),
                    colors.circle,
                    colors.halo,
                )
            }

            PointHandle(
                center = point,
                label = stringResource(R.string.activities_geometry_unit_circle_point),
                value = valueText,
                enabled = enabled,
                onKey = { key -> UnitCircleAngle.afterKey(degrees, key, step)?.let(onTurn) != null },
                actions = {
                    progressBarRangeInfo =
                        ProgressBarRangeInfo(degrees.toFloat(), 0f..FULL_TURN.toFloat(), (FULL_TURN / step).roundToInt() - 1)
                    setProgress { value ->
                        onTurn(UnitCircleAngle.snap(value.toDouble(), step))
                        true
                    }
                },
            )
        }
    }
}

private class DialColors(
    val axis: Color,
    val circle: Color,
    val ink: Color,
    val halo: Color,
    val right: Color,
)

@Composable
private fun dialColors() =
    DialColors(
        axis = MaterialTheme.colorScheme.outlineVariant,
        circle = MaterialTheme.colorScheme.onSurfaceVariant,
        ink = MaterialTheme.colorScheme.onSurface,
        halo = MaterialTheme.colorScheme.surface,
        right = MaterialTheme.colorScheme.tertiary,
    )

private class TrigTones(
    val sin: Color,
    val cos: Color,
    val tan: Color,
) {
    fun of(trig: Trig) =
        when (trig) {
            Trig.SIN -> sin
            Trig.COS -> cos
            Trig.TAN -> tan
        }
}

@Composable
private fun trigTones() =
    TrigTones(sin = MaterialTheme.zoonk.vizHighlight, cos = MaterialTheme.zoonk.vizSecondary, tan = MaterialTheme.zoonk.vizAccent)

private fun DrawScope.trigLegs(
    center: Offset,
    point: Offset,
    show: List<Trig>,
    values: Map<Trig, Double?>,
    names: Map<Trig, String>,
    formatTrig: (Double?) -> String,
    tones: TrigTones,
    halo: Color,
    measure: (String) -> TextLayoutResult,
) {
    val foot = Offset(point.x, center.y)
    val isLeft = point.x < center.x
    val isAbove = point.y <= center.y
    val segment = SEGMENT_WIDTH.toPx()

    if (Trig.COS in show) {
        drawLine(tones.cos, center, foot, segment, StrokeCap.Round)
        val below = (if (isAbove) 1 else -1) * LABEL_GAP.toPx() * 2
        drawLabel(
            measure("${names.getValue(Trig.COS)} = ${formatTrig(values[Trig.COS])}"),
            Offset((center.x + foot.x) / 2, center.y + below),
            tones.cos,
            halo,
        )
    }

    if (Trig.SIN in show) {
        drawLine(tones.sin, foot, point, segment, StrokeCap.Round)
        val text = measure("${names.getValue(Trig.SIN)} = ${formatTrig(values[Trig.SIN])}")
        val beside = foot.x + (if (isLeft) -1 else 1) * SIN_LABEL_GAP.toPx()
        val fits = if (isLeft) beside - text.size.width >= 0 else beside + text.size.width <= size.width
        if (fits) {
            drawLabel(text, Offset(beside, (foot.y + point.y) / 2), tones.sin, halo, if (isLeft) LabelAnchor.End else LabelAnchor.Start)
        } else {
            val corner = Offset(if (isLeft) 0f else size.width, if (isAbove) size.height - CORNER_INSET.toPx() else CORNER_INSET.toPx())
            drawLabel(text, corner, tones.sin, halo, if (isLeft) LabelAnchor.Start else LabelAnchor.End)
        }
    }
}

private fun DrawScope.tangent(
    center: Offset,
    radius: Float,
    limit: Float,
    value: Double?,
    name: String,
    formatTrig: (Double?) -> String,
    tone: Color,
    halo: Color,
    measure: (String) -> TextLayoutResult,
) {
    value ?: return
    val reach = (-value * radius).toFloat().coerceIn(-limit, limit)
    val top = Offset(center.x + radius, center.y + reach)
    drawLine(
        tone.copy(alpha = TANGENT_RAY_ALPHA),
        center,
        top,
        1.5.dp.toPx(),
        pathEffect = PathEffect.dashPathEffect(floatArrayOf(3.dp.toPx(), 4.dp.toPx())),
    )
    drawLine(tone, Offset(top.x, center.y), top, SEGMENT_WIDTH.toPx(), StrokeCap.Round)
    drawLabel(measure("$name = ${formatTrig(value)}"), Offset(top.x - LABEL_GAP.toPx(), top.y), tone, halo, LabelAnchor.End)
}

@Composable
private fun UnitCircleWaves(
    degrees: Double,
    waves: List<Trig>,
    names: Map<Trig, String>,
    formatAngle: (Double) -> String,
) {
    val locale = currentLocale()
    val tones = trigTones()
    val muted = MaterialTheme.colorScheme.onSurfaceVariant
    val ring = MaterialTheme.colorScheme.surface

    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        FlowRow(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalArrangement = Arrangement.spacedBy(4.dp),
            itemVerticalAlignment = Alignment.CenterVertically,
        ) {
            ActivityCanvasLabel(stringResource(R.string.activities_geometry_unit_circle_as_turns))
            if (waves.size > 1) {
                Row(Modifier.clearAndSetSemantics {}, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    waves.forEach { trig ->
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                            Box(Modifier.size(SWATCH_WIDTH, SWATCH_HEIGHT).background(tones.of(trig), CircleShape))
                            Text(names.getValue(trig), color = muted, style = MaterialTheme.typography.labelMedium)
                        }
                    }
                }
            }
        }
        ActivityPlot(
            xDomain = 0.0..FULL_TURN,
            yDomain = -1.0..1.0,
            yTicks = listOf(-1.0, 0.0, 1.0),
            xTicks = WAVE_TICKS,
            formatY = { formatNumber(it, locale) },
            formatX = formatAngle,
            area = WAVE_AREA,
        ) {
            waves.forEach { trig ->
                line(wavePoints(trig, FULL_TURN), muted.copy(alpha = WAVE_GUIDE_ALPHA), width = 2.dp, dash = WAVE_DASH, gap = WAVE_DASH_GAP)
                line(wavePoints(trig, degrees), tones.of(trig))
                dot(degrees, UnitCircleAngle.value(trig, degrees) ?: 0.0, tones.of(trig), ring, radius = WAVE_DOT)
            }
        }
    }
}

private fun wavePoints(
    trig: Trig,
    upTo: Double,
): List<Pair<Double, Double>> {
    val count = (upTo / WAVE_SAMPLE).toInt()
    return ((0..count).map { it * WAVE_SAMPLE } + upTo).distinct().map { it to (UnitCircleAngle.value(trig, it) ?: 0.0) }
}

@Composable
private fun trigNames(): Map<Trig, String> =
    mapOf(
        Trig.SIN to stringResource(R.string.activities_geometry_sin),
        Trig.COS to stringResource(R.string.activities_geometry_cos),
        Trig.TAN to stringResource(R.string.activities_geometry_tan),
    )

@Composable
private fun angleFormat(unit: AngleUnit): (Double) -> String {
    val locale = currentLocale()
    val resources = LocalResources.current
    return { degrees ->
        if (unit == AngleUnit.DEGREES) {
            formatAmount(degrees, locale, "°")
        } else {
            UnitCircleAngle.piFraction(degrees)
                ?: resources.getString(R.string.activities_geometry_radians, formatAmount(degrees * PI / HALF_TURN, locale))
        }
    }
}

@Composable
private fun trigFormat(): (Double?) -> String {
    val locale = currentLocale()
    val undefined = stringResource(R.string.activities_geometry_undefined)
    return { value -> value?.let { formatNumber(it, locale, VALUE_DIGITS) } ?: undefined }
}

private fun onCircle(
    center: Offset,
    radius: Float,
    degrees: Double,
): Offset {
    val radians = degrees * PI / HALF_TURN
    return Offset(center.x + (cos(radians) * radius).toFloat(), center.y - (sin(radians) * radius).toFloat())
}

private fun sideAnchor(degrees: Double): LabelAnchor {
    val across = cos(degrees * PI / HALF_TURN)
    return when {
        across > SIDE_THRESHOLD -> LabelAnchor.Start
        across < -SIDE_THRESHOLD -> LabelAnchor.End
        else -> LabelAnchor.Middle
    }
}

private fun angleLabelDirection(degrees: Double): Double = (degrees / 2).coerceIn(AXIS_CLEARANCE, FULL_TURN - AXIS_CLEARANCE)

private val MAX_SIZE = 300.dp
private val HIT_REACH = 22.dp
private val TARGET_RADIUS = 7.dp
private val TARGET_LABEL_GAP = 14.dp
private val ARC_RADIUS = 22.dp
private val ANGLE_LABEL_GAP = 16.dp
private val LABEL_GAP = 8.dp
private val SIN_LABEL_GAP = 26.dp
private val CORNER_INSET = 10.dp
private val SEGMENT_WIDTH = 4.dp
private val SWATCH_WIDTH = 12.dp
private val SWATCH_HEIGHT = 4.dp
private val WAVE_AREA = 76.dp
private val WAVE_DOT = 5.dp
private val WAVE_DASH = 2.dp
private val WAVE_DASH_GAP = 5.dp
private val WAVE_TICKS = listOf(90.0, 180.0, 270.0, 360.0)
private const val WAVE_SAMPLE = 5.0
private const val WAVE_GUIDE_ALPHA = 0.4f
private const val TANGENT_RAY_ALPHA = 0.6f
private const val RADIUS_SHARE = 0.34f
private const val SIDE_THRESHOLD = 0.35
private const val AXIS_CLEARANCE = 25.0
private const val VALUE_DIGITS = 2
