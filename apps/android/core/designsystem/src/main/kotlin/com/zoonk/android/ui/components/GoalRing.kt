package com.zoonk.android.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/** How a day's ring track reads: today, a missed study day (dashed), a rest day (fainter) or any other. */
enum class GoalRingTrack { Default, Missed, Rest, Today }

/**
 * A day's share of its goal as a ring (main's `GoalRing`), filled in the progress color from the
 * top. Decorative: the row it sits in says the day's status.
 */
@Composable
fun GoalRing(
    share: Float,
    modifier: Modifier = Modifier,
    track: GoalRingTrack = GoalRingTrack.Default,
    size: Dp = 30.dp,
    content: @Composable BoxScope.() -> Unit = {},
) {
    val onSurface = MaterialTheme.colorScheme.onSurface
    val progress = MaterialTheme.colorScheme.tertiary
    val trackColor =
        when (track) {
            GoalRingTrack.Default -> onSurface.copy(alpha = 0.1f)
            GoalRingTrack.Missed, GoalRingTrack.Today -> onSurface.copy(alpha = 0.25f)
            GoalRingTrack.Rest -> onSurface.copy(alpha = 0.06f)
        }

    Box(modifier.size(size).clearAndSetSemantics {}, contentAlignment = Alignment.Center) {
        Canvas(Modifier.matchParentSize()) {
            val stroke = this.size.minDimension / RING_STROKE_SHARE
            val dash = stroke
            val trackStroke =
                Stroke(
                    width = stroke,
                    pathEffect = if (track == GoalRingTrack.Missed) PathEffect.dashPathEffect(floatArrayOf(dash, dash * 1.1f)) else null,
                )
            val inset = stroke / 2
            val arcSize =
                androidx.compose.ui.geometry
                    .Size(this.size.width - stroke, this.size.height - stroke)
            val topLeft =
                androidx.compose.ui.geometry
                    .Offset(inset, inset)

            drawArc(
                trackColor,
                startAngle = 0f,
                sweepAngle = 360f,
                useCenter = false,
                topLeft = topLeft,
                size = arcSize,
                style = trackStroke,
            )
            if (share > 0f) {
                drawArc(
                    color = progress,
                    startAngle = -90f,
                    sweepAngle = 360f * share.coerceAtMost(1f),
                    useCenter = false,
                    topLeft = topLeft,
                    size = arcSize,
                    style = Stroke(width = stroke, cap = StrokeCap.Round),
                )
            }
        }
        content()
    }
}

/** Main draws a 3-wide stroke on a 36 box. */
private const val RING_STROKE_SHARE = 12f
