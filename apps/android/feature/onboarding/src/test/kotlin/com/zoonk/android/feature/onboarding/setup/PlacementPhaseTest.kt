package com.zoonk.android.feature.onboarding.setup

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.LoadState
import com.zoonk.android.feature.onboarding.MOCK_ID
import com.zoonk.android.feature.onboarding.mockOptionsOf
import com.zoonk.android.feature.onboarding.placementOf
import com.zoonk.android.feature.onboarding.runningMock
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
    fun aGoalWithoutMocksStillOpensWhenTheirReadFailed() {
        assertEquals(PlacementPhase.Intro(mock = null), phase(mocks = LoadState.Failed(ApiError.Network)))
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
}
