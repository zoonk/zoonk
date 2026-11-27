package com.zoonk.android.feature.essay

import com.zoonk.api.models.WritingResultOutputOneOf1
import org.junit.Assert.assertEquals
import org.junit.Test

/** The one step a result leads with: never "done" for an answer that still has work, as the web's `getNextStep` decides. */
class WritingNextStepTest {
    @Test
    fun aZeroedAnswerIsNeverDone() {
        // An older zeroed answer: no step at all, no kind, yet still the rule it broke, never "nothing left".
        assertEquals(NextStep.Zero(text = "", zeroKind = null), result(ZEROED_RESULT).toGrade()!!.nextStep(ANSWER_TEXT))
        assertEquals(
            NextStep.Zero(text = "", zeroKind = WritingResultOutputOneOf1.ZeroKind.OFF_TOPIC),
            result(ZEROED_KIND_RESULT).toGrade()!!.nextStep(ANSWER_TEXT),
        )
    }

    @Test
    fun fullMarksPastTheLimitAskToFitIt() = assertEquals(NextStep.Limit, result(LIMIT_RESULT).toGrade()!!.nextStep(ANSWER_TEXT))

    @Test
    fun everyCriterionCompleteIsDone() = assertEquals(NextStep.Done, result(DONE_RESULT).toGrade()!!.nextStep(ANSWER_TEXT))

    @Test
    fun theGradersTitleLeadsAndAQuoteShowsOnlyWhenItIsInTheText() {
        val step = result(LEVELS_RESULT).toGrade()!!.nextStep(ANSWER_TEXT) as NextStep.Criterion
        assertEquals("Name two of the TCU's powers", step.title)
        assertEquals("exercised by Congress with the help of the TCU", step.quote)

        // No title from older graders: the criterion's name stands in.
        val older = result(LEVELS_RESULT.replace(""""title":"Name two of the TCU's powers",""", "")).toGrade()!!
        assertEquals("The TCU's powers", (older.nextStep(ANSWER_TEXT) as NextStep.Criterion).title)

        val elsewhere = result(LEVELS_RESULT).toGrade()!!.nextStep("A text that quotes nothing.") as NextStep.Criterion
        assertEquals(null, elsewhere.quote)
    }
}
