package com.zoonk.android.feature.player.language

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.player.model.LessonAnswer
import com.zoonk.android.feature.player.steps.QuestionScene
import com.zoonk.android.feature.player.steps.QuestionText
import com.zoonk.android.ui.components.AnswerResult
import com.zoonk.android.ui.components.answerTone
import kotlinx.coroutines.delay

/** One side's item: [index] is its row in its own column. */
internal data class MatchItem(
    val left: Boolean,
    val index: Int,
)

/** A tried pair, by row on each side. */
internal data class MatchAttempt(
    val left: Int,
    val right: Int,
)

/**
 * Main's `MatchColumnsStep`: tap a word on each side to pair them. A right pair stays matched; a wrong
 * one flashes and counts as a mistake. The answer goes once every pair is matched.
 */
@Composable
internal fun MatchColumnsView(
    content: ExerciseContent.MatchColumns,
    rightItems: List<String>,
    answer: LessonAnswer?,
    checked: Boolean,
    locked: Boolean,
    onAnswer: (LessonAnswer?) -> Unit,
) {
    val lefts = content.pairs.map(MatchPair::left)
    var matched by rememberSaveable { mutableStateOf(initialMatches(answer, lefts, rightItems)) }
    var selected by rememberSaveable { mutableStateOf<Pair<Boolean, Int>?>(null) }
    var mistakes by rememberSaveable { mutableIntStateOf((answer as? LessonAnswer.MatchColumns)?.mistakes ?: 0) }
    var flashing by remember { mutableStateOf<MatchAttempt?>(null) }
    val haptics = LocalHapticFeedback.current
    val allMatched = matched.size == content.pairs.size

    // After the app was closed in the background, the saved pairs come back but the player's answer doesn't.
    LaunchedEffect(Unit) {
        if (answer == null && !checked && allMatched) {
            onAnswer(LessonAnswer.MatchColumns(matched.map { (l, r) -> lefts[l] to rightItems[r] }, mistakes))
        }
    }

    LaunchedEffect(flashing) {
        if (flashing != null) {
            delay(FLASH_MILLIS)
            flashing = null
        }
    }

    fun tap(item: MatchItem) {
        val pairs = matched.map { (l, r) -> MatchAttempt(l, r) }
        if (locked || flashing != null || pairs.any { if (item.left) it.left == item.index else it.right == item.index }) return
        val previous = selected?.let { (left, index) -> MatchItem(left, index) }
        when {
            previous == null -> {
                selected = item.left to item.index
            }

            previous.left == item.left -> {
                selected = if (previous == item) null else item.left to item.index
            }

            else -> {
                val attempt = if (item.left) MatchAttempt(item.index, previous.index) else MatchAttempt(previous.index, item.index)
                selected = null
                val right = content.pairs.any { it.left == lefts[attempt.left] && it.right == rightItems[attempt.right] }
                if (right) {
                    haptics.performHapticFeedback(HapticFeedbackType.Confirm)
                    val next = matched + (attempt.left to attempt.right)
                    matched = next
                    if (next.size == content.pairs.size) {
                        onAnswer(LessonAnswer.MatchColumns(next.map { (l, r) -> lefts[l] to rightItems[r] }, mistakes))
                    }
                } else {
                    haptics.performHapticFeedback(HapticFeedbackType.Reject)
                    mistakes += 1
                    flashing = attempt
                }
            }
        }
    }

    QuestionScene {
        QuestionText(stripWrappingQuotes(content.question ?: stringResource(R.string.player_language_match_the_pairs)), answered = checked)

        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            lefts.indices.forEach { row ->
                val right = rightItems.getOrNull(row) ?: return@forEach
                Row(Modifier.height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    listOf(MatchItem(true, row) to lefts[row], MatchItem(false, row) to right).forEach { (item, label) ->
                        val isMatched = matched.any { (l, r) -> if (item.left) l == row else r == row }
                        val isFlashing = flashing?.let { if (item.left) it.left == row else it.right == row } == true
                        MatchCell(
                            label = stripWrappingQuotes(label),
                            picked = selected == (item.left to item.index),
                            result =
                                when {
                                    isMatched -> AnswerResult.Right
                                    isFlashing -> AnswerResult.Wrong
                                    else -> null
                                },
                            enabled = !locked && !isMatched && !isFlashing,
                            onTap = { tap(item) },
                            modifier = Modifier.weight(1f).fillMaxHeight(),
                        )
                    }
                }
            }
        }

        // What TalkBack hears that the eye gets from color: a wrong pair, then every pair matched.
        val announcement =
            when {
                allMatched -> stringResource(R.string.player_language_all_matched)
                flashing != null -> stringResource(R.string.player_language_not_a_pair)
                else -> ""
            }
        Box(
            Modifier.size(1.dp).semantics {
                liveRegion = LiveRegionMode.Polite
                contentDescription = announcement
            },
        )
    }
}

private const val FLASH_MILLIS = 800L

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

@Composable
private fun MatchCell(
    label: String,
    picked: Boolean,
    result: AnswerResult?,
    enabled: Boolean,
    onTap: () -> Unit,
    modifier: Modifier,
) {
    val tone = answerTone(picked, result)
    val shape = RoundedCornerShape(12.dp)
    val state =
        when {
            result == AnswerResult.Right -> stringResource(R.string.player_language_matched)
            picked -> stringResource(R.string.player_language_selected)
            else -> null
        }

    Row(
        modifier =
            modifier
                .heightIn(min = 48.dp)
                .clip(shape)
                .background(tone.container)
                .border(tone.border, shape)
                .clickable(enabled = enabled, role = Role.Button, onClick = onTap)
                .semantics { state?.let { stateDescription = it } }
                .padding(horizontal = 12.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Text(label, style = MaterialTheme.typography.bodyLarge)
    }
}
