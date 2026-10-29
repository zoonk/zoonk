package com.zoonk.android.feature.questions

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.components.FeedbackNote
import com.zoonk.android.ui.components.FeedbackPanel
import com.zoonk.android.ui.components.FeedbackTone
import com.zoonk.android.ui.components.FeedbackVerdict
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatMathAnswer
import com.zoonk.android.ui.theme.withTabularFigures

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
    // A formula reads left to right in every language.
    val style =
        MaterialTheme.typography.bodyMedium
            .withTabularFigures()
            .copy(textDirection = TextDirection.Ltr)
    val result = stringResource(R.string.questions_result, plainItemLine(steps.last()))

    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) { WorkedStepLines(steps, style, result, modifier) }
}

@Composable
private fun WorkedStepLines(
    steps: List<String>,
    style: TextStyle,
    result: String,
    modifier: Modifier,
) {
    val shape = RoundedCornerShape(10.dp)

    Column(
        modifier
            .fillMaxWidth()
            .clip(shape)
            .border(1.dp, MaterialTheme.colorScheme.outlineVariant, shape)
            .padding(vertical = 4.dp),
    ) {
        steps.forEachIndexed { index, step ->
            val last = index == steps.lastIndex
            val line = plainItemLine(step)

            if (last) {
                Row(
                    Modifier
                        .fillMaxWidth()
                        .background(MaterialTheme.colorScheme.tertiaryContainer)
                        .clearAndSetSemantics { contentDescription = result }
                        .padding(horizontal = 12.dp, vertical = 2.dp),
                ) {
                    Text(text = "+ ", color = MaterialTheme.colorScheme.onTertiaryContainer, style = style)
                    Text(text = line, color = MaterialTheme.colorScheme.onTertiaryContainer, style = style)
                }
            } else {
                Text(
                    text = line,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 2.dp),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = style,
                )
            }
        }
    }
}

@Composable
private fun MistakeNote(
    feedback: AnswerFeedback,
    examTomorrow: Boolean,
) {
    val text =
        when {
            feedback.fixedCount > 0 -> pluralStringResource(R.plurals.questions_mistakes_fixed, feedback.fixedCount, feedback.fixedCount)
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
