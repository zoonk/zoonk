package com.zoonk.android.feature.onboarding.setup

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.LoadState
import com.zoonk.android.feature.onboarding.ITEM_ID
import com.zoonk.android.feature.onboarding.MOCK_ID
import com.zoonk.android.feature.onboarding.mockOptionsOf
import com.zoonk.android.feature.onboarding.placementOf
import com.zoonk.android.feature.onboarding.runningMock
import com.zoonk.android.feature.onboarding.trueFalseQuestion
import com.zoonk.api.models.MockOptions
import com.zoonk.api.models.Placement
import com.zoonk.api.models.TrueFalseLabels
import org.junit.Assert.assertEquals
import org.junit.Test

class PlacementPhaseTest {
    private fun phase(
        placement: Placement = placementOf(),
        mocks: LoadState<MockOptions> = LoadState.Empty,
        started: Boolean = false,
        shown: Shown = Shown(),
    ) = placementPhase(LoadState.Loaded(placement), mocks, started, shown)

    @Test
    fun waitsForBothReads() {
        assertEquals(PlacementPhase.Loading, placementPhase(LoadState.Loading, LoadState.Empty, started = false, Shown()))
        assertEquals(PlacementPhase.Loading, placementPhase(LoadState.Loaded(placementOf()), LoadState.Idle, started = false, Shown()))
    }

    @Test
    fun opensOnTheIntroUntilTheLearnerStarts() {
        assertEquals(PlacementPhase.Intro(mock = null), phase())
    }

    @Test
    fun aMockExamIsOfferedWithItsShortestAndLongestLengths() {
        val offer = phase(mocks = LoadState.Loaded(mockOptionsOf(access = "plusRequired", minutes = listOf(15, 30, 55))))

        assertEquals(PlacementPhase.Intro(MockOffer(shortestMinutes = 15, longestMinutes = 55, plusRequired = true)), offer)
    }

    @Test
    fun aGoalWithoutMocksStillOpensWhenTheirReadFailed() {
        assertEquals(PlacementPhase.Intro(mock = null), phase(mocks = LoadState.Failed(ApiError.Network)))
    }

    @Test
    fun startedShowsTheNextQuestionNumbered() {
        val question = phase(placementOf(answered = 3, spent = 0.4), started = true) as PlacementPhase.Question

        assertEquals(ITEM_ID, question.item.itemId)
        assertEquals(4, question.number)
        assertEquals(0.4, question.spent, 0.0)
    }

    @Test
    fun answersFromBeforeResumeWithoutTheIntro() {
        assertEquals(4, (phase(placementOf(answered = 3, started = true)) as PlacementPhase.Question).number)
    }

    @Test
    fun questionsStillBeingWrittenWaitAfterStart() {
        assertEquals(PlacementPhase.Waiting, phase(placementOf(status = "preparing", next = null), started = true))
        assertEquals(PlacementPhase.Waiting, phase(placementOf(status = "failed", next = null), started = true))
        assertEquals(PlacementPhase.Intro(mock = null), phase(placementOf(status = "waitingForQuestions", next = null)))
    }

    @Test
    fun aGoalWithoutQuestionsSaysSoOnceStarted() {
        assertEquals(PlacementPhase.Unavailable, phase(placementOf(status = "unavailable", next = null), started = true))
    }

    @Test
    fun todaysFewMinutesEndPlacementForToday() {
        val done = phase(placementOf(status = "done", next = null, answered = 8, dayBudgetUsed = true), started = true)

        assertEquals(PlacementPhase.Done(answered = 8, forToday = true, fromMock = false), done)
    }

    @Test
    fun neitherTheNumberNorTheBarGoesBack() {
        val question = phase(placementOf(answered = 2, spent = 0.1), started = true, shown = Shown(answered = 5, spent = 0.6))

        assertEquals(PlacementPhase.Question((question as PlacementPhase.Question).item, 6, 0.6, TrueFalseLabels.TRUE_FALSE), question)
    }

    @Test
    fun aMockExamTakenInsteadWins() {
        val running = LoadState.Loaded(mockOptionsOf(mock = runningMock()))
        val finished = LoadState.Loaded(mockOptionsOf(mock = """{"id":"$MOCK_ID","status":"finished"}"""))

        assertEquals(PlacementPhase.MockRunning(MOCK_ID), phase(placementOf(answered = 2), mocks = running, started = true))
        assertEquals(
            PlacementPhase.Done(answered = 12, forToday = false, fromMock = true),
            phase(placementOf(answered = 12), mocks = finished),
        )
    }

    @Test
    fun aStatementIsJudgedTrueOrFalse() {
        val question = phase(placementOf(next = trueFalseQuestion(), labels = "rightWrong"), started = true) as PlacementPhase.Question

        assertEquals(PlacementFormat.TrueFalse, question.item.format)
        assertEquals(TrueFalseLabels.RIGHT_WRONG, question.labels)
    }
}
