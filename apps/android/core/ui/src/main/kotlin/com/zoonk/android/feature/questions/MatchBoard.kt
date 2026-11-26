package com.zoonk.android.feature.questions

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.isTraversalGroup
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.traversalIndex
import androidx.compose.ui.unit.dp

/**
 * The one board for every screen that asks to match these with those (main's `MatchBoard`): the left column beside the
 * right, each card on one row with the card across from it and as tall as the taller of the two, or the right column
 * under the left when the board is narrow for its text. TalkBack reads down the left column, then the right.
 */
@Composable
fun <T : Any> MatchBoard(
    left: List<T>,
    right: List<T>,
    modifier: Modifier = Modifier,
    card: @Composable (side: MatchSide, item: T, modifier: Modifier) -> Unit,
) {
    BoardWidth(modifier) { stacked ->
        if (stacked) {
            Column(verticalArrangement = Arrangement.spacedBy(STACKED_GAP)) {
                CardList(MatchSide.Left, left, card)
                CardList(MatchSide.Right, right, card)
            }
        } else {
            val rows = left.size
            SideBySideRows(left.zip(right), Modifier.semantics { isTraversalGroup = true }) { side, item, cardModifier ->
                val place = (if (side == MatchSide.Left) left else right).indexOf(item)
                val order = if (side == MatchSide.Left) place else rows + place
                card(side, item, cardModifier.semantics { traversalIndex = order.toFloat() })
            }
        }
    }
}

/** The board once every pair is known: each left card with its partner, row by row. */
@Composable
fun <T : Any> SolvedMatchBoard(
    pairs: List<Pair<T, T>>,
    modifier: Modifier = Modifier,
    card: @Composable (side: MatchSide, item: T, modifier: Modifier) -> Unit,
) {
    BoardWidth(modifier) { stacked ->
        if (stacked) {
            Column(verticalArrangement = Arrangement.spacedBy(STACKED_GAP)) {
                pairs.forEach { (left, right) ->
                    Column(verticalArrangement = Arrangement.spacedBy(CARD_GAP)) {
                        card(MatchSide.Left, left, Modifier.fillMaxWidth())
                        card(MatchSide.Right, right, Modifier.fillMaxWidth())
                    }
                }
            }
        } else {
            SideBySideRows(pairs, Modifier, card)
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

@Composable
private fun <T : Any> CardList(
    side: MatchSide,
    items: List<T>,
    card: @Composable (side: MatchSide, item: T, modifier: Modifier) -> Unit,
) {
    Column(Modifier.semantics { isTraversalGroup = true }, verticalArrangement = Arrangement.spacedBy(CARD_GAP)) {
        items.forEach { card(side, it, Modifier.fillMaxWidth()) }
    }
}

@Composable
private fun <T : Any> SideBySideRows(
    rows: List<Pair<T, T>>,
    modifier: Modifier,
    card: @Composable (side: MatchSide, item: T, modifier: Modifier) -> Unit,
) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(CARD_GAP)) {
        rows.forEach { (left, right) ->
            Row(Modifier.height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(CARD_GAP)) {
                listOf(MatchSide.Left to left, MatchSide.Right to right).forEach { (side, item) ->
                    card(side, item, Modifier.weight(1f).fillMaxHeight())
                }
            }
        }
    }
}

private val SIDE_BY_SIDE_WIDTH = 288.dp
private val WIDE_BOARD = 600.dp
private val CARD_GAP = 8.dp
private val STACKED_GAP = 16.dp
