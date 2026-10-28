package com.zoonk.android.ui.components

import androidx.compose.foundation.Canvas
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
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp

/**
 * A share filled in on a thin track, under or beside the number it explains: a lesson's progress,
 * a mission, Energy. Progress's soft blue by default; Energy passes `MaterialTheme.zoonk.energy`
 * and Brain Power `MaterialTheme.zoonk.brain`. Material's end dot stays off, since a blue dot is
 * the learner's place. Hidden from TalkBack, where the words beside it say the number, unless
 * `contentDescription` names it.
 */
@Composable
fun Meter(
    share: Float,
    modifier: Modifier = Modifier,
    color: Color = MaterialTheme.colorScheme.tertiary,
    contentDescription: String? = null,
) {
    LinearProgressIndicator(
        progress = { share.coerceIn(0f, 1f) },
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

/** One part of `MeterParts`, as long as its `weight`. */
@Immutable
data class MeterPart(
    val fill: Fill,
    val weight: Float = 1f,
) {
    sealed interface Fill {
        /** What's still to do: the track. */
        data object Track : Fill

        /** The learner's place, the edge of their progress: a ring in progress's blue. */
        data object Place : Fill

        /** What it measures: `tertiary` for done, `error` for wrong, a kind's color. */
        data class Solid(
            val color: Color,
        ) : Fill
    }
}

/**
 * A meter made of parts under the number it explains (main's `MeterParts`): each part as long as
 * its weight and filled by what it measures, so the number's make-up reads at a glance (a day's
 * blocks by their minutes, a lesson's answers). A single share is a `Meter`. Hidden from TalkBack
 * like `Meter`.
 */
@Composable
fun MeterParts(
    parts: List<MeterPart>,
    modifier: Modifier = Modifier,
    contentDescription: String? = null,
) {
    val track = MaterialTheme.colorScheme.surfaceContainerHighest
    val place = MaterialTheme.colorScheme.tertiary
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl

    Canvas(
        modifier
            .fillMaxWidth()
            .height(METER_HEIGHT)
            .meterSemantics(contentDescription),
    ) {
        val gap = 2.dp.toPx()
        val minimum = 4.dp.toPx()
        val ring = 1.5.dp.toPx()
        val radius = CornerRadius(size.height / 2)
        val totalWeight = parts.sumOf { it.weight.coerceAtLeast(0f).toDouble() }.toFloat()
        val shared = (size.width - parts.size * minimum - (parts.size - 1).coerceAtLeast(0) * gap).coerceAtLeast(0f)
        var start = 0f

        for (part in parts) {
            val share = if (totalWeight > 0) part.weight.coerceAtLeast(0f) / totalWeight else 0f
            val width = minimum + shared * share
            val left = if (rtl) size.width - start - width else start
            val partSize = Size(width, size.height)

            when (val fill = part.fill) {
                MeterPart.Fill.Track -> {
                    drawRoundRect(track, Offset(left, 0f), partSize, radius)
                }

                MeterPart.Fill.Place -> {
                    drawRoundRect(
                        color = place,
                        topLeft = Offset(left + ring / 2, ring / 2),
                        size = Size(width - ring, size.height - ring),
                        cornerRadius = radius,
                        style = Stroke(ring),
                    )
                }

                is MeterPart.Fill.Solid -> {
                    drawRoundRect(fill.color, Offset(left, 0f), partSize, radius)
                }
            }

            start += width + gap
        }
    }
}

private val METER_HEIGHT = 6.dp

private fun Modifier.meterSemantics(contentDescription: String?): Modifier =
    if (contentDescription == null) {
        clearAndSetSemantics {}
    } else {
        semantics { this.contentDescription = contentDescription }
    }
