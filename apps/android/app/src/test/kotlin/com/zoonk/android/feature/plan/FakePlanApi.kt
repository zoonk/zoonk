package com.zoonk.android.feature.plan

import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.api.models.GoalUpdateInput
import com.zoonk.api.models.OnboardingStep
import com.zoonk.api.models.Plan
import com.zoonk.api.models.PlanChange
import com.zoonk.api.models.PlanChangeDecisionInput
import com.zoonk.api.models.PlanChangePreview
import com.zoonk.api.models.PlanChangeResult
import java.util.UUID
import kotlin.time.Instant

internal class FakePlanApi : PlanApi {
    var plans = 0
    var changed = false
    var statusFailure: ApiException? = null
    val statuses = mutableListOf<GoalUpdateInput.Status>()
    val askedSince = mutableListOf<Instant>()
    var changeFailure: ApiException? = null
    val changes = mutableListOf<List<PlanOp>>()
    val decisions = mutableListOf<PlanChangeDecisionInput.Status>()

    override suspend fun plan(
        session: AuthenticatedSession,
        goalId: UUID,
    ): Plan {
        plans++
        return plan()
    }

    override suspend fun planChanged(
        session: AuthenticatedSession,
        goalId: UUID,
        since: Instant,
    ): Boolean {
        askedSince += since
        return changed
    }

    override suspend fun syllabus(
        session: AuthenticatedSession,
        goalId: UUID,
    ) = syllabus()

    override suspend fun progress(
        session: AuthenticatedSession,
        goalId: UUID,
    ) = progress()

    override suspend fun resumeChangesPlan(
        session: AuthenticatedSession,
        goalId: UUID,
    ) = false

    override suspend fun setup(
        session: AuthenticatedSession,
        goalId: UUID,
    ) = GoalSetup(listOf(OnboardingStep.PLAN), courseStart = false)

    override suspend fun buildingRunId(
        session: AuthenticatedSession,
        goalId: UUID,
    ): String? = null

    override suspend fun rebuild(
        session: AuthenticatedSession,
        goalId: UUID,
    ) = "run"

    override suspend fun setStatus(
        session: AuthenticatedSession,
        goalId: UUID,
        status: GoalUpdateInput.Status,
    ) {
        statusFailure?.let { throw it }
        statuses += status
    }

    override suspend fun change(
        session: AuthenticatedSession,
        goalId: UUID,
        operations: List<PlanOp>,
    ): PlanChangeResult {
        changeFailure?.let { throw it }
        changes += operations
        return PlanChangeResult(change = planChange(), status = PlanChangeResult.Status.APPLIED)
    }

    override suspend fun preview(
        session: AuthenticatedSession,
        goalId: UUID,
        operations: List<PlanOp>,
    ) = PlanChangePreview(effect = null, feasibility = null, ready = true, unchanged = true)

    override suspend fun decide(
        session: AuthenticatedSession,
        goalId: UUID,
        changeId: UUID,
        status: PlanChangeDecisionInput.Status,
    ): PlanChange {
        decisions += status
        return planChange(status = status.value)
    }
}
