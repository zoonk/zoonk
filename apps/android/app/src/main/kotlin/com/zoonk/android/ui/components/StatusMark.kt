package com.zoonk.android.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
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
import com.zoonk.android.R

/** Where a thing in a list stands. */
enum class MarkStatus { Done, Next, Skipped, Todo }

/**
 * Where a thing in a list stands, the same in every list (chapters, lessons, phases): progress's
 * blue check once done, a quiet fast-forward once skipped because the learner showed they know
 * it, the learner's place as a blue dot with a halo (a place is never a fill: a fill is done) and
 * a faint dot ahead. Every mark takes one line of body text, so rows' words start in one
 * place and marks grow with the font. Decorative unless `contentDescription` names the state the
 * row's words don't.
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

/**
 * The one mark for something done, wherever it shows: progress's blue check. Decorative: the
 * row's words say it's done.
 */
@Composable
fun DoneMark(modifier: Modifier = Modifier) {
    Icon(
        painter = painterResource(R.drawable.ic_check),
        contentDescription = null,
        modifier = modifier.size(markSize() * ICON_SHARE),
        tint = MaterialTheme.colorScheme.tertiary,
    )
}

/** A mark's box: one line of body text, so it grows with the font and sits on a row's first line. */
@Composable
internal fun markSize(): Dp =
    with(LocalDensity.current) {
        MaterialTheme.typography.bodyLarge.lineHeight
            .toDp()
    }

/** Hidden from TalkBack, or read as one image when it says what the words beside it don't. */
internal fun Modifier.markSemantics(contentDescription: String?): Modifier =
    clearAndSetSemantics {
        if (contentDescription != null) {
            this.contentDescription = contentDescription
            role = Role.Image
        }
    }

/** An icon mark's share of the box. */
internal const val ICON_SHARE = 0.75f
private const val SKIPPED_SHARE = 0.55f

/** A dot's share of the box, and its halo around it. */
internal const val DOT_SHARE = 1 / 3f
private const val HALO_SCALE = 1.75f
private const val HALO_ALPHA = 0.25f

/** Ahead stays faint in every scheme, so it never outshouts the learner's place. */
private const val TODO_ALPHA = 0.2f
