package com.zoonk.android.ui.components

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.zoonk.android.ui.theme.zoonk

internal enum class PointShape { Circle, Square, Diamond, Triangle, Cross }

internal class SeriesMark(
    val color: Color,
    val shape: PointShape,
    val open: Boolean,
)

/**
 * How a chart draws each series so it stays apart from the others without relying on color, as main's
 * `getSeriesMark`: a line's points take a shape, and once the six colors are used they come back drawn
 * open (outlined bars, dashed lines with hollow points).
 */
@Composable
internal fun seriesMarks(count: Int): List<SeriesMark> {
    val tones =
        MaterialTheme.zoonk.let {
            listOf(
                it.vizAccent,
                it.vizSecondary,
                it.vizHighlight,
                it.vizSeries4,
                it.vizSeries5,
                it.vizSeries6,
            )
        }
    val shapes = PointShape.entries

    return List(count) { index ->
        SeriesMark(color = tones[index % tones.size], shape = shapes[index % shapes.size], open = index / tones.size % 2 == 1)
    }
}

internal fun DrawScope.drawSeriesBar(
    mark: SeriesMark,
    topLeft: Offset,
    size: Size,
    radius: Dp,
) {
    val stroke = OPEN_STROKE.toPx()

    if (!mark.open || size.minDimension <= stroke * 2) {
        drawRoundRect(mark.color, topLeft, size, CornerRadius(radius.toPx()))
        return
    }

    val inner = Size(size.width - stroke, size.height - stroke)
    val corner = CornerRadius(radius.toPx() - stroke / 2)
    val start = topLeft + Offset(stroke / 2, stroke / 2)

    drawRoundRect(mark.color.copy(alpha = OPEN_FILL), start, inner, corner)
    drawRoundRect(mark.color, start, inner, corner, style = Stroke(stroke))
}

/** A hollow point is filled with [surface], so the line it sits on doesn't show through it. */
internal fun DrawScope.drawSeriesPoint(
    mark: SeriesMark,
    center: Offset,
    surface: Color,
) {
    val unit = 1.dp.toPx()

    if (mark.shape == PointShape.Cross) {
        val arm = CROSS_ARM * unit
        val stroke = LINE_WIDTH.toPx()
        drawLine(mark.color, center - Offset(arm, arm), center + Offset(arm, arm), stroke, StrokeCap.Round)
        drawLine(mark.color, center + Offset(-arm, arm), center + Offset(arm, -arm), stroke, StrokeCap.Round)
        return
    }

    val path = pointPath(mark.shape, center, unit)

    if (mark.open) {
        drawPath(path, surface)
        drawPath(path, mark.color, style = Stroke(OPEN_STROKE.toPx(), join = StrokeJoin.Round))
    } else {
        drawPath(path, mark.color)
    }
}

internal fun DrawScope.seriesLine(mark: SeriesMark) =
    Stroke(
        width = LINE_WIDTH.toPx(),
        join = StrokeJoin.Round,
        pathEffect = if (mark.open) PathEffect.dashPathEffect(OPEN_DASH.map { it.toPx() }.toFloatArray()) else null,
    )

/** Main's point shapes, sized so each weighs about the same as the 3.5 dp dot. */
private fun pointPath(
    shape: PointShape,
    center: Offset,
    unit: Float,
): Path {
    val corners =
        when (shape) {
            PointShape.Diamond -> listOf(0f to -4.5f, 4.5f to 0f, 0f to 4.5f, -4.5f to 0f)
            PointShape.Triangle -> listOf(0f to -4.2f, 4.4f to 3.2f, -4.4f to 3.2f)
            else -> emptyList()
        }

    return Path().apply {
        when (shape) {
            PointShape.Circle -> {
                addOval(Rect(center, DOT_RADIUS * unit))
            }

            PointShape.Square -> {
                addRect(Rect(center, SQUARE_HALF * unit))
            }

            else -> {
                corners.forEachIndexed { index, (x, y) ->
                    val point = center + Offset(x * unit, y * unit)
                    if (index == 0) moveTo(point.x, point.y) else lineTo(point.x, point.y)
                }
                close()
            }
        }
    }
}

internal val LINE_WIDTH = 2.dp
private val OPEN_STROKE = 1.5.dp
private const val OPEN_FILL = 0.2f
private val OPEN_DASH = listOf(5.dp, 4.dp)
private const val DOT_RADIUS = 3.5f
private const val SQUARE_HALF = 3.1f
private const val CROSS_ARM = 3f
