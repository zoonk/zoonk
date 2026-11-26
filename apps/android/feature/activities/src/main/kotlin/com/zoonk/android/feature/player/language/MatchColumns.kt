package com.zoonk.android.feature.player.language

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import com.zoonk.android.feature.player.model.LessonAnswer
import com.zoonk.android.feature.player.steps.QuestionScene
import com.zoonk.android.feature.questions.Announcement
import com.zoonk.android.feature.questions.MatchBoard
import com.zoonk.android.feature.questions.MatchEntry
import com.zoonk.android.feature.questions.MatchSide
import com.zoonk.android.feature.questions.MatchSpot
import com.zoonk.android.feature.questions.MatchWork
import com.zoonk.android.feature.questions.SolvedMatchBoard
import com.zoonk.android.feature.questions.matchPartnerWords
import com.zoonk.android.feature.questions.other
import com.zoonk.android.feature.questions.rememberMatchBoardState

/**
 * Main's `MatchColumnsStep`: the shared match board, each pair checked as it's made. A right pair stays matched; a
 * wrong one shows briefly and counts as a mistake. The last pair sends the answer and checks it through [onDone], and
 * the board then shows each word with its partner.
 */
@Composable
internal fun MatchColumnsView(
    content: ExerciseContent.MatchColumns,
    rightItems: List<String>,
    answer: LessonAnswer?,
    checked: Boolean,
    locked: Boolean,
    onAnswer: (LessonAnswer?) -> Unit,
    onDone: (LessonAnswer) -> Unit,
    question: @Composable () -> Unit,
) {
    val lefts = content.pairs.map(MatchPair::left)
    val earlier = (answer as? LessonAnswer.MatchColumns)?.mistakes ?: 0
    val board =
        rememberMatchBoardState(
            count = lefts.size,
            goesWith = { l, r -> content.pairs.any { it.left == lefts[l] && it.right == rightItems[r] } },
            name = { spot -> stripWrappingQuotes(if (spot.side == MatchSide.Left) lefts[spot.index] else rightItems[spot.index]) },
            content,
            rightItems,
            initial = { MatchWork(pairs = initialMatches(answer, lefts, rightItems).toMap()) },
        )
    val work = board.work
    val ended = board.isComplete

    fun answerOf(next: MatchWork) =
        LessonAnswer.MatchColumns(lefts.indices.map { lefts[it] to rightItems[next.pairs.getValue(it)] }, earlier + next.misses.size)

    // After the app was closed in the background, the saved pairs come back but the player's answer doesn't.
    LaunchedEffect(Unit) {
        if (answer == null && !checked && board.isComplete) onAnswer(answerOf(work))
    }

    fun tap(spot: MatchSpot) {
        if (locked) return
        val next = board.tap(spot)
        if (next.isComplete(lefts.size)) onDone(answerOf(next))
    }

    QuestionScene {
        question()

        val card: @Composable (MatchSide, Int, Modifier) -> Unit = { side, index, modifier ->
            val spot = MatchSpot(side, index)
            val partner = work.partnerOf(spot)
            val state = work.stateOf(spot, held = false, ended = ended)
            val words = { spotted: MatchSpot ->
                stripWrappingQuotes(
                    if (spotted.side ==
                        MatchSide.Left
                    ) {
                        lefts[spotted.index]
                    } else {
                        rightItems[spotted.index]
                    },
                )
            }
            MatchEntry(
                state = state,
                onClick = { tap(spot) }.takeIf { !ended && !checked && !locked && partner == null },
                modifier = modifier,
                partner = partner?.let { matchPartnerWords(state, words(MatchSpot(side.other, it))) },
                cue = work.cue,
            ) { Text(words(spot)) }
        }
        if (ended) {
            SolvedMatchBoard(lefts.indices.map { it to work.pairs.getValue(it) }, card = card)
        } else {
            MatchBoard(lefts.indices.toList(), rightItems.indices.toList(), alignRows = true, card = card)
        }
        board.Announcement()
    }
}

private fun initialMatches(
    answer: LessonAnswer?,
    lefts: List<String>,
    rights: List<String>,
): List<Pair<Int, Int>> {
    val pairs = (answer as? LessonAnswer.MatchColumns)?.pairs ?: return emptyList()
    val usedLeft = mutableSetOf<Int>()
    val usedRight = mutableSetOf<Int>()
    return pairs.mapNotNull { (left, right) ->
        val l = lefts.indices.firstOrNull { it !in usedLeft && lefts[it] == left } ?: return@mapNotNull null
        val r = rights.indices.firstOrNull { it !in usedRight && rights[it] == right } ?: return@mapNotNull null
        usedLeft += l
        usedRight += r
        l to r
    }
}
