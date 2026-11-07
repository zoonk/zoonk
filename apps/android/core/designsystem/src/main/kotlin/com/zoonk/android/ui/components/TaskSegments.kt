package com.zoonk.android.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp

/** Main's `TaskSegment`: one screen, question or block of a task. */
enum class TaskSegment {
    Ahead,
    Current,

    /** A block of the day finished, neither right nor wrong. */
    Done,

    /** Read, or not graded right or wrong (a placement question, a statement left blank, a skipped word). */
    Read,
    Right,
    Wrong,
}

/**
 * Main's `TaskHeaderSegments`: a task's progress, one segment per screen, each as wide as its weight when [weights]
 * gives one. Hidden from TalkBack unless [contentDescription] names it; with [done] too, TalkBack reads it as a
 * progress bar.
 */
@Composable
fun TaskSegments(
    segments: List<TaskSegment>,
    modifier: Modifier = Modifier,
    weights: List<Float>? = null,
    contentDescription: String? = null,
    done: Int? = null,
) {
    val colors = MaterialTheme.colorScheme
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    val shares = segments.indices.map { weights?.getOrNull(it)?.coerceAtLeast(1f) ?: 1f }
    val semantics =
        if (contentDescription == null) {
            Modifier.clearAndSetSemantics {}
        } else {
            Modifier.semantics {
                this.contentDescription = contentDescription
                if (done != null) {
                    progressBarRangeInfo = ProgressBarRangeInfo(done.toFloat(), 0f..segments.size.coerceAtLeast(1).toFloat())
                }
            }
        }

    Canvas(modifier.fillMaxWidth().height(SEGMENT_HEIGHT).then(semantics)) {
        val gap = (if (segments.size > DENSE_SEGMENTS) 1.dp else 3.dp).toPx()
        val ring = 1.dp.toPx()
        val radius = CornerRadius(2.dp.toPx())
        val shared = (size.width - gap * (segments.size - 1).coerceAtLeast(0)).coerceAtLeast(0f)
        val total = shares.sum()
        var start = 0f

        segments.forEachIndexed { index, segment ->
            val width = if (total > 0f) shared * shares[index] / total else 0f
            val left = if (rtl) size.width - start - width else start

            val fill =
                when (segment) {
                    TaskSegment.Ahead -> colors.surfaceContainerHighest
                    TaskSegment.Current -> null
                    TaskSegment.Done, TaskSegment.Right -> colors.tertiary
                    TaskSegment.Read -> colors.onSurface.copy(alpha = READ_ALPHA)
                    TaskSegment.Wrong -> colors.error
                }

            if (fill == null) {
                drawRoundRect(
                    color = colors.tertiary,
                    topLeft = Offset(left + ring / 2, ring / 2),
                    size = Size(width - ring, size.height - ring),
                    cornerRadius = radius,
                    style = Stroke(ring),
                )
            } else {
                drawRoundRect(fill, Offset(left, 0f), Size(width, size.height), radius)
            }

            start += width + gap
        }
    }
}

private val SEGMENT_HEIGHT = 4.dp
private const val DENSE_SEGMENTS = 40
private const val READ_ALPHA = 0.25f
