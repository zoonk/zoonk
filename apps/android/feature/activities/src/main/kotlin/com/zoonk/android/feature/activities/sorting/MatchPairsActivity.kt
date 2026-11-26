package com.zoonk.android.feature.activities.sorting

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.activities.ActivityCanvas
import com.zoonk.android.feature.activities.ActivityProps
import com.zoonk.android.feature.activities.ActivityRenderer
import com.zoonk.android.feature.activities.LineMarker
import com.zoonk.android.feature.activities.assignmentPairs
import com.zoonk.android.feature.player.model.ActivityAnswer
import com.zoonk.android.feature.player.steps.FocusPrimaryOnceChecked
import com.zoonk.android.feature.questions.Announcement
import com.zoonk.android.feature.questions.MatchBoard
import com.zoonk.android.feature.questions.MatchEntry
import com.zoonk.android.feature.questions.MatchMisses
import com.zoonk.android.feature.questions.MatchSide
import com.zoonk.android.feature.questions.MatchSpot
import com.zoonk.android.feature.questions.MatchTry
import com.zoonk.android.feature.questions.SolvedMatchBoard
import com.zoonk.android.feature.questions.itemLine
import com.zoonk.android.feature.questions.rememberMatchBoardState
import com.zoonk.android.ui.richtext.RichText
import com.zoonk.android.ui.theme.ZoonkRadius
import com.zoonk.api.models.PlayableLibraryStepAnyOfContent.PlayableLibraryStepAnyOfContentOneOf27Value as MatchPairsContent

val matchPairsRenderer =
    ActivityRenderer(
        badge = { null },
        canvas = { MatchPairsActivity(it) },
        feedback = { content, answer -> MatchPairsMisses(content as MatchPairsContent, answer) },
    )

/**
 * Main's `MatchPairsActivity`: the shared match board, each pair checked as it's made. A miss whose card says why shows
 * it under the board until the next tap (TalkBack hears every miss), and the last pair sends the answer by itself
 * ([ActivityProps.onComplete]).
 */
@Composable
private fun MatchPairsActivity(props: ActivityProps) {
    val fields = (props.content as MatchPairsContent).value.fields
    val (left, right) = remember(fields) { arrangeMatchColumns(fields) }
    val board =
        rememberMatchBoardState(
            count = left.size,
            goesWith = { l, r -> left[l].id == right[r].id },
            name = { spot -> (if (spot.side == MatchSide.Left) left else right)[spot.index].text },
            fields,
            why = { miss -> right[miss.right].why ?: left[miss.left].why },
            initial = { workFromAnswer(left, right, props.answer.assignmentPairs) },
        )
    val work = board.work
    val ended = board.isComplete || props.isChecked

    var sent by remember { mutableStateOf(false) }
    FocusPrimaryOnceChecked(sent, props.isChecked)

    fun tap(spot: MatchSpot) {
        if (props.isLocked) return
        val next = board.tap(spot)
        val answer = matchAnswer(left, right, next)
        sent = answer != null
        if (answer == null) props.onAnswerChange(null) else props.onComplete(answer)
    }

    val card: @Composable (MatchSide, Int, Modifier) -> Unit = { side, index, modifier ->
        val spot = MatchSpot(side, index)
        val cards = if (side == MatchSide.Left) left else right
        val partner = work.partnerOf(spot)
        val state = work.stateOf(spot, held = false, ended = ended)
        MatchEntry(
            state = state,
            onClick = { tap(spot) }.takeIf { !ended && !props.isLocked && partner == null },
            modifier = modifier,
            label = board.label(spot, partner),
            cue = work.cue,
        ) { RichText(cards[index].text) }
    }

    Box {
        ActivityCanvas(gap = 16.dp) {
            val label = cardsLabel()
            val group = Modifier.semantics { contentDescription = label }
            if (ended) {
                SolvedMatchBoard(solvedRows(left, right), group, card)
            } else {
                MatchBoard(left.indices.toList(), right.indices.toList(), group, card)
            }

            board.lastMiss.takeUnless { ended }?.let { miss -> (right[miss.right].why ?: left[miss.left].why)?.let { MissNote(it, miss) } }
        }
        board.Announcement()
    }
}

@Composable
private fun cardsLabel(): String = stringResource(R.string.activities_sorting_cards_to_match)

/** Why a [miss] doesn't go together, brought into view above the bar for each new miss. */
@Composable
private fun MissNote(
    explanation: String,
    miss: MatchTry,
) {
    val shape = RoundedCornerShape(ZoonkRadius.option)
    val inView = remember { BringIntoViewRequester() }
    LaunchedEffect(miss) { inView.bringIntoView() }
    Row(
        Modifier
            .fillMaxWidth()
            .bringIntoViewRequester(inView)
            .background(MaterialTheme.colorScheme.errorContainer, shape)
            .semantics(mergeDescendants = true) {}
            .padding(horizontal = 14.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        LineMarker(MaterialTheme.typography.bodyMedium) {
            Icon(
                painterResource(R.drawable.ic_cancel),
                contentDescription = null,
                modifier = Modifier.size(16.dp),
                tint = MaterialTheme.colorScheme.error,
            )
        }
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                stringResource(R.string.activities_sorting_not_quite),
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold),
            )
            RichText(explanation, style = MaterialTheme.typography.bodyMedium)
        }
    }
}

/** The pairs a match activity's answer first got wrong, said under its verdict. */
@Composable
private fun MatchPairsMisses(
    content: MatchPairsContent,
    answer: ActivityAnswer?,
) {
    val (left, right) = remember(content) { arrangeMatchColumns(content.value.fields) }
    MatchMisses(workFromAnswer(left, right, answer.assignmentPairs).misses) { side, index ->
        itemLine((if (side == MatchSide.Left) left else right)[index].text)
    }
}
