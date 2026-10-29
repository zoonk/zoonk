package com.zoonk.android.feature.activities

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
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

    fun line(
        points: List<Pair<Double, Double>>,
        color: Color,
        width: Dp = 3.dp,
    ) = with(scope) {
        if (points.isEmpty()) return@with
        val path = Path()
        points.forEachIndexed { index, (px, py) ->
            val point = at(px, py)
            if (index == 0) path.moveTo(point.x, point.y) else path.lineTo(point.x, point.y)
        }
        drawPath(path, color, style = Stroke(width.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round))
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

    /** Text centered on a point, lifted by [lift]. */
    fun label(
        text: String,
        x: Double,
        y: Double,
        color: Color,
        lift: Dp = 12.dp,
    ) = with(scope) {
        val measured = measurer.measure(text, style.copy(color = color, fontWeight = FontWeight.SemiBold))
        val point = at(x, y)
        drawText(measured, topLeft = Offset(point.x - measured.size.width / 2, point.y - lift.toPx() - measured.size.height / 2))
    }
}

/**
 * Main's `ActivityPlot`: a dashed grid with its values on the left, the x values under it, and
 * what [draw] adds. Its labels grow with the font size, so the margins measure them.
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
    height: Dp = 184.dp,
    draw: Plot.() -> Unit,
) {
    val measurer = rememberTextMeasurer()
    val style = MaterialTheme.typography.labelSmall.withTabularFigures()
    val muted = MaterialTheme.colorScheme.onSurfaceVariant
    val gridColor = MaterialTheme.colorScheme.outlineVariant

    Canvas(modifier.fillMaxWidth().height(height).clearAndSetSemantics {}) {
        val yLabels = yTicks.map { measurer.measure(formatY(it), style.copy(color = muted)) }
        val xLabels = xTicks.map { measurer.measure(formatX(it), style.copy(color = muted)) }
        val gap = LABEL_GAP.toPx()
        val left = max(MIN_LEFT.toPx(), (yLabels.maxOfOrNull { it.size.width } ?: 0) + gap)
        val right = size.width - RIGHT.toPx()
        val top = TOP.toPx()
        val bottom = size.height - max(MIN_BOTTOM.toPx(), (xLabels.maxOfOrNull { it.size.height } ?: 0) + gap)
        val x = LinearScale(xDomain, left to right)
        val y = LinearScale(yDomain, bottom to top)
        val baseline = yTicks.minOrNull()
        val dashes = PathEffect.dashPathEffect(floatArrayOf(DASH.toPx(), DASH_GAP.toPx()))

        yTicks.zip(yLabels).forEach { (tick, label) ->
            val py = y.toPixel(tick)
            drawLine(
                gridColor,
                Offset(left, py),
                Offset(right, py),
                strokeWidth = 1.dp.toPx(),
                pathEffect =
                    if (tick ==
                        baseline
                    ) {
                        null
                    } else {
                        dashes
                    },
            )
            drawText(label, topLeft = Offset(left - gap - label.size.width, py - label.size.height / 2))
        }
        xTicks.zip(xLabels).forEach { (tick, label) ->
            drawText(label, topLeft = Offset(x.toPixel(tick) - label.size.width / 2, bottom + gap))
        }
        Plot(this, x, y, top, bottom, measurer, style).draw()
    }
}

private val MIN_LEFT = 44.dp
private val RIGHT = 12.dp
private val TOP = 12.dp
private val MIN_BOTTOM = 24.dp
private val LABEL_GAP = 6.dp
private val DASH = 3.dp
private val DASH_GAP = 4.dp
private val DOT_RING = 2.5.dp
