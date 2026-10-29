package com.zoonk.android.feature.exam

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.border
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.input.pointer.PointerType
import androidx.compose.ui.input.pointer.changedToDown
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.setProgress
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.dp
import com.zoonk.android.ui.components.LearnKind
import com.zoonk.android.ui.components.color
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatPercent
import com.zoonk.android.ui.theme.withTabularFigures
import kotlin.math.floor
import kotlin.math.roundToInt

/** A mock on the chart: [label] its score in words, [detail] which mock and when. */
internal data class ProgressPoint(
    val label: String,
    val detail: String,
    val value: Int,
)

/**
 * Main's `ProgressLineChart`: each mock's score, from 0% (lower when a net score went below it) to
 * 100%. A finger, a pointer or the arrow keys show one mock's score and name; TalkBack reads [label]
 * and moves between mocks as on a slider.
 */
@Composable
internal fun ProgressLineChart(
    points: List<ProgressPoint>,
    label: String,
    first: String,
    latest: String,
) {
    val values = points.map { it.value }
    val floor = chartFloor(values)
    val ticks = listOf(TOP, (TOP + floor) / 2, floor)
    var active by remember(points.size) { mutableStateOf<Int?>(null) }
    var focused by remember { mutableStateOf(false) }
    val shown = active ?: points.lastIndex
    val picked = points[shown]
    val color = LearnKind.Mock.color
    val grid = MaterialTheme.colorScheme.outlineVariant
    val ring = MaterialTheme.colorScheme.surface
    val guide = MaterialTheme.colorScheme.onSurface.copy(alpha = GUIDE_ALPHA)
    val axis = MaterialTheme.typography.labelSmall.withTabularFigures()
    val axisColor = MaterialTheme.colorScheme.onSurfaceVariant
    val locale = currentLocale()
    val clamp = { index: Int -> index.coerceIn(0, points.lastIndex) }
    // Taller with larger text, so the readout keeps room inside it.
    val chartHeight = CHART_HEIGHT * LocalDensity.current.fontScale.coerceAtLeast(1f)

    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Column(
            Modifier.height(chartHeight).widthIn(min = 36.dp).clearAndSetSemantics {},
            verticalArrangement = Arrangement.SpaceBetween,
        ) {
            ticks.forEach { Text(formatPercent(it / TOP.toDouble(), locale), color = axisColor, style = axis, textAlign = TextAlign.End) }
        }

        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Box(
                Modifier
                    .fillMaxWidth()
                    .height(chartHeight)
                    .then(if (focused) Modifier.border(2.dp, MaterialTheme.colorScheme.primary, RoundedCornerShape(4.dp)) else Modifier)
                    .semantics {
                        contentDescription = label
                        stateDescription = "${picked.label}: ${picked.detail}"
                        progressBarRangeInfo =
                            ProgressBarRangeInfo(
                                (shown + 1).toFloat(),
                                1f..points.size.toFloat(),
                                steps = (points.size - 2).coerceAtLeast(0),
                            )
                        setProgress { target ->
                            active = clamp(target.roundToInt() - 1)
                            true
                        }
                    }.onFocusChanged {
                        focused = it.isFocused
                        active = if (it.isFocused) active ?: points.lastIndex else null
                    }.focusable()
                    .onKeyEvent { event ->
                        if (event.type != KeyEventType.KeyDown) return@onKeyEvent false
                        val current = active ?: points.lastIndex
                        val next =
                            when (event.key) {
                                Key.DirectionLeft -> current - 1
                                Key.DirectionRight -> current + 1
                                Key.MoveHome -> 0
                                Key.MoveEnd -> points.lastIndex
                                else -> return@onKeyEvent false
                            }
                        active = clamp(next)
                        true
                    }.pointerInput(points.size) {
                        val nearest = { x: Float -> clamp(((x / size.width) * points.lastIndex).roundToInt()) }
                        awaitPointerEventScope {
                            while (true) {
                                val event = awaitPointerEvent()
                                val change = event.changes.firstOrNull() ?: continue
                                if (change.type != PointerType.Mouse) continue
                                when (event.type) {
                                    PointerEventType.Enter, PointerEventType.Move -> active = nearest(change.position.x)
                                    PointerEventType.Exit -> active = null
                                }
                            }
                        }
                    }.pointerInput(points.size) {
                        val nearest = { x: Float -> clamp(((x / size.width) * points.lastIndex).roundToInt()) }
                        // Follows a finger sideways; a vertical drag the page takes for scrolling lets go, as main's `touch-pan-y`.
                        awaitPointerEventScope {
                            while (true) {
                                val down =
                                    awaitPointerEvent().changes.firstOrNull { it.changedToDown() && it.type != PointerType.Mouse }
                                        ?: continue
                                active = nearest(down.position.x)
                                while (true) {
                                    val change = awaitPointerEvent(PointerEventPass.Final).changes.firstOrNull { it.id == down.id }
                                    if (change == null || !change.pressed || change.isConsumed) break
                                    active = nearest(change.position.x)
                                }
                                active = null
                            }
                        }
                    },
            ) {
                Canvas(Modifier.fillMaxSize()) {
                    ticks.forEach { tick ->
                        val y = toY(tick, floor) * size.height
                        drawLine(grid, Offset(0f, y), Offset(size.width, y), strokeWidth = 1.dp.toPx())
                    }
                    drawChartLine(values, floor, color, wash = true)
                    values.forEachIndexed { index, value ->
                        val center = point(index, value, values.size, floor)
                        drawCircle(ring, radius = 6.dp.toPx(), center = center)
                        drawCircle(color, radius = 4.dp.toPx(), center = center)
                    }
                    active?.let { index ->
                        val center = point(index, values[index], values.size, floor)
                        drawLine(guide, Offset(center.x, 0f), Offset(center.x, size.height), strokeWidth = 1.dp.toPx())
                        drawCircle(ring, radius = 8.dp.toPx(), center = center)
                        drawCircle(color, radius = 6.dp.toPx(), center = center)
                    }
                }
                active?.let { index -> Readout(points[index], toX(index, values.size), toY(values[index], floor)) }
            }

            Row(Modifier.fillMaxWidth().clearAndSetSemantics {}, horizontalArrangement = Arrangement.SpaceBetween) {
                Text(first, color = axisColor, style = axis)
                Text(latest, color = axisColor, style = axis)
            }
        }
    }
}

