package com.zoonk.android.feature.activities.sorting

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.activities.ActivityBadge
import com.zoonk.android.feature.activities.ActivityCanvas
import com.zoonk.android.feature.activities.ActivityProps
import com.zoonk.android.feature.activities.ActivityReason
import com.zoonk.android.feature.activities.ActivityReasons
import com.zoonk.android.feature.activities.ActivityRenderer
import com.zoonk.android.feature.activities.LineMarker
import com.zoonk.android.feature.activities.assignmentPairs
import com.zoonk.android.feature.questions.Announcement
import com.zoonk.android.feature.questions.MatchBoard
import com.zoonk.android.feature.questions.MatchEntry
import com.zoonk.android.feature.questions.MatchSide
import com.zoonk.android.feature.questions.MatchSpot
import com.zoonk.android.feature.questions.SolvedMatchBoard
import com.zoonk.android.feature.questions.matchPartnerWords
import com.zoonk.android.feature.questions.rememberMatchBoardState
import com.zoonk.android.ui.richtext.RichText
import com.zoonk.android.ui.theme.ZoonkRadius
import com.zoonk.api.models.PlayableLibraryStepAnyOfContent.PlayableLibraryStepAnyOfContentOneOf27Value as MatchPairsContent

val matchPairsRenderer =
    ActivityRenderer(
        badge = { ActivityBadge(R.string.activities_sorting_badge_match_pairs, R.drawable.ic_link) },
        canvas = { MatchPairsActivity(it) },
    )

/**
 * Main's `MatchPairsActivity`: the shared match board, each pair checked as it's made. A miss says why under the board
 * until the next tap, and the last pair sends the answer by itself ([ActivityProps.onComplete]).
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
    val expected = props.expected.assignmentPairs.takeIf { props.isChecked }

    fun tap(spot: MatchSpot) {
        if (props.isLocked) return
        val next = board.tap(spot)
        val answer = matchAnswer(left, right, next)
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
            partner = partner?.let { matchPartnerWords(state, (if (side == MatchSide.Left) right else left)[it].text) },
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
                MatchBoard(left.indices.toList(), right.indices.toList(), alignRows = false, group, card)
            }

            board.lastMiss.takeUnless { ended }?.let { MissNote(right[it.right].why ?: left[it.left].why) }
            if (expected != null) MatchPairsResults(left, right, expected, work.firstTries)
        }
        board.Announcement()
    }
}

@Composable
private fun cardsLabel(): String = stringResource(R.string.activities_sorting_cards_to_match)

@Composable
private fun MissNote(explanation: String?) {
    val shape = RoundedCornerShape(ZoonkRadius.option)
    Row(
        Modifier
            .fillMaxWidth()
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
            if (explanation != null) {
                RichText(explanation, style = MaterialTheme.typography.bodyMedium)
            } else {
                Text(stringResource(R.string.activities_sorting_dont_go_together_short), style = MaterialTheme.typography.bodyMedium)
            }
        }
    }
}

@Composable
private fun MatchPairsResults(
    left: List<MatchCard>,
    right: List<MatchCard>,
    expected: Map<String, String>,
    firstTries: Map<Int, Int>,
) {
    val tried = firstTries.entries.associate { (l, r) -> left[l].id to right[r].id }
    val missed = left.filter { tried[it.id] != expected[it.id] }
    val textOf = { id: String? -> right.firstOrNull { it.id == id }?.text }

    if (missed.isNotEmpty()) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                stringResource(R.string.activities_sorting_missed_first_try),
                modifier = Modifier.semantics { heading() },
                style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.SemiBold),
            )
            ActivityReasons {
                missed.forEach { card ->
                    ActivityReason(card.why) {
                        val partner = textOf(expected[card.id]) ?: card.text
                        val picked = textOf(tried[card.id])
                        Text(
                            if (picked == null) {
                                "${card.text} → $partner"
                            } else {
                                stringResource(R.string.activities_sorting_goes_with, card.text, partner, picked)
                            },
                        )
                    }
                }
            }
        }
    }
}
