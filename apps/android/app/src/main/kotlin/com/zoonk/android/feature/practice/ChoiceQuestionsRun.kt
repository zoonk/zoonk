package com.zoonk.android.feature.practice

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.LineBreak
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.recode
import com.zoonk.android.feature.feedback.FeedbackTarget
import com.zoonk.android.feature.questions.Answer
import com.zoonk.android.feature.questions.ItemSetText
import com.zoonk.android.feature.questions.ItemSupport
import com.zoonk.android.feature.questions.NotSureButton
import com.zoonk.android.feature.questions.Question
import com.zoonk.android.feature.questions.QuestionAnswer
import com.zoonk.android.feature.questions.QuestionFormat
import com.zoonk.android.feature.questions.QuestionTitle
import com.zoonk.android.feature.questions.TrueFalseWords
import com.zoonk.android.ui.components.TaskActions
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.FeedbackSubmissionContext
import com.zoonk.api.models.ItemAnswerInput
import kotlinx.serialization.Serializable
import java.util.UUID

/** One answer of a run graded only at its end, in the API's shape. */
@Serializable
data class GradedAnswer(
    val itemId: String,
    val answer: Answer,
    val durationMs: Long,
)

fun GradedAnswer.input() = ItemAnswerInput(answer.recode(), durationMs, UUID.fromString(itemId))

enum class UndoState { Idle, Pending, Done, Failed }

@Composable
internal fun UndoAction(
    state: UndoState,
    onUndo: () -> Unit,
) {
    if (state == UndoState.Failed) {
        Text(
            stringResource(R.string.practice_undo_failed),
            Modifier.semantics { liveRegion = LiveRegionMode.Polite },
            color = MaterialTheme.colorScheme.error,
            style = MaterialTheme.typography.bodyMedium,
        )
    }
    TaskActions { width ->
        TextButton(
            onClick = onUndo,
            enabled = state != UndoState.Pending,
            modifier = width,
        ) { Text(stringResource(R.string.practice_undo)) }
    }
}

/** A run's answers so far and the id they're sent with, kept until graded so a send that never answered counts once. */
@Serializable
data class AnswersDraft(
    val requestId: String,
    val answers: List<GradedAnswer> = emptyList(),
)

/**
 * The answers that match the questions in order, short of the last one, so reopening a run while
 * it was being graded asks the last question again instead of finishing on its own.
 */
fun resumableAnswers(
    answers: List<GradedAnswer>,
    questionIds: List<String>,
    total: Int,
): List<GradedAnswer> =
    answers
        .zip(questionIds)
        .takeWhile { (answer, id) -> answer.itemId == id }
        .map { it.first }
        .take(maxOf(0, total - 1))

/** Questions still being written: [total] counts them too, and [ended] says the rest won't come. */
@Immutable
data class UpcomingQuestions(
    val total: Int,
    val ended: Boolean,
)

/**
 * Main's `ChoiceQuestionsRun`: one question at a time with no feedback until the end. "I don't know
 * yet" is an answer too. [onAnswer] takes each one; the host sends them all after the last, and
 * [onSend] sends them again after a failed send or, once the [upcoming] ones won't come, as they are.
 * [hint] shows over each question, unless [aside] shows beside it on a wide window; [waiting] shows
 * while the next questions are written.
 */
@Composable
internal fun ChoiceQuestionsRun(
    title: String,
    questions: List<Question>,
    answered: Int,
    words: TrueFalseWords,
    app: AppContainer,
    screen: String,
    pending: Boolean,
    failed: Boolean,
    onAnswer: (Question, Answer) -> Unit,
    onSend: () -> Unit,
    onClose: () -> Unit,
    hint: (Question) -> String? = { null },
    aside: (@Composable ColumnScope.() -> Unit)? = null,
    upcoming: UpcomingQuestions? = null,
    waiting: @Composable ColumnScope.() -> Unit = {},
) {
    val total = maxOf(questions.size, upcoming?.total ?: 0)
    val waitingForMore = answered >= questions.size && answered < total
    val finishNow = waitingForMore && upcoming?.ended == true
    // The last question stays while the answers are sent, with its Finish, or Try again when that failed.
    val shown = if (waitingForMore) -1 else minOf(answered, questions.size - 1)
    val sent = answered >= total
    val question = questions.getOrNull(shown)
    var saved by rememberDraft()
    val pick = saved.answerFor(shown, question)
    val locked = pending || failed || sent
    val next: (() -> Unit)? =
        when {
            (sent || finishNow) && !pending -> onSend
            question != null && pick != null && !locked -> ({ onAnswer(question, pick) })
            else -> null
        }

    RunFrame(
        title = title,
        question = question,
        app = app,
        onClose = onClose,
        mainAction = next,
        report = question?.let { FeedbackTarget(screen, FeedbackSubmissionContext.ContentKind.ITEM, UUID.fromString(it.itemId)) },
        progress = { if (total > 0) RunMeter(answered, total, answeredSegments(answered, total)) },
        actions =
            if (question == null && !finishNow) {
                null
            } else {
                {
                    if (failed && !pending) SaveErrorText(onSend)
                    TaskActions { width ->
                        if (question != null) {
                            NotSureButton(onClick = { onAnswer(question, Answer.DontKnow) }, enabled = !locked, dontKnowYet = true)
                        }
                        BusyButton(
                            stringResource(
                                when {
                                    question == null -> R.string.practice_finish_now
                                    shown + 1 >= total -> R.string.practice_finish
                                    else -> R.string.practice_next
                                },
                            ),
                            busy = pending,
                            enabled = next != null,
                            modifier = width,
                        ) { next?.invoke() }
                    }
                }
            },
        aside = aside,
    ) { inlineSet, asideShown ->
        if (question == null) {
            if (waitingForMore) waiting()
            return@RunFrame
        }
        key(shown) {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    text = hint(question)?.takeUnless { asideShown }.orEmpty(),
                    modifier = Modifier.weight(1f).alignByBaseline(),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium.copy(lineBreak = LineBreak.Paragraph),
                )
                Text(
                    text = stringResource(R.string.practice_count, shown + 1, total),
                    modifier = Modifier.alignByBaseline(),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.labelMedium.withTabularFigures(),
                )
            }
            question.set?.let { set -> if (inlineSet) ItemSetText(set) }
            ItemSupport(question)
            if (question.format != QuestionFormat.TrueFalse) QuestionTitle(question.question)
            QuestionAnswer(
                question = question,
                words = words,
                allowBlank = false,
                check = null,
                enabled = !locked,
                onAnswer = { answer -> saved = Draft(shown, question.itemId, answer) },
                onSubmit = { answer -> if (!locked) onAnswer(question, answer) },
            )
        }
    }
}

private fun answeredSegments(
    answered: Int,
    total: Int,
): List<Segment> =
    List(total) {
        when {
            it < answered -> Segment.Read
            it == answered -> Segment.Current
            else -> Segment.Ahead
        }
    }
