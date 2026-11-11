package com.zoonk.android.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import kotlin.math.roundToInt

/**
 * Material's end dot stays off: a blue dot is the learner's place. Hidden from TalkBack, since
 * the words beside a meter say its number, unless `contentDescription` names it.
 */
@Composable
fun Meter(
    share: Float,
    modifier: Modifier = Modifier,
    color: Color = MaterialTheme.colorScheme.tertiary,
    contentDescription: String? = null,
) {
    LinearProgressIndicator(
        // A share that reads as 0% draws nothing: Material's round cap would paint a whole dot for it.
        progress = { share.coerceIn(0f, 1f).takeIf { it >= HALF_PERCENT } ?: 0f },
        modifier =
            modifier
                .fillMaxWidth()
                .height(METER_HEIGHT)
                .meterSemantics(contentDescription),
        color = color,
        trackColor = MaterialTheme.colorScheme.surfaceContainerHighest,
        drawStopIndicator = {},
    )
}

@Immutable
data class MeterPart(
    val fill: Fill,
    val weight: Float = 1f,
) {
    sealed interface Fill {
        data object Track : Fill

        /** [share] (0 to 1) of it is done: the session's current block. */
        data class Place(
            val share: Float = 0f,
        ) : Fill

        /** [share] (0 to 1) of it filled, from the start. */
        data class Solid(
            val color: Color,
            val share: Float = 1f,
        ) : Fill
    }
}

/**
 * Main's `MeterParts`, hidden from TalkBack like `Meter`. [part] lays each part's own control over
 * it, as wide as the part and centered on the bar, so it can stand taller than the bar to be tapped.
 */
@Composable
fun MeterParts(
    parts: List<MeterPart>,
    modifier: Modifier = Modifier,
    contentDescription: String? = null,
    part: (@Composable (index: Int) -> Unit)? = null,
) {
    val bar = modifier.fillMaxWidth().height(METER_HEIGHT)

    if (part == null) {
        PartsCanvas(parts, bar.meterSemantics(contentDescription))
        return
    }

    Box(bar.semantics { contentDescription?.let { this.contentDescription = it } }) {
        PartsCanvas(parts, Modifier.matchParentSize())
        Layout(content = { parts.indices.forEach { part(it) } }, modifier = Modifier.matchParentSize()) { measurables, constraints ->
            val spans = partSpans(parts, constraints.maxWidth.toFloat(), GAP.toPx(), MINIMUM.toPx())
            val placeables =
                measurables.mapIndexed {
                    index,
                    measurable,
                    ->
                    measurable.measure(Constraints.fixedWidth(spans[index].width.roundToInt()))
                }

            layout(constraints.maxWidth, constraints.maxHeight) {
                placeables.forEachIndexed { index, placeable ->
                    placeable.placeRelative(spans[index].start.roundToInt(), (constraints.maxHeight - placeable.height) / 2)
                }
            }
        }
    }
}

@Composable
private fun PartsCanvas(
    parts: List<MeterPart>,
    modifier: Modifier,
) {
    val track = MaterialTheme.colorScheme.surfaceContainerHighest
    val place = MaterialTheme.colorScheme.tertiary
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl

    Canvas(modifier) {
        val ring = 1.5.dp.toPx()
        val radius = CornerRadius(size.height / 2)
        val spans = partSpans(parts, size.width, GAP.toPx(), MINIMUM.toPx())

        parts.forEachIndexed { index, part ->
            val (start, width) = spans[index]
            val left = if (rtl) size.width - start - width else start
            val partSize = Size(width, size.height)

            when (val fill = part.fill) {
                MeterPart.Fill.Track -> {
                    drawRoundRect(track, Offset(left, 0f), partSize, radius)
                }

                is MeterPart.Fill.Place -> {
                    val done = width * fill.share.coerceIn(0f, 1f)
                    if (done > 0f) {
                        val doneLeft = if (rtl) left + width - done else left
                        drawRoundRect(place, Offset(doneLeft, 0f), Size(done, size.height), radius)
                    }
                    drawRoundRect(
                        color = place,
                        topLeft = Offset(left + ring / 2, ring / 2),
                        size = Size(width - ring, size.height - ring),
                        cornerRadius = radius,
                        style = Stroke(ring),
                    )
                }

                is MeterPart.Fill.Solid -> {
                    val filled = width * fill.share.coerceIn(0f, 1f)
                    if (filled < width) drawRoundRect(track, Offset(left, 0f), partSize, radius)
                    if (filled > 0f) {
                        val filledLeft = if (rtl) left + width - filled else left
                        drawRoundRect(fill.color, Offset(filledLeft, 0f), Size(filled, size.height), radius)
                    }
                }
            }
        }
    }
}

private data class PartSpan(
    val start: Float,
    val width: Float,
)

/** Each part's span from the bar's start: at least [minimum] wide, sharing the rest by weight. */
private fun partSpans(
    parts: List<MeterPart>,
    barWidth: Float,
    gap: Float,
    minimum: Float,
): List<PartSpan> {
    val totalWeight = parts.sumOf { it.weight.coerceAtLeast(0f).toDouble() }.toFloat()
    val shared = (barWidth - parts.size * minimum - (parts.size - 1).coerceAtLeast(0) * gap).coerceAtLeast(0f)
    var start = 0f

    return parts.map { part ->
        val share = if (totalWeight > 0) part.weight.coerceAtLeast(0f) / totalWeight else 0f
        val width = minimum + shared * share
        PartSpan(start, width).also { start += width + gap }
    }
}

private val METER_HEIGHT = 6.dp
private val GAP = 2.dp
private val MINIMUM = 4.dp

private fun Modifier.meterSemantics(contentDescription: String?): Modifier =
    if (contentDescription == null) {
        clearAndSetSemantics {}
    } else {
        semantics { this.contentDescription = contentDescription }
    }

private const val HALF_PERCENT = 0.005f
