package com.zoonk.android.feature.questions

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.zoonk.android.feature.player.steps.StepPart
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber

/** A checked answer: what was sent, the right one when the server says it, and the verdict. */
data class AnswerCheck(
    val answer: Answer,
    val correct: Answer?,
    val isCorrect: Boolean,
) {
    /** A checkpoint names the right answer only at its end: until then a right pick is the one to mark. */
    val marked: Answer? get() = correct ?: answer.takeIf { isCorrect }
}

/**
 * The answer controls for any format (main's `QuestionView`). [onAnswer] gets the answer as it's
 * made, null until it's complete; [onSubmit] gets one Done sends from a typed or numeric box. Key it
 * by the question. A statement shows its own words on its card, so its host leaves the title out.
 * Across a spread ([part]) only a statement's card draws on the screen's page; every control draws
 * on the turn's. A statement shows [draft], what [onAnswer] last got, so its card and its answers
 * show the same pick on both pages.
 */
@Composable
fun QuestionAnswer(
    question: Question,
    words: TrueFalseWords,
    allowBlank: Boolean,
    check: AnswerCheck?,
    draft: Answer?,
    enabled: Boolean,
    onAnswer: (Answer?) -> Unit,
    onSubmit: (Answer) -> Unit,
    modifier: Modifier = Modifier,
    part: StepPart = StepPart.Whole,
) {
    if (!part.showsTurn && question.format != QuestionFormat.TrueFalse) return

    when (question.format) {
        QuestionFormat.Numeric -> {
            val sent =
                (check?.answer as? Answer.Numeric)?.value?.let {
                    formatNumber(
                        it,
                        currentLocale(),
                        MAX_SHOWN_DIGITS,
                        grouping = false,
                    )
                }
            NumericAnswerField(
                question.entry,
                question.unit,
                check?.mark,
                enabled,
                onAnswer,
                onSubmit,
                modifier,
                initialText = sent.orEmpty(),
            )
        }

        QuestionFormat.Typed -> {
            TypedAnswerField(
                check?.mark,
                enabled,
                onAnswer,
                onSubmit,
                modifier,
                initialText = (check?.answer as? Answer.Text)?.text.orEmpty(),
            )
        }

        QuestionFormat.Order -> {
            val order = check?.answer as? Answer.Order
            OrderQuestion(
                steps = question.options.orEmpty(),
                check = order?.let { OrderCheck(it.order, (check.marked as? Answer.Order)?.order.orEmpty()) },
                enabled = enabled,
                onAnswer = onAnswer,
                modifier = modifier,
            )
        }

        QuestionFormat.MatchPairs -> {
            MatchPairsQuestion(question.left.orEmpty(), question.right.orEmpty(), enabled && check == null, onAnswer, modifier)
        }

        QuestionFormat.TrueFalse -> {
            TrueFalseQuestion(
                statement = question.question,
                words = words,
                allowBlank = allowBlank,
                check = check?.let { TrueFalseCheck(it.answer, (it.marked as? Answer.TrueFalse)?.isTrue) },
                picked = draft,
                enabled = enabled,
                onAnswer = onAnswer,
                modifier = modifier,
                part = part,
            )
        }

        QuestionFormat.MultipleChoice -> {
            ChoiceQuestion(
                options = question.options.orEmpty(),
                select = question.select,
                check = check?.let { ChoiceCheck(it.marked.picks, it.answer.picks) },
                enabled = enabled,
                onAnswer = onAnswer,
                modifier = modifier,
            )
        }
    }
}

/** "I don't know yet" isn't marked right or wrong. */
private val AnswerCheck.mark: AnswerMark?
    get() =
        when {
            answer == Answer.DontKnow -> null
            isCorrect -> AnswerMark.Correct
            else -> AnswerMark.Wrong
        }

/** A sent number shows as typed, never rounded. */
private const val MAX_SHOWN_DIGITS = 20
