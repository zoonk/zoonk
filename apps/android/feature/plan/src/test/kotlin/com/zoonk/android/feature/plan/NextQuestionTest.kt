package com.zoonk.android.feature.plan

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** The Plan's row for an open test never promises a question past the test's ceiling. */
class NextQuestionTest {
    @Test
    fun anOpenTestWithQuestionsLeftNamesTheNextOne() {
        assertEquals(1L, nextQuestion(answered = 0, total = 8))
        assertEquals(8L, nextQuestion(answered = 7, total = 8))
    }

    @Test
    fun aTestWhoseAnswersReachedItsCeilingNamesNoQuestion() {
        assertNull(nextQuestion(answered = 8, total = 8))
        assertNull(nextQuestion(answered = 9, total = 8))
    }
}
