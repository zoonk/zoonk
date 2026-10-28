package com.zoonk.android.ui.components

import androidx.annotation.DrawableRes
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import com.zoonk.android.R
import com.zoonk.android.ui.theme.zoonk

/**
 * The kinds of things a learner meets, each with one color and one Material Symbol everywhere
 * (main's `KIND_MARKS`, Apple's `LearnKind`). A lesson, the default, is neutral. Kinds that do
 * the same job share a hue and differ by their symbol: review, practice and mistakes go back over
 * what was learned, a mock and a challenge test what the learner knows. A list of one kind marks
 * each row's state (`StatusMark`) instead.
 */
enum class LearnKind(
    @param:DrawableRes val icon: Int,
) {
    /** lucide Swords, SF figure.fencing. */
    Challenge(R.drawable.ic_swords),

    /** lucide MessagesSquare, SF bubble.left.and.bubble.right. */
    Conversation(R.drawable.ic_forum),

    /** lucide PenLine, SF pencil.line. */
    Essay(R.drawable.ic_border_color),

    /** lucide BookOpen, SF book. */
    Lesson(R.drawable.ic_menu_book),

    /** lucide Network, SF point.3.connected.trianglepath.dotted. */
    MindMap(R.drawable.ic_lan),

    /** lucide NotebookPen, SF square.and.pencil. */
    Mistakes(R.drawable.ic_edit_square),

    /** lucide Timer, SF timer. */
    Mock(R.drawable.ic_timer),

    /** lucide Dumbbell, SF dumbbell. */
    Practice(R.drawable.ic_fitness_center),

    /** lucide RotateCcw, SF arrow.counterclockwise. */
    Review(R.drawable.ic_replay),
}

/** A kind's color, for its mark, its dot or its part of a meter. */
val LearnKind.color: Color
    @Composable
    @ReadOnlyComposable
    get() =
        when (this) {
            LearnKind.Lesson -> MaterialTheme.colorScheme.onSurfaceVariant
            LearnKind.Mistakes, LearnKind.Practice, LearnKind.Review -> MaterialTheme.zoonk.kindReview
            LearnKind.Challenge, LearnKind.Mock -> MaterialTheme.zoonk.kindMock
            LearnKind.Conversation, LearnKind.Essay -> MaterialTheme.zoonk.kindConversation
            LearnKind.MindMap -> MaterialTheme.zoonk.kindMindMap
        }

/**
 * A kind's symbol in its color where kinds sit side by side (the day's queue, the missions, a
 * plan's events), as big as the `StatusMark` that takes its place once done. The shape tells
 * kinds apart where hue alone wouldn't. Decorative: the row's words name the thing.
 */
@Composable
fun KindMark(
    kind: LearnKind,
    modifier: Modifier = Modifier,
) {
    Icon(
        painter = painterResource(kind.icon),
        contentDescription = null,
        modifier = modifier.size(markSize() * ICON_SHARE),
        tint = kind.color,
    )
}

/** A kind as a small dot in its color, the quieter mark of a row in a queue. Decorative. */
@Composable
fun KindDot(
    kind: LearnKind,
    modifier: Modifier = Modifier,
) {
    val color = kind.color

    Canvas(modifier.size(markSize() * DOT_SHARE)) {
        drawCircle(color)
    }
}
