package com.zoonk.android.feature.practice

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
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
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.TaskActions
import com.zoonk.android.ui.components.TaskSegment
import com.zoonk.android.ui.components.TextButton
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.FeedbackSubmissionContext
import java.util.UUID

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
        TextButton(busy = state == UndoState.Pending, onClick = onUndo, modifier = width) { Text(stringResource(R.string.practice_undo)) }
    }
}

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
    var sender by rememberSaveable { mutableStateOf<AnswerSender?>(null) }

    fun send(
        by: AnswerSender,
        action: () -> Unit,
    ) {
        sender = by
        action()
    }

    val next: (() -> Unit)? =
        when {
            (sent || finishNow) && !pending -> ({ send(AnswerSender.Check, onSend) })
            question != null && pick != null && !locked -> ({ send(AnswerSender.Check) { onAnswer(question, pick) } })
            else -> null
        }

    RunFrame(
        title = title,
        question = question,
        place = shown,
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
                            NotSureButton(
                                onClick = { send(AnswerSender.NotSure) { onAnswer(question, Answer.DontKnow) } },
                                enabled = !locked,
                                busy = pending && sender == AnswerSender.NotSure,
                                focusableWhenDisabled = pending,
                                dontKnowYet = true,
                            )
                        }
                        Button(
                            busy = pending && (question == null || sender == AnswerSender.Check),
                            onClick = { next?.invoke() },
                            modifier = width,
                            enabled = next != null,
                            focusableWhenDisabled = pending,
                        ) {
                            Text(
                                stringResource(
                                    when {
                                        question == null -> R.string.practice_finish_now
                                        shown + 1 >= total -> R.string.practice_finish
                                        else -> R.string.practice_next
                                    },
                                ),
                            )
                        }
                    }
                }
            },
        aside = aside,
    ) { part, inlineSet, asideShown ->
        if (question == null) {
            if (waitingForMore && part.showsScreen) waiting()
            return@RunFrame
        }
        key(shown) {
            if (part.showsScreen) {
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
            }
            QuestionAnswer(
                question = question,
                words = words,
                allowBlank = false,
                check = null,
                draft = pick,
                enabled = !locked,
                onAnswer = { answer -> saved = Draft(shown, question.itemId, answer) },
                onSubmit = { answer -> if (!locked) send(AnswerSender.Check) { onAnswer(question, answer) } },
                part = part,
            )
        }
    }
}

private fun answeredSegments(
    answered: Int,
    total: Int,
): List<TaskSegment> =
    List(total) {
        when {
            it < answered -> TaskSegment.Read
            it == answered -> TaskSegment.Current
            else -> TaskSegment.Ahead
        }
    }
