package com.zoonk.android.feature.activities.sorting

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp

/**
 * A match board while it's played: each side's cards in a list, the lists side by side while the board has room for
 * the learner's text size, else the right list under the left. With [alignRows], side by side, a card shares its row
 * and height with the card across from it.
 */
@Composable
internal fun <T : Any> MatchBoard(
    left: List<T>,
    right: List<T>,
    alignRows: Boolean,
    modifier: Modifier = Modifier,
    card: @Composable (side: MatchSide, item: T, modifier: Modifier) -> Unit,
) {
    BoardWidth(modifier) { stacked ->
        when {
            stacked -> {
                Column(verticalArrangement = Arrangement.spacedBy(STACKED_GAP)) {
                    CardList(MatchSide.Left, left, Modifier, card)
                    CardList(MatchSide.Right, right, Modifier, card)
                }
            }

            alignRows -> {
                SideBySideRows(left.zip(right), card)
            }

            else -> {
                Row(horizontalArrangement = Arrangement.spacedBy(ACROSS_GAP)) {
                    CardList(MatchSide.Left, left, Modifier.weight(1f), card)
                    CardList(MatchSide.Right, right, Modifier.weight(1f), card)
                }
            }
        }
    }
}

/** A solved match board: each left card with its partner, beside it or above it as [MatchBoard] decides, and a card with no partner alone. */
@Composable
internal fun <T : Any> SolvedMatchBoard(
    pairs: List<Pair<T?, T?>>,
    modifier: Modifier = Modifier,
    card: @Composable (side: MatchSide, item: T, modifier: Modifier) -> Unit,
) {
    BoardWidth(modifier) { stacked ->
        if (stacked) {
            Column(verticalArrangement = Arrangement.spacedBy(STACKED_GAP)) {
                pairs.forEach { (left, right) ->
                    Column(verticalArrangement = Arrangement.spacedBy(CARD_GAP)) {
                        left?.let { card(MatchSide.Left, it, Modifier.fillMaxWidth()) }
                        right?.let { card(MatchSide.Right, it, Modifier.fillMaxWidth()) }
                    }
                }
            }
        } else {
            SideBySideRows(pairs, card)
        }
    }
}

/**
 * Side by side only while a matched card keeps a ten-letter word whole beside its check mark, as main's 18rem board
 * does: 288dp at default text, growing with the learner's text size.
 */
@Composable
private fun BoardWidth(
    modifier: Modifier,
    content: @Composable (stacked: Boolean) -> Unit,
) {
    BoxWithConstraints(modifier.fillMaxWidth()) {
        content(maxWidth < SIDE_BY_SIDE_WIDTH * LocalDensity.current.fontScale)
    }
}

@Composable
private fun <T : Any> CardList(
    side: MatchSide,
    items: List<T>,
    modifier: Modifier,
    card: @Composable (side: MatchSide, item: T, modifier: Modifier) -> Unit,
) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(CARD_GAP)) {
        items.forEach { card(side, it, Modifier.fillMaxWidth()) }
    }
}

@Composable
private fun <T : Any> SideBySideRows(
    rows: List<Pair<T?, T?>>,
    card: @Composable (side: MatchSide, item: T, modifier: Modifier) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(CARD_GAP)) {
        rows.forEach { (left, right) ->
            Row(Modifier.height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(ACROSS_GAP)) {
                listOf(MatchSide.Left to left, MatchSide.Right to right).forEach { (side, item) ->
                    if (item == null) Spacer(Modifier.weight(1f)) else card(side, item, Modifier.weight(1f).fillMaxHeight())
                }
            }
        }
    }
}

private val SIDE_BY_SIDE_WIDTH = 288.dp
private val CARD_GAP = 8.dp
private val ACROSS_GAP = 10.dp
private val STACKED_GAP = 16.dp
