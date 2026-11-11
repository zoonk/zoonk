package com.zoonk.android.feature.focustest

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.LoadState
import com.zoonk.android.feature.onboarding.focusCheckpointOf
import com.zoonk.android.feature.onboarding.focusOfferOf
import com.zoonk.android.feature.onboarding.focusSittingOf
import com.zoonk.android.feature.onboarding.focusTestOf
import com.zoonk.android.feature.onboarding.placementOf
import com.zoonk.android.feature.onboarding.trueFalseQuestion
import com.zoonk.api.models.FocusTestSitting
import com.zoonk.api.models.Placement
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class FocusTestPhaseTest {
    private fun phase(
        placement: Placement,
        entered: Boolean = false,
    ) = focusTestPhase(LoadState.Loaded(placement), entered, closed = null)

    private fun ready(
        test: String?,
        next: String? = null,
    ) = placementOf(status = "asking", next = next, focusTest = test)

    @Test
    fun invitesALearnerWhoHasNotStartedWithTheSittingItWouldOpen() {
        val shown = phase(ready(focusTestOf(offer = focusOfferOf(pastCeiling = 9))))

        assertEquals(NextSitting(questions = 15, minutes = 15, pastCeiling = 9), (shown as FocusTestPhase.Invitation).next)
    }

    @Test
    fun showsTheResultOnceThereAreAnswersAndNoSittingIsOpen() {
        val shown = phase(ready(focusTestOf(asked = 6, offer = focusOfferOf(kind = "continuation"), checkpoint = focusCheckpointOf())))

        assertTrue(shown is FocusTestPhase.Checkpoint)
        assertNull((shown as FocusTestPhase.Checkpoint).end)
    }

    @Test
    fun asksTheNextQuestionRightAfterAStartOrAnAnswer() {
        val test = focusTestOf(asked = 6, sitting = focusSittingOf(answered = 6), offer = null, checkpoint = focusCheckpointOf())

        assertTrue(phase(ready(test, next = QUESTION), entered = true) is FocusTestPhase.Question)
    }

    @Test
    fun neverOpensOnAQuestionASittingWithAnswersWaitsOnItsResumeScreen() {
        val test = focusTestOf(asked = 6, sitting = focusSittingOf(answered = 6), offer = null, checkpoint = focusCheckpointOf())

        assertTrue(phase(ready(test, next = QUESTION)) is FocusTestPhase.Resume)
    }

    @Test
    fun offersASittingLeftBeforeItsFirstAnswerAgainWithItsOwnNumbers() {
        val shown = phase(ready(focusTestOf(sitting = focusSittingOf(questions = 12), offer = null), next = QUESTION))

        assertEquals(NextSitting(questions = 12, minutes = 12, pastCeiling = 0), (shown as FocusTestPhase.Invitation).next)
    }

    @Test
    fun endsASittingThatHasNothingMoreToAskWithItsReason() {
        val sitting = focusSittingOf(answered = 6, subject = null, end = "noQuestionsReady")
        val shown = phase(ready(focusTestOf(asked = 6, sitting = sitting, offer = null, checkpoint = focusCheckpointOf())))

        assertEquals(FocusTestPhase.Ended(FocusTestSitting.End.NO_QUESTIONS_READY), shown)
    }

    @Test
    fun waitsWhileQuestionsAreWrittenAndSaysWhetherThereAreAnswersToUse() {
        val answered = focusTestOf(asked = 2, sitting = focusSittingOf(answered = 2), offer = null, checkpoint = focusCheckpointOf())

        assertEquals(FocusTestPhase.Waiting(answered = true), phase(placementOf(status = "preparing", next = null, focusTest = answered)))
        assertEquals(FocusTestPhase.Waiting(answered = false), phase(placementOf(status = "preparing", next = null)))
    }

    @Test
    fun aReadThatNeverCameBackSaysItDidNotLoadInsteadOfWaitingForQuestions() {
        assertEquals(FocusTestPhase.LoadFailed, focusTestPhase(LoadState.Failed(ApiError.Network), entered = false, closed = null))
    }

    @Test
    fun stillInvitesWhileThePlanIsWrittenWhenTheSittingsSizeIsKnown() {
        assertTrue(phase(placementOf(status = "preparing", next = null, focusTest = focusTestOf())) is FocusTestPhase.Invitation)
    }

    @Test
    fun aStartedTestWaitsForItsQuestionsInsteadOfInvitingAgain() {
        assertEquals(
            FocusTestPhase.Waiting(answered = false),
            phase(placementOf(status = "preparing", next = null, focusTest = focusTestOf()), entered = true),
        )
    }

    @Test
    fun hasNothingToShowForAGoalWithNoTestOrATestWithNothingToAsk() {
        assertEquals(FocusTestPhase.Unavailable, phase(ready(null)))
        assertEquals(FocusTestPhase.Unavailable, phase(ready(focusTestOf(offer = null))))
        assertEquals(FocusTestPhase.Unavailable, phase(placementOf(status = "unavailable", next = null)))
    }

    @Test
    fun aSittingClosedInThisVisitShowsItsResult() {
        val test =
            phase(ready(focusTestOf(asked = 6, offer = null, checkpoint = focusCheckpointOf()))).let {
                (it as FocusTestPhase.Checkpoint).test
            }
        val closed = Closed(test, FocusTestSitting.End.SETTLED)

        assertEquals(
            FocusTestPhase.Checkpoint(test, FocusTestSitting.End.SETTLED),
            focusTestPhase(LoadState.Loading, entered = false, closed),
        )
    }

    @Test
    fun nothingIsNextWhileASittingWithAnswersIsOpenOrOnceNothingIsLeftToAsk() {
        assertNull(nextSitting(testOf(focusTestOf(asked = 1, sitting = focusSittingOf(answered = 1), offer = null))))
        assertNull(nextSitting(testOf(focusTestOf(offer = null, checkpoint = focusCheckpointOf()))))
    }

    private fun testOf(json: String) = checkNotNull(ready(json).focusTest)

    private companion object {
        val QUESTION = trueFalseQuestion()
    }
}
