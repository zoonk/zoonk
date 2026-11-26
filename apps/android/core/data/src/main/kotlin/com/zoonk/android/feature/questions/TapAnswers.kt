package com.zoonk.android.feature.questions

import com.zoonk.api.models.ChoiceAnswer
import com.zoonk.api.models.ChoiceAnswerAnyOf
import com.zoonk.api.models.ChoiceAnswerAnyOf1
import com.zoonk.api.models.ChoiceAnswerAnyOf2
import com.zoonk.api.models.ChoiceAnswerAnyOf3
import com.zoonk.api.models.MatchAnswer
import com.zoonk.api.models.MatchAnswerMissesInner
import com.zoonk.api.models.OrderAnswer
import com.zoonk.api.models.TapAnswer

/** The answer placement and test-outs take; a number or text never comes from a tap. */
fun Answer.tap(): TapAnswer? =
    when (this) {
        is Answer.Choice -> {
            choice(ChoiceAnswer.ChoiceAnswerAnyOfValue(ChoiceAnswerAnyOf(index.toLong())))
        }

        is Answer.Choices -> {
            choice(ChoiceAnswer.ChoiceAnswerAnyOf1Value(ChoiceAnswerAnyOf1(indexes.map(Int::toLong))))
        }

        is Answer.TrueFalse -> {
            choice(ChoiceAnswer.ChoiceAnswerAnyOf2Value(ChoiceAnswerAnyOf2(isTrue)))
        }

        Answer.DontKnow -> {
            choice(ChoiceAnswer.ChoiceAnswerAnyOf3Value(ChoiceAnswerAnyOf3(dontKnow = true)))
        }

        is Answer.Matches -> {
            val tries = misses?.map { MatchAnswerMissesInner(it.left.toLong(), it.right.toLong()) }
            TapAnswer.MatchAnswerValue(MatchAnswer(matches.map(Int::toLong), tries))
        }

        is Answer.Order -> {
            TapAnswer.OrderAnswerValue(OrderAnswer(order.map(Int::toLong)))
        }

        is Answer.Numeric, is Answer.Text -> {
            null
        }
    }

private fun choice(answer: ChoiceAnswer) = TapAnswer.ChoiceAnswerValue(answer)
