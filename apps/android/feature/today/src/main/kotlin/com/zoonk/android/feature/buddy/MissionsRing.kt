package com.zoonk.android.feature.buddy

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import com.zoonk.android.ui.theme.zoonk

internal enum class MissionArcTone { Open, Done, Complete }

/** In Compose's degrees: 0 at three o'clock, turning clockwise. */
internal data class MissionArc(
    val startDegrees: Float,
    val sweepDegrees: Float,
    val tone: MissionArcTone,
)

/** One arc per mission from the top, clockwise, as main's `missions-ring-arc`. */
internal fun missionArcs(
    done: Int,
    total: Int,
): List<MissionArc> {
    val span = FULL_TURN / total
    val complete = total > 0 && done >= total

    return List(total) { index ->
        MissionArc(
            startDegrees = START_DEGREES + index * span + GAP_DEGREES / 2,
            sweepDegrees = span - GAP_DEGREES,
            tone =
                when {
                    index >= done -> MissionArcTone.Open
                    complete -> MissionArcTone.Complete
                    else -> MissionArcTone.Done
                },
        )
    }
}

/**
 * Today's missions as a ring around [content]: done ones darker, all in Brain Power's violet once
 * every one is done. Decorative: what it sits in says the count. [strokeWidth] is in main's 36-unit box.
 */
@Composable
fun MissionsRing(
    done: Int,
    total: Int,
    modifier: Modifier = Modifier,
    strokeWidth: Float = 2f,
    content: @Composable BoxScope.() -> Unit = {},
) {
    val arcs = remember(done, total) { missionArcs(done, total) }
    val open = MaterialTheme.colorScheme.onSurface.copy(alpha = OPEN_ALPHA)
    val doneColor = MaterialTheme.colorScheme.onSurface.copy(alpha = DONE_ALPHA)
    val complete = MaterialTheme.zoonk.brain

    Box(
        modifier =
            modifier.drawBehind {
                val unit = size.minDimension / RING_VIEW_BOX
                val radius = RADIUS * unit
                val stroke = Stroke(width = strokeWidth * unit, cap = StrokeCap.Round)

                arcs.forEach { arc ->
                    drawArc(
                        color =
                            when (arc.tone) {
                                MissionArcTone.Open -> open
                                MissionArcTone.Done -> doneColor
                                MissionArcTone.Complete -> complete
                            },
                        startAngle = arc.startDegrees,
                        sweepAngle = arc.sweepDegrees,
                        useCenter = false,
                        topLeft = center - Offset(radius, radius),
                        size = Size(radius * 2, radius * 2),
                        style = stroke,
                    )
                }
            },
        contentAlignment = Alignment.Center,
        content = content,
    )
}

private const val RING_VIEW_BOX = 36f
private const val RADIUS = 17f
private const val FULL_TURN = 360f
private const val GAP_DEGREES = 22f
private const val START_DEGREES = -90f
private const val OPEN_ALPHA = 0.15f
private const val DONE_ALPHA = 0.5f
