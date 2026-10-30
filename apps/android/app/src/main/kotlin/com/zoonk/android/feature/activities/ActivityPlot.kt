package com.zoonk.android.feature.activities

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.zoonk.android.ui.components.LinearScale
import com.zoonk.android.ui.theme.withTabularFigures
import kotlin.math.max

/** Where a template draws in an [ActivityPlot], in data units. */
class Plot internal constructor(
    private val scope: DrawScope,
    val x: LinearScale,
    val y: LinearScale,
    private val top: Float,
    private val bottom: Float,
    private val measurer: TextMeasurer,
    private val style: TextStyle,
) {
    fun at(
        x: Double,
        y: Double,
    ) = Offset(this.x.toPixel(x), this.y.toPixel(y))

    /** A line through [points], dashed in [dash]-long pieces when given. */
    fun line(
        points: List<Pair<Double, Double>>,
        color: Color,
        width: Dp = 3.dp,
        dash: Dp? = null,
    ) = with(scope) {
        if (points.isEmpty()) return@with
        val effect = dash?.let { PathEffect.dashPathEffect(floatArrayOf(it.toPx(), it.toPx())) }
        drawPath(path(points), color, style = Stroke(width.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round, pathEffect = effect))
    }

    /** The area under [points]' line, down to the plot's bottom. */
    fun area(
        points: List<Pair<Double, Double>>,
        color: Color,
    ) = with(scope) {
        if (points.isEmpty()) return@with
        val shape =
            path(points).apply {
                lineTo(at(points.last().first, 0.0).x, bottom)
                lineTo(at(points.first().first, 0.0).x, bottom)
                close()
            }
        drawPath(shape, color)
    }

    /** Dashed lines from the x axis up to a point and across to the y axis, to read both its values. */
    fun guide(
        x: Double,
        y: Double,
        color: Color,
    ) = with(scope) {
        val point = at(x, y)
        val corner =
            Path().apply {
                moveTo(point.x, bottom)
                lineTo(point.x, point.y)
                lineTo(this@Plot.x.range.first, point.y)
            }
        val dash = GUIDE_DASH.toPx()
        drawPath(corner, color, style = Stroke(GUIDE_WIDTH.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(dash, dash))))
    }

    private fun path(points: List<Pair<Double, Double>>) =
        Path().apply {
            points.forEachIndexed { index, (px, py) ->
                val point = at(px, py)
                if (index == 0) moveTo(point.x, point.y) else lineTo(point.x, point.y)
            }
        }

    /** A dot ringed with [ring] so it stands out on the line under it. */
    fun dot(
        x: Double,
        y: Double,
        color: Color,
        ring: Color,
        radius: Dp = 6.dp,
    ) = with(scope) {
        val center = at(x, y)
        drawCircle(ring, radius.toPx() + DOT_RING.toPx(), center)
        drawCircle(color, radius.toPx(), center)
    }

    /** A full-height band between two x values. */
    fun band(
        from: Double,
        to: Double,
        color: Color,
    ) = with(scope) {
        val left = x.toPixel(minOf(from, to))
        val right = x.toPixel(maxOf(from, to))
        drawRect(color, Offset(left, top), Size(right - left, bottom - top))
    }

    /** Text beside a point, centered on it vertically, on the side toward the plot's middle. */
    fun sideLabel(
        text: String,
        x: Double,
        y: Double,
        color: Color,
        gap: Dp = 8.dp,
    ) = with(scope) {
        val measured = measurer.measure(text, style.copy(color = color, fontWeight = FontWeight.SemiBold))
        val point = at(x, y)
        val left = if (point.x > size.width / 2) point.x - gap.toPx() - measured.size.width else point.x + gap.toPx()
        drawText(measured, topLeft = Offset(left, point.y - measured.size.height / 2))
    }

    /** Text centered on a point, or ending at it when [end], lifted by [lift]. */
    fun label(
        text: String,
        x: Double,
        y: Double,
        color: Color,
        lift: Dp = 12.dp,
        end: Boolean = false,
    ) = with(scope) {
        val measured = measurer.measure(text, style.copy(color = color, fontWeight = FontWeight.SemiBold))
        val point = at(x, y)
        val left = if (end) point.x - measured.size.width else point.x - measured.size.width / 2
        drawText(measured, topLeft = Offset(left, point.y - lift.toPx() - measured.size.height / 2))
    }

    /** A bar from the plot's bottom up to [y], [width] pixels wide and centered on [x]. */
    fun bar(
        x: Double,
        y: Double,
        width: Float,
        color: Color,
    ) = with(scope) {
        val top = this@Plot.y.toPixel(y)
        drawRoundRect(
            color,
            Offset(this@Plot.x.toPixel(x) - width / 2, top),
            Size(width, bottom - top),
            CornerRadius(minOf(width * BAR_ROUNDING, MAX_BAR_RADIUS.toPx())),
        )
    }
}

