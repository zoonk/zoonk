package com.zoonk.android.feature.practice

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
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
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.FeedbackSubmissionContext
import kotlinx.serialization.Serializable
import java.util.UUID

/** One answer of a run graded only at its end, in the API's shape. */
@Serializable
data class GradedAnswer(
    val itemId: String,
    val answer: Answer,
    val durationMs: Long,
)

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

/**
 * Main's `ChoiceQuestionsRun`: one question at a time with no feedback until the end. "I don't know
 * yet" is an answer too. [onAnswer] takes each one; the host sends them all after the last. [hint]
 * shows over each question, unless [aside] shows beside it on a wide window.
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
    onRetry: () -> Unit,
    onClose: () -> Unit,
    hint: String? = null,
    aside: (@Composable ColumnScope.() -> Unit)? = null,
) {
    val total = questions.size
    // The last question stays while the answers are sent, with its Finish, or Try again when that failed.
    val shown = minOf(answered, total - 1)
    val sent = answered >= total
    val question = questions.getOrNull(shown)
    var saved by rememberDraft()
    val pick = saved.answerFor(shown, question)
    val locked = pending || failed || sent
    val next: (() -> Unit)? =
        when {
            sent && !pending -> onRetry
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
        actions = {
            question?.let {
                ActionColumn {
                    if (failed && !pending) SaveErrorText(onRetry)
                    ActionFlow { width ->
                        NotSureButton(onClick = { onAnswer(it, Answer.DontKnow) }, enabled = !locked, dontKnowYet = true)
                        BusyButton(
                            stringResource(if (shown + 1 >= total) R.string.practice_finish else R.string.practice_next),
                            busy = pending,
                            enabled = next != null,
                            modifier = width,
                        ) { next?.invoke() }
                    }
                }
            }
        },
        aside = aside,
    ) { inlineSet, asideShown ->
        question?.let {
            key(shown) {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(
                        text = hint?.takeUnless { asideShown }.orEmpty(),
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
                it.set?.let { set -> if (inlineSet) ItemSetText(set) }
                ItemSupport(it)
                if (it.format != QuestionFormat.TrueFalse) QuestionTitle(it.question)
                QuestionAnswer(
                    question = it,
                    words = words,
                    allowBlank = false,
                    check = null,
                    enabled = !locked,
                    onAnswer = { answer -> saved = Draft(shown, it.itemId, answer) },
                    onSubmit = { answer -> if (!locked) onAnswer(it, answer) },
                )
            }
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
