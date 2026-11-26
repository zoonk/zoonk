package com.zoonk.android.feature.questions

import androidx.compose.foundation.layout.Box
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

/**
 * Main's `MatchPairsQuestion`: tap an entry on either side, then its partner on the other. A learning match comes
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

    val card: @Composable (MatchSide, Int, Modifier) -> Unit = { side, index, cardModifier ->
        val spot = MatchSpot(side, index)
        val made = work.partnerOf(spot)
        val partner = made ?: key?.takeIf { ended }?.let { spot.partnerIn(it) }
        val state = work.stateOf(spot, held = key == null, ended = ended)
        MatchEntry(
            state = state,
            onClick = { tap(spot) }.takeIf { enabled && !ended && (key == null || made == null) },
            modifier = cardModifier,
            pair = made?.let { if (side == MatchSide.Left) index else it }?.plus(1),
            label = board.label(spot, partner),
            cue = work.cue,
        ) { ItemLine(spot.text(left, right)) }
    }

    Box(modifier) {
        if (key != null && ended) {
            SolvedMatchBoard(left.indices.map { it to key[it] }, card = card)
        } else {
            MatchBoard(left.indices.toList(), right.indices.toList(), card = card)
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
