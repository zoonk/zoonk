package com.zoonk.android.ui.components

import androidx.annotation.DrawableRes
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.theme.zoonk

/**
 * Main's `KIND_MARKS`. Kinds that do the same job share a hue and differ by their symbol, and a
 * lesson, the default, stays neutral.
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

/** Only where kinds sit side by side; a list of one kind shows each row's `StatusMark`. */
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

/** A list row's kind dot in the room an icon takes, so its words line up with the rows that have icons. */
@Composable
fun KindDotLeading(kind: LearnKind) {
    Box(Modifier.size(LEADING_SIZE), contentAlignment = Alignment.Center) { KindDot(kind) }
}

private val LEADING_SIZE = 24.dp
