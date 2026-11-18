package com.zoonk.android.ui.components

import com.zoonk.android.data.PhaseStatus
import com.zoonk.android.data.PhaseStatus.Active
import com.zoonk.android.data.PhaseStatus.Completed
import com.zoonk.android.data.PhaseStatus.Pending
import org.junit.Assert.assertEquals
import org.junit.Test

class GenerationWaitTest {
    @Test
    fun theBarFillsAsManyPartsAsStepsAreDoneWhileTheNextOneRuns() {
        // The first step is done (10 of 50) and the second runs toward its end (30 of 50).
        val fills =
            phaseFills(driftCeiling(share = 0.2f, target = 0.6f), listOf(10, 20, 5, 15), listOf(Completed, Active, Pending, Pending))

        assertEquals(1, fills.count { it == 1f })
        assertEquals(true, fills[1] > 0f)
    }

    @Test
    fun aStepThatFinishesBeforeTheOneBesideItFillsItsOwnPart() {
        // A lesson's mark (10) and draw (45) run side by side, and draw finished first.
        val fills =
            phaseFills(share = 135f / 145f, weights = listOf(40, 50, 10, 45), statuses = listOf(Completed, Completed, Active, Completed))

        assertEquals(listOf(1f, 1f, 0f, 1f), fills)
    }

    @Test
    fun aRunningStepFillsWhatTheBarDriftedPastTheDoneSteps() {
        assertEquals(
            listOf(1f, 0.5f, 0f),
            phaseFills(share = 0.5f, weights = listOf(10, 20, 10), statuses = listOf(Completed, Active, Pending)),
        )
    }

    @Test
    fun aStartedBarWithNoStepReportedFillsItsFirstPart() {
        // A run that failed, or hasn't reported, before its first step still shows the started share it labels.
        assertEquals(listOf(0.4f, 0f, 0f), phaseFills(share = 0.1f, weights = listOf(10, 20, 10), statuses = listOf(Pending, Pending, Pending)))
    }

    @Test
    fun aShareOutsideTheBarStaysOnIt() {
        assertEquals(listOf(0f, 0f), phaseFills(-0.1f, listOf(1, 1), listOf(Active, Pending)))
        assertEquals(listOf(1f, 1f), phaseFills(1.4f, listOf(1, 1), listOf(Completed, Active)))
    }

    @Test
    fun aBarWithoutWeightStaysEmpty() {
        assertEquals(listOf(0f, 0f), phaseFills(0.5f, listOf(0, 0), listOf(Active, Pending)))
        assertEquals(emptyList<Float>(), phaseFills(0.5f, emptyList(), emptyList<PhaseStatus>()))
    }
}
