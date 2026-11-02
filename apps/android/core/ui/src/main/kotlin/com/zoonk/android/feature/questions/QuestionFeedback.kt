package com.zoonk.android.feature.questions

import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.LayoutDirection
import com.zoonk.android.R
import com.zoonk.android.ui.components.DiffKind
import com.zoonk.android.ui.components.DiffLine
import com.zoonk.android.ui.components.DiffLines
import com.zoonk.android.ui.components.FeedbackNote
import com.zoonk.android.ui.components.FeedbackPanel
import com.zoonk.android.ui.components.FeedbackTone
import com.zoonk.android.ui.components.FeedbackVerdict
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatMathAnswer

/**
 * What a checked question got (main's `QuestionFeedback`): the verdict and any streak, the right
 * answer where the controls don't mark it, the explanation, the worked steps of a miss, the source,
 * a drill's [notes], and whether the mistake was saved or fixed.
 */
@Composable
fun QuestionFeedback(
    question: Question,
    answer: Answer,
    feedback: AnswerFeedback,
    words: TrueFalseWords,
    examTomorrow: Boolean,
    timedOut: Boolean,
    modifier: Modifier = Modifier,
    notes: @Composable ColumnScope.() -> Unit = {},
) {
    val verdict = verdict(feedback.isCorrect, blank = feedback.blank, notSure = answer == Answer.DontKnow && !timedOut)
    val streak = if (feedback.isCorrect) feedback.hyperdrive?.streak ?: 0 else 0
    val explanation = MaterialTheme.typography.bodyMedium

    FeedbackPanel(label = stringResource(R.string.questions_feedback_label), modifier = modifier) {
        FeedbackVerdict(
            text = verdict.label,
            tone = verdict.tone,
            end = if (streak >= SHOWN_STREAK) pluralStringResource(R.plurals.questions_streak, streak, streak) else null,
        )

        if (!feedback.isCorrect && question.format.showsRightAnswer) {
            answerText(
                feedback.correctAnswer,
                question,
                words,
            )?.let { Text(stringResource(R.string.questions_right_answer, it), style = explanation) }
        }

        feedback.explanation?.let { ItemText(it, style = explanation) }
        if (!feedback.isCorrect) WorkedSteps(feedback.workedSteps)
        question.citation?.let { ItemCitationNote(it) }
        notes()
        MistakeNote(feedback, examTomorrow)
    }
}

data class Verdict(
    val label: String,
    val tone: FeedbackTone,
)

/** A blank is neither right nor wrong, and the learner's own "I don't know yet" is never "Not quite". */
@Composable
fun verdict(
    isCorrect: Boolean,
    blank: Boolean = false,
    notSure: Boolean = false,
): Verdict =
    when {
        isCorrect -> Verdict(stringResource(R.string.questions_correct), FeedbackTone.Right)
        blank -> Verdict(stringResource(R.string.questions_left_blank), FeedbackTone.Neutral)
        notSure -> Verdict(stringResource(R.string.questions_dont_know_yet), FeedbackTone.Neutral)
        else -> Verdict(stringResource(R.string.questions_not_quite), FeedbackTone.Wrong)
    }

/** An answer in words: an option's, steps in their order, pairs, a number with its unit. */
@Composable
fun answerText(
    answer: Answer?,
    question: Question,
    words: TrueFalseWords,
): String? {
    val options = question.options.orEmpty()
    val locale = currentLocale()

    return when (answer) {
        null, Answer.DontKnow -> {
            null
        }

        is Answer.Choice -> {
            options.getOrNull(answer.index)?.let(::plainItemLine)
        }

        is Answer.Choices -> {
            answer.indexes.joinToString("; ") { plainItemLine(options.getOrElse(it) { "" }) }
        }

        is Answer.Order -> {
            answer.order.joinToString(" → ") { plainItemLine(options.getOrElse(it) { "" }) }
        }

        is Answer.Text -> {
            answer.text
        }

        is Answer.TrueFalse -> {
            trueFalseLabel(answer.isTrue, words)
        }

        is Answer.Numeric -> {
            formatMathAnswer(answer.value, locale, question.unit?.symbol)
        }

        is Answer.Matches -> {
            val right = question.right.orEmpty()
            question.left
                .orEmpty()
                .mapIndexed { index, entry ->
                    "${plainItemLine(entry)} → ${plainItemLine(right.getOrElse(answer.matches.getOrElse(index) { -1 }) { "" })}"
                }.joinToString("; ")
        }
    }
}

/** How to solve a missed problem, step by step, with its result marked. */
@Composable
fun WorkedSteps(
    steps: List<String>,
    modifier: Modifier = Modifier,
) {
    if (steps.isEmpty()) return
    val lines =
        steps.mapIndexed { index, step ->
            DiffLine(
                if (index ==
                    steps.lastIndex
                ) {
                    DiffKind.Added
                } else {
                    DiffKind.Context
                },
                plainItemLine(step),
            )
        }

    // A formula reads left to right in every language.
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
        DiffLines(lines, added = stringResource(R.string.questions_result), modifier = modifier)
    }
}

@Composable
private fun MistakeNote(
    feedback: AnswerFeedback,
    examTomorrow: Boolean,
) {
    val text =
        when {
            feedback.fixedCount == 1 -> stringResource(R.string.questions_mistake_fixed)
            feedback.fixedCount > 1 -> pluralStringResource(R.plurals.questions_mistakes_fixed, feedback.fixedCount, feedback.fixedCount)
            !feedback.savedToNotebook -> return
            examTomorrow -> stringResource(R.string.questions_saved)
            else -> stringResource(R.string.questions_saved_tomorrow)
        }
    FeedbackNote(text)
}

/** Choices and statements mark the right option themselves. */
private val QuestionFormat.showsRightAnswer: Boolean
    get() = this != QuestionFormat.MultipleChoice && this != QuestionFormat.TrueFalse

private const val SHOWN_STREAK = 3
