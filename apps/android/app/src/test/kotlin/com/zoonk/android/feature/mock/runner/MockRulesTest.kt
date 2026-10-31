package com.zoonk.android.feature.mock.runner

import com.zoonk.api.models.MockExamSectionsInnerNavigation
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MockRulesTest {
    private val navigation = MockExamSectionsInnerNavigation(answerChanges = null, forwardOnly = true, itemSeconds = 3, mustAnswer = true)

    private fun moves(
        answered: Boolean,
        navigation: MockExamSectionsInnerNavigation = this.navigation,
        position: Int = 0,
        reached: Int = 0,
        total: Int = 3,
        changesLeft: Int? = null,
    ) = SectionMoves.of(navigation, answered, position, reached, total, changed = emptySet(), changesLeft = changesLeft)

    @Test
    fun aBlankMandatoryQuestionKeepsTheNextClosed() {
        assertTrue(moves(answered = false).canOpen(0))
        assertFalse(moves(answered = false).canOpen(1))
    }

    @Test
    fun anAnswerOpensTheNextQuestionButNeverSkipsAhead() {
        assertTrue(moves(answered = true).canOpen(1))
        assertFalse(moves(answered = true).canOpen(2))
    }

    @Test
    fun aSectionThatMovesFreelyStillAsksForAnAnswer() {
        val free = moves(answered = false, navigation = navigation.copy(forwardOnly = false), position = 1, reached = 1)
        assertTrue(free.canOpen(1))
        assertFalse(free.canOpen(0))
        assertFalse(free.canOpen(2))
    }

    @Test
    fun aQuestionsClockMovesPastABlankOnlyToTheNextQuestion() {
        val blank = moves(answered = false)
        assertTrue(blank.canOpenAfterTimeout(1))
        assertFalse(blank.canOpenAfterTimeout(0))
        assertFalse(blank.canOpenAfterTimeout(2))
    }

    @Test
    fun nothingOpensOutsideTheSection() {
        assertFalse(moves(answered = true).canOpen(-1))
        assertFalse(moves(answered = true).canOpen(3))
    }

    @Test
    fun theReviewLeavesATimedOutBlankEvenWithNoChangesLeft() {
        val review =
            moves(answered = false, navigation = navigation.copy(answerChanges = 1), position = 0, reached = 4, total = 5, changesLeft = 0)
        assertFalse(review.canChange(0))
        assertTrue(review.canAdvance)
        assertTrue(review.canOpen(1))
        assertTrue(review.canOpen(4))
        assertEquals(null, review.itemSeconds)
    }

    @Test
    fun theReviewStillAsksForTheLastQuestionsAnswer() {
        val review =
            moves(answered = false, navigation = navigation.copy(answerChanges = 1), position = 4, reached = 4, total = 5, changesLeft = 1)
        assertFalse(review.canAdvance)
        assertFalse(review.canOpen(3))
    }

    @Test
    fun aBlankPickListOrBlankTextIsNoAnswer() {
        assertFalse(
            MockDraft(
                "a",
                com.zoonk.android.feature.questions.Answer
                    .Choices(emptyList()),
            ).isAnswered,
        )
        assertFalse(
            MockDraft(
                "a",
                com.zoonk.android.feature.questions.Answer
                    .Text("  "),
            ).isAnswered,
        )
        assertTrue(
            MockDraft(
                "a",
                com.zoonk.android.feature.questions.Answer
                    .Choice(0),
            ).isAnswered,
        )
        assertFalse(null.isAnswered)
    }
}
