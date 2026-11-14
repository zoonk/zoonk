package com.zoonk.android.feature.questions

import androidx.annotation.StringRes
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
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
import com.zoonk.android.ui.richtext.RichTextLine
import com.zoonk.android.ui.richtext.SpokenText
import com.zoonk.android.ui.theme.GeistMono

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
            AnswerLine(R.string.questions_right_answer, feedback.correctAnswer, question, words, explanation)
        }

        feedback.explanation?.let { ItemText(it, style = explanation) }
        if (!feedback.isCorrect) WorkedSteps(feedback.workedSteps)
        question.citation?.let { ItemCitationNote(it) }
        notes()
        MistakeNote(feedback)
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

/**
 * [label] around an answer: picked options, pairs and numbers as item text with their math, and a
 * typed answer exactly as typed, since it's plain text (`__init__` keeps its underscores). With
 * [mutedLabel], the label's words are muted and a number is set in mono, as main's checkpoint
 * review draws its "Answer:" line.
 */
@Composable
fun AnswerLine(
    @StringRes label: Int,
    answer: Answer?,
    question: Question,
    words: TrueFalseWords,
    style: TextStyle,
    mutedLabel: Boolean = false,
) {
    val text = answerText(answer, question, words) ?: return
    if (!mutedLabel) {
        val line = stringResource(label, text)
        if (answer is Answer.Text) Text(line, style = style) else ItemLine(line, style = style)
        return
    }
    val (before, after) = stringResource(label, ANSWER_MARK).split(ANSWER_MARK).let { it.first() to it.getOrElse(1) { "" } }
    val shown = if (answer is Answer.Text) SpokenText(AnnotatedString(text)) else itemLine(text)
    val muted = SpanStyle(color = MaterialTheme.colorScheme.onSurfaceVariant)
    val line =
        buildAnnotatedString {
            withStyle(muted) { append(before) }
            if (answer is Answer.Numeric) withStyle(SpanStyle(fontFamily = GeistMono)) { append(shown.text) } else append(shown.text)
            withStyle(muted) { append(after) }
        }
    RichTextLine(SpokenText(line, shown.spoken?.let { before + it + after }), Modifier, style)
}

private const val ANSWER_MARK = "\uE000"

/** An answer in words: an option's, steps in their order, pairs, a number with its unit. */
@Composable
private fun answerText(
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
            options.getOrNull(answer.index)
        }

        is Answer.Choices -> {
            answer.indexes.joinToString("; ") { options.getOrElse(it) { "" } }
        }

        is Answer.Order -> {
            answer.order.joinToString(" → ") { options.getOrElse(it) { "" } }
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
                    "$entry → ${right.getOrElse(answer.matches.getOrElse(index) { -1 }) { "" }}"
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
            val line = itemLine(step)
            DiffLine(if (index == steps.lastIndex) DiffKind.Added else DiffKind.Context, line.text, spoken = line.spoken)
        }

    // A formula reads left to right in every language.
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
        DiffLines(lines, added = stringResource(R.string.questions_result), modifier = modifier)
    }
}

@Composable
private fun MistakeNote(feedback: AnswerFeedback) {
    val text =
        when {
            feedback.fixedCount == 1 -> stringResource(R.string.questions_mistake_fixed)
            feedback.fixedCount > 1 -> pluralStringResource(R.plurals.questions_mistakes_fixed, feedback.fixedCount, feedback.fixedCount)
            feedback.savedToNotebook -> stringResource(R.string.questions_saved)
            else -> return
        }
    FeedbackNote(text)
}

/** Choices and statements mark the right option themselves. */
private val QuestionFormat.showsRightAnswer: Boolean
    get() = this != QuestionFormat.MultipleChoice && this != QuestionFormat.TrueFalse

private const val SHOWN_STREAK = 3
