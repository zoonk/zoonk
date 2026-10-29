package com.zoonk.android.feature.questions

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber

/** A checked answer: what was sent, the right one when the server says it, and the verdict. */
data class AnswerCheck(
    val answer: Answer,
    val correct: Answer?,
    val isCorrect: Boolean,
)

/**
 * The answer controls for any format (main's `QuestionView`). [onAnswer] gets the answer as it's
 * made, null until it's complete; [onSubmit] gets one Done sends from a typed or numeric box. Key it
 * by the question. A statement shows its own words on its card, so its host leaves the title out.
 */
@Composable
fun QuestionAnswer(
    question: Question,
    words: TrueFalseWords,
    allowBlank: Boolean,
    check: AnswerCheck?,
    enabled: Boolean,
    onAnswer: (Answer?) -> Unit,
    onSubmit: (Answer) -> Unit,
    modifier: Modifier = Modifier,
) {
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
                check = order?.let { OrderCheck(it.order, (check.correct as? Answer.Order)?.order.orEmpty()) },
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
                check = check?.let { TrueFalseCheck(it.answer, (it.correct as? Answer.TrueFalse)?.isTrue) },
                enabled = enabled,
                onAnswer = onAnswer,
                modifier = modifier,
            )
        }

        QuestionFormat.MultipleChoice -> {
            ChoiceQuestion(
                options = question.options.orEmpty(),
                select = question.select,
                check = check?.let { ChoiceCheck(it.correct.picks, it.answer.picks) },
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
