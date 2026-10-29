package com.zoonk.android.feature.questions

import androidx.compose.animation.core.animate
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.components.AnswerOption
import com.zoonk.android.ui.components.AnswerOptionGroup
import com.zoonk.android.ui.components.AnswerResult
import com.zoonk.android.ui.richtext.RichBlock
import com.zoonk.android.ui.richtext.parseRichBlocks
import kotlinx.coroutines.launch
import kotlin.math.abs

/** A checked statement: what the learner said and, when the server says it, whether it was true. */
data class TrueFalseCheck(
    val answer: Answer,
    val correct: Boolean?,
)

private enum class Side(
    val answer: Answer,
) {
    False(Answer.TrueFalse(false)),
    Blank(Answer.DontKnow),
    True(Answer.TrueFalse(true)),
}

/**
 * A statement to judge (main's `TrueFalseQuestion`): a card swiped toward the end for true or the
 * start for false, and its options in the exam's words in reading order, false first. Where a
 * wrong answer cancels a right one, [allowBlank] adds "Leave blank", which is never red.
 */
@Composable
fun TrueFalseQuestion(
    statement: String,
    words: TrueFalseWords,
    allowBlank: Boolean,
    check: TrueFalseCheck?,
    enabled: Boolean,
    onAnswer: (Answer?) -> Unit,
    modifier: Modifier = Modifier,
) {
    var picked by rememberSaveable { mutableStateOf<Side?>(null) }
    val locked = !enabled || check != null
    val hasTable = remember(statement) { parseRichBlocks(statement).any { it is RichBlock.Table } }
    val sides = if (allowBlank) Side.entries else listOf(Side.False, Side.True)
    val shown = check?.answer?.let { answer -> Side.entries.first { it.answer == answer } } ?: picked

    fun pick(side: Side) {
        val next = if (picked == side) null else side
        picked = next
        onAnswer(next?.answer)
    }

    fun pickSide(side: Side) {
        picked = side
        onAnswer(side.answer)
    }

    Column(modifier, verticalArrangement = Arrangement.spacedBy(16.dp)) {
        StatementCard(
            statement = statement,
            graded = check != null,
            canSwipe = !locked && !hasTable,
            onSwipe = { isTrue -> pickSide(if (isTrue) Side.True else Side.False) },
        )

        AnswerOptionGroup {
            sides.forEachIndexed { index, side ->
                val result = sideResult(side, check)
                if (check != null && result == null && shown != side) return@forEachIndexed

                AnswerOption(
                    marker = index + 1,
                    picked = shown == side,
                    result = result,
                    onClick = { pick(side) },
                    enabled = !locked,
                ) { Text(text = sideLabel(side, words), style = MaterialTheme.typography.bodyLarge) }
            }
        }
    }
}

@Composable
private fun StatementCard(
    statement: String,
    graded: Boolean,
    canSwipe: Boolean,
    onSwipe: (isTrue: Boolean) -> Unit,
) {
    var offset by remember { mutableFloatStateOf(0f) }
    val scope = rememberCoroutineScope()
    val haptics = LocalHapticFeedback.current
    val density = LocalDensity.current
    val threshold = with(density) { SWIPE_THRESHOLD.toPx() }
    val towardEnd = if (LocalLayoutDirection.current == LayoutDirection.Rtl) -1f else 1f
    val swipe by rememberUpdatedState(onSwipe)

    fun settle() {
        scope.launch { animate(offset, 0f) { value, _ -> offset = value } }
    }

    OutlinedCard(
        Modifier
            .fillMaxWidth()
            .heightIn(min = 128.dp)
            // Outside the layer, so the drag is measured where the finger is, not on the moving card.
            .pointerInput(canSwipe, threshold, towardEnd) {
                if (!canSwipe) return@pointerInput
                detectHorizontalDragGestures(
                    onDragEnd = {
                        if (abs(offset) >= threshold) swipe(offset * towardEnd > 0)
                        settle()
                    },
                    onDragCancel = ::settle,
                ) { change, delta ->
                    change.consume()
                    val crossed = abs(offset) >= threshold
                    offset += delta
                    if (!crossed && abs(offset) >= threshold) haptics.performHapticFeedback(HapticFeedbackType.GestureThresholdActivate)
                }
            }.graphicsLayer {
                translationX = offset
                rotationZ = offset / density.density * TILT_DEGREES_PER_DP
            },
    ) {
        QuestionTitle(text = statement, modifier = Modifier.padding(20.dp), graded = graded)
    }
}

@Composable
private fun sideLabel(
    side: Side,
    words: TrueFalseWords,
): String =
    when (side) {
        Side.Blank -> stringResource(R.string.questions_leave_blank)
        Side.True -> trueFalseLabel(true, words)
        Side.False -> trueFalseLabel(false, words)
    }

/** "True" or "False", or "Right" or "Wrong" where the exam says it that way. */
@Composable
fun trueFalseLabel(
    isTrue: Boolean,
    words: TrueFalseWords,
): String =
    when (words) {
        TrueFalseWords.RightWrong -> stringResource(if (isTrue) R.string.questions_right else R.string.questions_wrong)
        TrueFalseWords.TrueFalse -> stringResource(if (isTrue) R.string.questions_true else R.string.questions_false)
    }

/** A blank is neither right nor wrong: it stays picked, never red. */
private fun sideResult(
    side: Side,
    check: TrueFalseCheck?,
): AnswerResult? {
    val answer = side.answer as? Answer.TrueFalse ?: return null
    return when {
        check == null -> null
        check.correct == answer.isTrue -> AnswerResult.Right
        check.answer == answer -> AnswerResult.Wrong
        else -> null
    }
}

private val SWIPE_THRESHOLD = 90.dp
private const val TILT_DEGREES_PER_DP = 0.06f
