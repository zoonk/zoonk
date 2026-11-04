package com.zoonk.android.ui.components

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.semantics

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
    val parts =
        segments.mapIndexed { index, segment ->
            MeterPart(
                when (segment) {
                    TaskSegment.Ahead -> MeterPart.Fill.Track
                    TaskSegment.Current -> MeterPart.Fill.Place()
                    TaskSegment.Done, TaskSegment.Right -> MeterPart.Fill.Solid(colors.tertiary)
                    TaskSegment.Wrong -> MeterPart.Fill.Solid(colors.error)
                    TaskSegment.Read -> MeterPart.Fill.Solid(colors.onSurface.copy(alpha = READ_ALPHA))
                },
                weight = weights?.getOrNull(index)?.coerceAtLeast(1f) ?: 1f,
            )
        }
    val progress =
        if (contentDescription != null && done != null) {
            Modifier.semantics {
                progressBarRangeInfo = ProgressBarRangeInfo(done.toFloat(), 0f..segments.size.coerceAtLeast(1).toFloat())
            }
        } else {
            Modifier
        }

    MeterParts(parts, modifier.then(progress), contentDescription)
}

private const val READ_ALPHA = 0.25f
