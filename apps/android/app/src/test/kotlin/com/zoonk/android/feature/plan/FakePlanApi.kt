package com.zoonk.android.feature.plan

import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.api.models.GoalUpdateInput
import com.zoonk.api.models.OnboardingStep
import com.zoonk.api.models.Plan
import com.zoonk.api.models.PlanBasesAdvice
import com.zoonk.api.models.PlanChange
import com.zoonk.api.models.PlanChangeDecisionInput
import com.zoonk.api.models.PlanChangePreview
import com.zoonk.api.models.PlanChangeResult
import com.zoonk.api.models.PlanTimeToCover
import kotlinx.coroutines.CompletableDeferred
import java.util.UUID
import kotlin.time.Instant

internal class FakePlanApi : PlanApi {
    var plans = 0
    var changed = false
    var statusFailure: ApiException? = null
    val statuses = mutableListOf<GoalUpdateInput.Status>()
    val askedSince = mutableListOf<Instant>()
    var changeFailure: ApiException? = null
    var planFailure: ApiException? = null

    /** Holds a change asking for one of these operations until its gate opens. */
    val gates = mutableMapOf<PlanOp, CompletableDeferred<Unit>>()
    var createdAt: (List<PlanOp>) -> String = { "2026-10-28T12:00:00Z" }
    var changeId: (List<PlanOp>) -> String = { CHANGE_ID }

    /** Holds every plan read until it opens. */
    var planGate: CompletableDeferred<Unit>? = null
    val changes = mutableListOf<List<PlanOp>>()
    val decisions = mutableListOf<PlanChangeDecisionInput.Status>()
    var shownPlan: Plan = plan()
    var timeToCover: PlanTimeToCover = timeToCover()
    var timeToCoverGate: CompletableDeferred<Unit>? = null
    var timeToCoverFailure: ApiException? = null
    var timeToCoverRequests = 0
    val previews = mutableListOf<List<PlanOp>>()
    var previewGate: CompletableDeferred<Unit>? = null
    var preview = PlanChangePreview(effect = null, feasibility = null, ready = true, unchanged = true)

    val examChoices = mutableListOf<Pair<String, String>>()
    var advice = PlanBasesAdvice(daysLeft = 40, ready = true, recommended = PlanBasesAdvice.Recommended.ESSENTIAL)
    var advised = 0

    override suspend fun plan(
        session: AuthenticatedSession,
        goalId: UUID,
    ): Plan {
        planGate?.await()
        planFailure?.let { throw it }
        plans++
        return shownPlan
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
        operations.firstNotNullOfOrNull { gates[it] }?.await()
        changeFailure?.let { throw it }
        changes += operations
        return PlanChangeResult(
            change = planChange(createdAt = createdAt(operations), id = changeId(operations)),
            status = PlanChangeResult.Status.APPLIED,
        )
    }

    override suspend fun preview(
        session: AuthenticatedSession,
        goalId: UUID,
        operations: List<PlanOp>,
    ): PlanChangePreview {
        previews += operations
        previewGate?.await()
        return preview
    }

    override suspend fun decide(
        session: AuthenticatedSession,
        goalId: UUID,
        changeId: UUID,
        status: PlanChangeDecisionInput.Status,
    ): PlanChange {
        decisions += status
        return planChange(status = status.value)
    }

    override suspend fun timeToCover(
        session: AuthenticatedSession,
        goalId: UUID,
    ): PlanTimeToCover {
        timeToCoverRequests++
        timeToCoverGate?.await()
        timeToCoverFailure?.let { throw it }
        return timeToCover
    }

    override suspend fun chooseExamOption(
        session: AuthenticatedSession,
        goalId: UUID,
        group: String,
        subject: String,
    ): PlanChangeResult {
        examChoices += group to subject
        return PlanChangeResult(change = planChange(), status = PlanChangeResult.Status.APPLIED)
    }

    override suspend fun basesAdvice(
        session: AuthenticatedSession,
        goalId: UUID,
    ): PlanBasesAdvice {
        advised++
        return advice
    }
}
