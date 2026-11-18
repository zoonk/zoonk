package com.zoonk.android.ui.components

import com.zoonk.android.data.PhaseStatus
import org.junit.Assert.assertEquals
import org.junit.Test

class GenerationWaitTest {
    @Test
    fun thePartsFillInOrderEachByItsShareOfTheBar() {
        assertEquals(listOf(0f, 0f, 0f), segmentFills(0f, listOf(1, 1, 2)))
        assertEquals(listOf(1f, 0f, 0f), segmentFills(0.25f, listOf(1, 1, 2)))
        assertEquals(listOf(1f, 0.5f, 0f), segmentFills(0.375f, listOf(1, 1, 2)))
        assertEquals(listOf(1f, 1f, 0.5f), segmentFills(0.75f, listOf(1, 1, 2)))
        assertEquals(listOf(1f, 1f, 1f), segmentFills(1f, listOf(1, 1, 2)))
    }

    @Test
    fun theBarFillsAsManyPartsAsStepsAreDoneWhileTheNextOneRuns() {
        val weights = listOf(10, 20, 5, 15)
        // The first step is done (10 of 50) and the second runs toward its end (30 of 50).
        val drifted = driftCeiling(share = 0.2f, target = 0.6f)

        assertEquals(1, segmentFills(drifted, weights).count { it == 1f })
        assertEquals(true, segmentFills(drifted, weights)[1] > 0f)
    }

    @Test
    fun aStepThatFinishesBeforeTheOneBesideItFillsItsOwnPart() {
        // A lesson's mark (10) and draw (45) run side by side, and draw finished first.
        val statuses = listOf(PhaseStatus.Completed, PhaseStatus.Completed, PhaseStatus.Active, PhaseStatus.Completed)
        val fills = phaseFills(share = 135f / 145f, weights = listOf(40, 50, 10, 45), statuses = statuses)

        assertEquals(listOf(1f, 1f, 0f, 1f), fills)
    }

    @Test
    fun aRunningStepFillsWhatTheBarDriftedPastTheDoneSteps() {
        val statuses = listOf(PhaseStatus.Completed, PhaseStatus.Active, PhaseStatus.Pending)
        val fills = phaseFills(share = 0.5f, weights = listOf(10, 20, 10), statuses = statuses)

        assertEquals(listOf(1f, 0.5f, 0f), fills)
    }

    @Test
    fun aShareOutsideTheBarStaysOnIt() {
        assertEquals(listOf(0f, 0f), segmentFills(-0.1f, listOf(1, 1)))
        assertEquals(listOf(1f, 1f), segmentFills(1.4f, listOf(1, 1)))
    }

    @Test
    fun aBarWithoutWeightStaysEmpty() {
        assertEquals(listOf(0f, 0f), segmentFills(0.5f, listOf(0, 0)))
        assertEquals(emptyList<Float>(), segmentFills(0.5f, emptyList()))
    }
}
