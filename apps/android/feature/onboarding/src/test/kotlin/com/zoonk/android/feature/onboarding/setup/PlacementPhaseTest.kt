package com.zoonk.android.feature.onboarding.setup

import com.zoonk.android.data.LoadState
import com.zoonk.android.feature.onboarding.placementOf
import com.zoonk.api.models.Placement
import com.zoonk.api.models.TrueFalseLabels
import org.junit.Assert.assertEquals
import org.junit.Test

class PlacementPhaseTest {
    private fun phase(
        placement: Placement = placementOf(),
        started: Boolean = false,
        shown: Shown = Shown(),
    ) = placementPhase(LoadState.Loaded(placement), started, shown)

    @Test
    fun waitsForTheRead() {
        assertEquals(PlacementPhase.Loading, placementPhase(LoadState.Loading, started = false, Shown()))
    }

    @Test
    fun answersFromBeforeResumeWithoutTheIntro() {
        assertEquals(4, (phase(placementOf(answered = 3, started = true)) as PlacementPhase.Question).number)
    }

    @Test
    fun questionsStillBeingWrittenWaitAfterStart() {
        assertEquals(PlacementPhase.Waiting, phase(placementOf(status = "preparing", next = null), started = true))
        assertEquals(PlacementPhase.Waiting, phase(placementOf(status = "failed", next = null), started = true))
        assertEquals(PlacementPhase.Intro, phase(placementOf(status = "waitingForQuestions", next = null)))
    }

    @Test
    fun neitherTheNumberNorTheBarGoesBack() {
        val question = phase(placementOf(answered = 2, spent = 0.1), started = true, shown = Shown(answered = 5, spent = 0.6))

        assertEquals(PlacementPhase.Question((question as PlacementPhase.Question).item, 6, 0.6, TrueFalseLabels.TRUE_FALSE), question)
    }
}
