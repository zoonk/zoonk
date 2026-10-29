package com.zoonk.android.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.zoonk.android.R

enum class MarkStatus { Done, Next, Skipped, Todo }

/**
 * The learner's place is a dot with a halo, never a fill: a fill means done. Decorative unless
 * `contentDescription` names a state the row's words don't.
 */
@Composable
fun StatusMark(
    status: MarkStatus,
    modifier: Modifier = Modifier,
    contentDescription: String? = null,
) {
    val box = markSize()
    val tertiary = MaterialTheme.colorScheme.tertiary
    val todo = MaterialTheme.colorScheme.onSurface.copy(alpha = TODO_ALPHA)

    Box(
        modifier = modifier.size(box).markSemantics(contentDescription),
        contentAlignment = Alignment.Center,
    ) {
        when (status) {
            MarkStatus.Done -> {
                DoneMark()
            }

            MarkStatus.Skipped -> {
                Icon(
                    painter = painterResource(R.drawable.ic_fast_forward_filled),
                    contentDescription = null,
                    modifier = Modifier.size(box * SKIPPED_SHARE),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            MarkStatus.Next -> {
                Canvas(Modifier.size(box)) {
                    val dot = size.minDimension * DOT_SHARE / 2
                    drawCircle(tertiary.copy(alpha = HALO_ALPHA), radius = dot * HALO_SCALE)
                    drawCircle(tertiary, radius = dot)
                }
            }

            MarkStatus.Todo -> {
                Canvas(Modifier.size(box)) {
                    drawCircle(todo, radius = size.minDimension * DOT_SHARE / 2)
                }
            }
        }
    }
}

/** Part done, as a blue ring filling on the track: a chapter or topic the learner has started. */
@Composable
fun ProgressMark(
    progress: Float,
    modifier: Modifier = Modifier,
    contentDescription: String? = null,
) {
    Box(
        modifier = modifier.size(markSize()).markSemantics(contentDescription),
        contentAlignment = Alignment.Center,
    ) {
        CircularProgressIndicator(
            progress = { progress },
            modifier = Modifier.fillMaxSize(RING_SHARE),
            color = MaterialTheme.colorScheme.tertiary,
            trackColor = MaterialTheme.colorScheme.surfaceContainerHighest,
            strokeWidth = 2.dp,
            gapSize = 0.dp,
        )
    }
}

@Composable
fun DoneMark(modifier: Modifier = Modifier) {
    Icon(
        painter = painterResource(R.drawable.ic_check),
        contentDescription = null,
        modifier = modifier.size(markSize() * ICON_SHARE),
        tint = MaterialTheme.colorScheme.tertiary,
    )
}

/** One line of body text, so marks grow with the font and rows' words start in one place. */
@Composable
internal fun markSize(): Dp =
    with(LocalDensity.current) {
        MaterialTheme.typography.bodyLarge.lineHeight
            .toDp()
    }

internal fun Modifier.markSemantics(contentDescription: String?): Modifier =
    clearAndSetSemantics {
        if (contentDescription != null) {
            this.contentDescription = contentDescription
            role = Role.Image
        }
    }

internal const val ICON_SHARE = 0.75f
private const val SKIPPED_SHARE = 0.55f
private const val RING_SHARE = 0.8f

internal const val DOT_SHARE = 1 / 3f
private const val HALO_SCALE = 1.75f
private const val HALO_ALPHA = 0.25f

/** Faint in every scheme, so ahead never outshouts the learner's place. */
private const val TODO_ALPHA = 0.2f
