package com.zoonk.android.feature.practice

import com.zoonk.android.feature.questions.Answer
import org.junit.Assert.assertEquals
import org.junit.Test

class ResumableAnswersTest {
    private fun answer(itemId: String) = GradedAnswer(itemId, Answer.Choice(0), 1_000)

    @Test
    fun keepsTheAnswersToTheQuestionsInOrderShortOfTheLast() {
        val kept = listOf(answer("a"), answer("b"), answer("c"))

        assertEquals(listOf(answer("a"), answer("b")), resumableAnswers(kept, listOf("a", "b", "c"), total = 3))
        assertEquals(kept, resumableAnswers(kept, listOf("a", "b", "c", "d"), total = 4))
    }

    @Test
    fun stopsAtTheFirstAnswerToAnotherQuestion() {
        val kept = listOf(answer("a"), answer("x"), answer("c"))

        assertEquals(listOf(answer("a")), resumableAnswers(kept, listOf("a", "b", "c", "d"), total = 4))
        assertEquals(emptyList<GradedAnswer>(), resumableAnswers(kept, emptyList(), total = 0))
    }
}
