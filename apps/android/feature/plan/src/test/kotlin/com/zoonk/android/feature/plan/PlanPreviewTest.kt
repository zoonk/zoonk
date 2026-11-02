package com.zoonk.android.feature.plan

import com.zoonk.api.models.PlanChangePreview
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

class PlanPreviewTest {
    private val operations = listOf<PlanOp>(PlanOp.DailyMinutes(60))
    private val request = PlanPreviewState.Loading(operations, plan())
    private val unchanged = PlanChangePreview(effect = null, feasibility = null, ready = true, unchanged = true)

    @Test
    fun aValidUnchangedResultIsntAFailure() {
        assertTrue(request.resolve(request, unchanged) is PlanPreviewState.Ready)
        assertTrue(request.resolve(request, null) is PlanPreviewState.Failed)
        assertTrue(request.resolve(request, unchanged.copy(ready = false)) is PlanPreviewState.Failed)
        assertTrue(request.resolve(request, unchanged.copy(unchanged = false)) is PlanPreviewState.Failed)
    }

    @Test
    fun itNeedsBothThePreviewedOperationsAndTheSamePlan() {
        val ready = request.resolve(request, unchanged)

        assertSame(ready, ready.of(listOf(PlanOp.DailyMinutes(60)), plan()))
        assertSame(PlanPreviewState.Idle, ready.of(listOf(PlanOp.DailyMinutes(90)), plan()))
        assertSame(PlanPreviewState.Idle, ready.of(operations, coveragePlan()))
    }

    @Test
    fun aLateAnswerAfterCancellingOrAskingAgainIsDropped() {
        val newer = PlanPreviewState.Loading(operations, plan())

        assertSame(PlanPreviewState.Idle, PlanPreviewState.Idle.resolve(request, unchanged))
        assertSame(newer, newer.resolve(request, unchanged))
    }
}