/** The picked mock's score and name above its point, kept inside the chart's width. */
@Composable
private fun Readout(
    point: ProgressPoint,
    x: Float,
    y: Float,
) {
    Layout(
        content = {
            Surface(
                shape = MaterialTheme.shapes.small,
                color = MaterialTheme.colorScheme.inverseSurface,
                contentColor = MaterialTheme.colorScheme.inverseOnSurface,
            ) {
                Column(Modifier.padding(horizontal = 12.dp, vertical = 6.dp)) {
                    Text(point.label, style = MaterialTheme.typography.labelLarge.withTabularFigures())
                    Text(point.detail, style = MaterialTheme.typography.labelSmall)
                }
            }
        },
        modifier = Modifier.fillMaxSize().clearAndSetSemantics {},
    ) { measurables, constraints ->
        val gap = 12.dp.roundToPx()
        val bubble = measurables.first().measure(Constraints(maxWidth = minOf(constraints.maxWidth, READOUT_WIDTH.roundToPx())))
        layout(constraints.maxWidth, constraints.maxHeight) {
            val left =
                (x * constraints.maxWidth - bubble.width / 2f).roundToInt().coerceIn(
                    0,
                    (constraints.maxWidth - bubble.width).coerceAtLeast(0),
                )
            // Above the point when it fits, else under it: the readout never leaves the plot.
            val point = (y * constraints.maxHeight).roundToInt()
            val above = point - bubble.height - gap
            val top = if (above >= 0) above else (point + gap).coerceAtMost(constraints.maxHeight - bubble.height).coerceAtLeast(0)
            bubble.place(left, top)
        }
    }
}

/** A subject's scores, mock by mock, its latest one marked. */
@Composable
internal fun Sparkline(values: List<Int>) {
    val floor = chartFloor(values)
    val line = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = SPARKLINE_ALPHA)
    val mark = LearnKind.Mock.color
    val ring = MaterialTheme.colorScheme.surface

    Canvas(Modifier.size(width = 56.dp, height = 20.dp)) {
        drawChartLine(values, floor, line, wash = false)
        val last = point(values.lastIndex, values.last(), values.size, floor)
        drawCircle(ring, radius = 4.dp.toPx(), center = last)
        drawCircle(mark, radius = 3.dp.toPx(), center = last)
    }
}

/** A made-up rising line behind the Plus mark: what the chart shows once there are mocks. */
@Composable
internal fun SampleProgressChart(values: List<Int>) {
    val color = LearnKind.Mock.color
    val grid = MaterialTheme.colorScheme.outlineVariant

    Canvas(Modifier.fillMaxWidth().height(80.dp)) {
        drawLine(grid, Offset.Zero, Offset(size.width, 0f), strokeWidth = 1.dp.toPx())
        drawLine(grid, Offset(0f, size.height), Offset(size.width, size.height), strokeWidth = 1.dp.toPx())
        drawChartLine(values, floor = 0, color = color, wash = true)
    }
}

private fun DrawScope.drawChartLine(
    values: List<Int>,
    floor: Int,
    color: Color,
    wash: Boolean,
) {
    val points = values.mapIndexed { index, value -> point(index, value, values.size, floor) }
    val line = Path().apply { points.forEachIndexed { index, p -> if (index == 0) moveTo(p.x, p.y) else lineTo(p.x, p.y) } }
    if (wash && points.isNotEmpty()) {
        val base = toY(maxOf(floor, 0), floor) * size.height
        val area =
            Path().apply {
                moveTo(0f, base)
                points.forEach { lineTo(it.x, it.y) }
                lineTo(size.width, base)
                close()
            }
        drawPath(area, color.copy(alpha = WASH_ALPHA))
    }
    drawPath(line, color, style = Stroke(width = 2.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round))
}

private fun DrawScope.point(
    index: Int,
    value: Int,
    count: Int,
    floor: Int,
) = Offset(toX(index, count) * size.width, toY(value, floor) * size.height)

/** 0%, or the next 50 below the lowest score when a net score went negative. */
private fun chartFloor(values: List<Int>): Int = floor(minOf(0, values.minOrNull() ?: 0) / NEGATIVE_STEP.toDouble()).toInt() * NEGATIVE_STEP

private fun toY(
    value: Int,
    floor: Int,
): Float = (TOP - value).toFloat() / (TOP - floor)

private fun toX(
    index: Int,
    count: Int,
): Float = if (count > 1) index.toFloat() / (count - 1) else 1f

private const val TOP = 100
private const val NEGATIVE_STEP = 50
private const val WASH_ALPHA = 0.1f
private const val GUIDE_ALPHA = 0.15f
private const val SPARKLINE_ALPHA = 0.5f
private val CHART_HEIGHT = 128.dp
private val READOUT_WIDTH = 224.dp
