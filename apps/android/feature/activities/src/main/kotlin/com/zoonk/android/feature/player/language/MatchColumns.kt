package com.zoonk.android.feature.player.language

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.AnnotatedString
import com.zoonk.android.feature.activities.ActivityCanvas
import com.zoonk.android.feature.player.model.LessonAnswer
import com.zoonk.android.feature.player.steps.FocusPrimaryOnceChecked
import com.zoonk.android.feature.player.steps.LocalBoardMisses
import com.zoonk.android.feature.player.steps.QuestionScene
import com.zoonk.android.feature.questions.Announcement
import com.zoonk.android.feature.questions.LetGoOnBack
import com.zoonk.android.feature.questions.MatchBoard
import com.zoonk.android.feature.questions.MatchEntry
import com.zoonk.android.feature.questions.MatchMisses
import com.zoonk.android.feature.questions.MatchNumberKeys
import com.zoonk.android.feature.questions.MatchSide
import com.zoonk.android.feature.questions.MatchSpot
import com.zoonk.android.feature.questions.MatchWork
import com.zoonk.android.feature.questions.rememberMatchBoardState
import com.zoonk.android.ui.richtext.SpokenText

/**
 * Main's `MatchColumnsStep`: the shared match board on the activity's panel, each pair checked as it's made. A right
 * pair stays matched; a wrong one shows briefly and counts as a mistake. The last pair sends the answer and checks it
 * through [onDone], and the board then shows each word with its partner.
 */
@Composable
internal fun MatchColumnsView(
    content: ExerciseContent.MatchColumns,
    rightItems: List<String>,
    answer: LessonAnswer?,
    checked: Boolean,
    locked: Boolean,
    onRestore: (LessonAnswer) -> Unit,
    onDone: (LessonAnswer) -> Unit,
    takeNumberKeys: (((Int) -> Boolean)?) -> Unit,
    question: @Composable () -> Unit,
) {
    val lefts = content.pairs.map(MatchPair::left)
    val words = { spot: MatchSpot -> stripWrappingQuotes((if (spot.side == MatchSide.Left) lefts else rightItems)[spot.index]) }
    val earlier = (answer as? LessonAnswer.MatchColumns)?.mistakes ?: 0
    val board =
        rememberMatchBoardState(
            count = lefts.size,
            goesWith = { l, r -> content.pairs.any { it.left == lefts[l] && it.right == rightItems[r] } },
            name = words,
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
        if (answer == null && !checked && board.isComplete) onRestore(answerOf(work))
    }

    var sent by remember { mutableStateOf(false) }
    FocusPrimaryOnceChecked(sent, checked)

    // The verdict names the first misses from the board's saved work, so a recreated screen still shows them.
    val showMisses = LocalBoardMisses.current
    val misses = @Composable { MatchMisses(work.misses) { side, index -> SpokenText(AnnotatedString(words(MatchSpot(side, index)))) } }
    LaunchedEffect(ended, showMisses) {
        if (ended) showMisses?.value = misses
    }

    fun tap(spot: MatchSpot) {
        if (locked) return
        val next = board.tap(spot)
        if (next.isComplete(lefts.size)) {
            sent = true
            onDone(answerOf(next))
        }
    }

    fun canTap(spot: MatchSpot) = !ended && !checked && !locked && work.partnerOf(spot) == null

    MatchNumberKeys(takeNumberKeys, lefts.size) { spot -> canTap(spot).also { if (it) tap(spot) } }
    board.LetGoOnBack(enabled = !ended && !checked && !locked)

    QuestionScene {
        question()

        val card: @Composable (MatchSide, Int, Modifier) -> Unit = { side, index, modifier ->
            val spot = MatchSpot(side, index)
            val partner = work.partnerOf(spot)
            val state = work.stateOf(spot, held = false, ended = ended)
            MatchEntry(
                state = state,
                onClick = { tap(spot) }.takeIf { canTap(spot) },
                modifier = modifier,
                place = spot.place(lefts.size),
                pair = work.pairNumber(spot),
                label = board.label(spot, partner),
                cue = work.cue,
            ) { Text(words(spot)) }
        }
        ActivityCanvas {
            MatchBoard(
                lefts.indices.toList(),
                rightItems.indices.toList(),
                solved = if (ended) lefts.indices.map { it to work.pairs.getValue(it) } else null,
                card = card,
            )
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
