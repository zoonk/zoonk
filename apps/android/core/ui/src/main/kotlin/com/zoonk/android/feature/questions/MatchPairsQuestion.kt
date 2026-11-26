package com.zoonk.android.feature.questions

import androidx.compose.foundation.layout.Box
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import com.zoonk.android.ui.components.LocalOptionKeys
import com.zoonk.android.ui.components.LocalPickKeys

/**
 * Main's `MatchPairsQuestion`: tap an entry on either side (or press its number key), then its partner on the other. A learning match comes
 * with its [key] and checks each pair as it's made: a right pair locks, a miss shows briefly and counts, and the last
 * pair sends the answer with its misses through [onSubmit], so there's nothing to press. Without a key (placement and
 * level tests) pairs are held until Check: [onAnswer] gets them once every entry has one, null before, and a paired
 * entry tapped again undoes its pair. A learning board that ended (every pair made, or [check]ed) shows each entry
 * beside its partner.
 */
@Composable
fun MatchPairsQuestion(
    left: List<String>,
    right: List<String>,
    key: List<Int>?,
    check: AnswerCheck?,
    enabled: Boolean,
    onAnswer: (Answer?) -> Unit,
    onSubmit: (Answer) -> Unit,
    modifier: Modifier = Modifier,
) {
    val spoken = left.map { spokenItemLine(it) } to right.map { spokenItemLine(it) }
    val board =
        rememberMatchBoardState(
            count = left.size,
            goesWith = key?.let { { l: Int, r: Int -> it.getOrNull(l) == r } },
            name = { spot -> spot.text(spoken.first, spoken.second) },
            left,
            right,
            key,
        )
    val work = board.work
    val ended = check != null || (key != null && board.isComplete)

    fun tap(spot: MatchSpot) {
        val next = board.tap(spot)
        val answer = if (next.isComplete(left.size)) next.answer(left.size, checked = key != null) else null
        onAnswer(answer)
        if (key != null && answer != null) onSubmit(answer)
    }

    fun canTap(spot: MatchSpot) = enabled && !ended && (key == null || work.partnerOf(spot) == null)

    val keys = LocalPickKeys.current
    keys?.let { MatchNumberKeys(it::take, left.size) { spot -> canTap(spot).also { if (it) tap(spot) } } }
    board.LetGoOnBack(enabled = enabled && !ended)

    val card: @Composable (MatchSide, Int, Modifier) -> Unit = { side, index, cardModifier ->
        val spot = MatchSpot(side, index)
        val made = work.partnerOf(spot)
        val partner = made ?: key?.takeIf { ended }?.let { spot.partnerIn(it) }
        val state = work.stateOf(spot, held = key == null, ended = ended)
        MatchEntry(
            state = state,
            onClick = { tap(spot) }.takeIf { canTap(spot) },
            modifier = cardModifier,
            place = spot.place(left.size),
            pair = work.pairNumber(spot),
            label = board.label(spot, partner),
            cue = work.cue,
        ) { ItemLine(spot.text(left, right)) }
    }

    Box(modifier) {
        // Where the frame sends number keys, the cards show the ones that pick them.
        CompositionLocalProvider(LocalOptionKeys provides (keys != null)) {
            MatchBoard(
                left.indices.toList(),
                right.indices.toList(),
                solved = key?.takeIf { ended }?.let { left.indices.map { l -> l to it[l] } },
                card = card,
            )
        }
        board.Announcement()
    }
}

private fun MatchSpot.text(
    left: List<String>,
    right: List<String>,
): String = if (side == MatchSide.Left) left[index] else right[index]

/** This entry's partner by the [key]: the right place for a left entry, the left place for a right one. */
private fun MatchSpot.partnerIn(key: List<Int>): Int? =
    when (side) {
        MatchSide.Left -> key.getOrNull(index)
        MatchSide.Right -> key.indexOf(index).takeIf { it >= 0 }
    }
