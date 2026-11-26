package com.zoonk.android.feature.questions

import androidx.compose.animation.BoundsTransform
import androidx.compose.animation.ExperimentalSharedTransitionApi
import androidx.compose.animation.animateBounds
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.key
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.LookaheadScope
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.isTraversalGroup
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.traversalIndex
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.dp
import com.zoonk.android.ui.theme.ZoonkMotion

/**
 * The one board for every screen that asks to match these with those (main's `MatchBoard`): the left column beside the
 * right, each card on one row with the card across from it and as tall as the taller of the two, or the right column
 * under the left when the board is narrow for its text. TalkBack reads down the left column, then the right. Once every
 * pair is known ([solved], each left card with its partner) the same cards slide into rows, a pair to a row, as main's
 * do; with animations off they're there at once.
 */
@OptIn(ExperimentalSharedTransitionApi::class)
@Composable
fun <T : Any> MatchBoard(
    left: List<T>,
    right: List<T>,
    modifier: Modifier = Modifier,
    solved: List<Pair<T, T>>? = null,
    card: @Composable (side: MatchSide, item: T, modifier: Modifier) -> Unit,
) {
    val rows = solved ?: left.zip(right)
    // One keyed list, a row at a time, so a card that moves to another row stays the same card and slides there.
    val cards = rows.flatMap { (l, r) -> listOf(MatchSide.Left to l, MatchSide.Right to r) }
    BoardWidth(modifier) { stacked ->
        LookaheadScope {
            val slide = Modifier.animateBounds(this, boundsTransform = SLIDE)
            Layout(
                content = {
                    cards.forEach { (side, item) ->
                        key(side, item) {
                            val order = if (side == MatchSide.Left) left.indexOf(item) else left.size + right.indexOf(item)
                            // While playing, TalkBack reads a column at a time; solved, a pair at a time.
                            val reading = if (solved == null) Modifier.semantics { traversalIndex = order.toFloat() } else Modifier
                            card(side, item, slide.then(reading))
                        }
                    }
                },
                modifier = Modifier.semantics { isTraversalGroup = true },
            ) { measurables, constraints ->
                val width = constraints.maxWidth
                val gap = CARD_GAP.roundToPx()
                val pairGap = STACKED_GAP.roundToPx()
                if (stacked) {
                    val placed = measurables.map { it.measure(Constraints(minWidth = width, maxWidth = width)) }
                    // Children come a row at a time; while playing, every left card goes first, then every right one.
                    val order = if (solved == null) placed.indices.sortedBy { it % 2 } else placed.indices.toList()
                    val tops = IntArray(placed.size)
                    var y = 0
                    order.forEachIndexed { at, child ->
                        if (at > 0) y += if ((solved == null && at == rows.size) || (solved != null && at % 2 == 0)) pairGap else gap
                        tops[child] = y
                        y += placed[child].height
                    }
                    layout(width, y) { placed.forEachIndexed { i, card -> card.placeRelative(0, tops[i]) } }
                } else {
                    val half = (width - gap) / 2
                    var y = 0
                    val spots =
                        measurables.chunked(2).flatMapIndexed { row, (l, r) ->
                            if (row > 0) y += gap
                            val height = maxOf(l.maxIntrinsicHeight(half), r.maxIntrinsicHeight(half))
                            val top = y
                            y += height
                            listOf(l, r).mapIndexed { column, it ->
                                Triple(
                                    it.measure(Constraints.fixed(half, height)),
                                    column * (width - half),
                                    top,
                                )
                            }
                        }
                    layout(width, y) { spots.forEach { (card, x, top) -> card.placeRelative(x, top) } }
                }
            }
        }
    }
}

/**
 * Side by side only while each card keeps a ten-letter word whole: 288dp at default text, growing with the learner's
 * text size. A wide board (a tablet's, never a phone's) sets its words at the reading size, as main's does from 640.
 */
@Composable
private fun BoardWidth(
    modifier: Modifier,
    content: @Composable (stacked: Boolean) -> Unit,
) {
    BoxWithConstraints(modifier.fillMaxWidth()) {
        CompositionLocalProvider(LocalMatchTextStyle provides matchTextStyle(wide = maxWidth >= WIDE_BOARD)) {
            content(maxWidth < SIDE_BY_SIDE_WIDTH * LocalDensity.current.fontScale)
        }
    }
}

/** Main's base duration on the ease-out: a card sliding to its row. */
@OptIn(ExperimentalSharedTransitionApi::class)
private val SLIDE = BoundsTransform { _, _ -> tween(ZoonkMotion.BASE_MILLIS, easing = ZoonkMotion.EaseOut) }

private val SIDE_BY_SIDE_WIDTH = 288.dp
private val WIDE_BOARD = 600.dp
private val CARD_GAP = 8.dp
private val STACKED_GAP = 16.dp
