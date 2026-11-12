package com.zoonk.android.feature.focustest

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.LoadState
import com.zoonk.android.feature.onboarding.focusCheckpointOf
import com.zoonk.android.feature.onboarding.focusOfferOf
import com.zoonk.android.feature.onboarding.focusSittingOf
import com.zoonk.android.feature.onboarding.focusTestOf
import com.zoonk.android.feature.onboarding.placementOf
import com.zoonk.android.feature.onboarding.trueFalseQuestion
import com.zoonk.api.models.Placement
import org.junit.Assert.assertEquals
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
    fun offersTheTestToALearnerWhoHasNotStartedWithTheTimeItTakes() {
        val shown = phase(ready(focusTestOf(offer = focusOfferOf(minutes = 15))))

        assertEquals(15, (shown as FocusTestPhase.Offer).minutes)
    }

    @Test
    fun showsTheResultOnceThereAreAnswersAndNoSittingIsOpen() {
        val shown = phase(ready(focusTestOf(asked = 6, offer = focusOfferOf(), checkpoint = focusCheckpointOf())))

        assertTrue(shown is FocusTestPhase.Checkpoint)
    }

    @Test
    fun asksTheNextQuestionRightAfterAStartOrAnAnswer() {
        val test = focusTestOf(asked = 6, sitting = focusSittingOf(answered = 6), offer = null, checkpoint = focusCheckpointOf())

        assertTrue(phase(ready(test, next = QUESTION), entered = true) is FocusTestPhase.Question)
    }

    @Test
    fun neverOpensOnAQuestionASittingWithAnswersWaitsOnItsResumeScreenCountingEverySavedAnswer() {
        val test = focusTestOf(asked = 6, sitting = focusSittingOf(answered = 1), offer = null, checkpoint = focusCheckpointOf())
        val shown = phase(placementOf(next = QUESTION, answered = 7, focusTest = test))

        assertEquals(7L, (shown as FocusTestPhase.Resume).answered)
    }

    @Test
    fun offersASittingLeftBeforeItsFirstAnswerAgainWithItsOwnTime() {
        val shown = phase(ready(focusTestOf(sitting = focusSittingOf(questions = 12), offer = focusOfferOf(minutes = 12)), next = QUESTION))

        assertEquals(12, (shown as FocusTestPhase.Offer).minutes)
    }

    @Test
    fun endsASittingThatHasNothingMoreToAsk() {
        val sitting = focusSittingOf(answered = 6, subject = null)
        val test = focusTestOf(asked = 6, sitting = sitting, offer = null, checkpoint = focusCheckpointOf())
        val shown = phase(placementOf(status = "done", next = null, focusTest = test))

        assertEquals(FocusTestPhase.Ended, shown)
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
    fun stillOffersTheTestWhileThePlanIsWrittenWhenTheSittingsSizeIsKnown() {
        assertTrue(phase(placementOf(status = "preparing", next = null, focusTest = focusTestOf())) is FocusTestPhase.Offer)
    }

    @Test
    fun aStartedTestWaitsForItsQuestionsInsteadOfOfferingItAgain() {
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
        assertEquals(FocusTestPhase.Checkpoint(test), focusTestPhase(LoadState.Loading, entered = false, closed = test))
    }

    private companion object {
        val QUESTION = trueFalseQuestion()
    }
}