/**
 * Main's `ActivityPlot`: a dashed grid with its values on the left, the x values under it, and
 * what [draw] adds in an [area] as tall as main's. Its labels grow with the font size, so the
 * margins measure them and the plot grows with them.
 */
@Composable
fun ActivityPlot(
    xDomain: ClosedFloatingPointRange<Double>,
    yDomain: ClosedFloatingPointRange<Double>,
    yTicks: List<Double>,
    xTicks: List<Double>,
    formatY: (Double) -> String,
    formatX: (Double) -> String,
    modifier: Modifier = Modifier,
    area: Dp = 148.dp,
    draw: Plot.() -> Unit,
) {
    val measurer = rememberTextMeasurer()
    val style = MaterialTheme.typography.labelSmall.withTabularFigures()
    val muted = MaterialTheme.colorScheme.onSurfaceVariant
    val gridColor = MaterialTheme.colorScheme.outlineVariant
    val labelHeight =
        with(LocalDensity.current) {
            measurer
                .measure("0", style)
                .size.height
                .toDp()
        }
    val height = TOP + area + maxOf(MIN_BOTTOM, labelHeight + LABEL_GAP)

    Canvas(modifier.fillMaxWidth().height(height).clearAndSetSemantics {}) {
        val yLabels = yTicks.map { measurer.measure(formatY(it), style.copy(color = muted)) }
        val xLabels = xTicks.map { measurer.measureLine(formatX(it), style.copy(color = muted), size.width) }
        val gap = LABEL_GAP.toPx()
        val left = if (yLabels.isEmpty()) RIGHT.toPx() else max(MIN_LEFT.toPx(), yLabels.maxOf { it.size.width } + gap)
        val right = size.width - RIGHT.toPx()
        val top = TOP.toPx()
        val bottom = size.height - max(MIN_BOTTOM.toPx(), (xLabels.maxOfOrNull { it.size.height } ?: 0) + gap)
        val x = LinearScale(xDomain, left to right)
        val y = LinearScale(yDomain, bottom to top)
        val baseline = yTicks.minOrNull()
        val dashes = PathEffect.dashPathEffect(floatArrayOf(DASH.toPx(), DASH_GAP.toPx()))

        yTicks.zip(yLabels).forEach { (tick, label) ->
            val py = y.toPixel(tick)
            val effect = if (tick == baseline) null else dashes
            drawLine(gridColor, Offset(left, py), Offset(right, py), strokeWidth = 1.dp.toPx(), pathEffect = effect)
            drawText(label, topLeft = Offset(left - gap - label.size.width, py - label.size.height / 2))
        }
        xTicks.zip(xLabels).forEach { (tick, label) ->
            val start = (x.toPixel(tick) - label.size.width / 2).coerceIn(0f, size.width - label.size.width)
            drawText(label, topLeft = Offset(start, bottom + gap))
        }
        Plot(this, x, y, top, bottom, measurer, style).draw()
    }
}

/** One line no wider than [width], ending in "…" when the text is longer, so it always fits inside. */
internal fun TextMeasurer.measureLine(
    text: String,
    style: TextStyle,
    width: Float,
) = measure(text, style, overflow = TextOverflow.Ellipsis, maxLines = 1, constraints = Constraints(maxWidth = width.toInt().coerceAtLeast(0)))

private val MIN_LEFT = 44.dp
private val RIGHT = 12.dp
private val TOP = 12.dp
private val MIN_BOTTOM = 24.dp
private val LABEL_GAP = 6.dp
private val DASH = 3.dp
private val DASH_GAP = 4.dp
private val DOT_RING = 2.5.dp
private val GUIDE_DASH = 3.dp
private val GUIDE_WIDTH = 1.5.dp
private val MAX_BAR_RADIUS = 3.dp
private const val BAR_ROUNDING = 0.25f
