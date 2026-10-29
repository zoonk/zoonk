package com.zoonk.android.feature.plan

import com.zoonk.api.models.Plan
import com.zoonk.api.models.PlanTimeToCover

/**
 * Main's `getTimeToCoverRevision`: what the time found depends on. The plan's id is in it, since
 * another goal's plan can look the same and need another time; refreshes that change none of these
 * keep the answer.
 */
internal fun timeToCoverRevision(plan: Plan): List<Any?> =
    listOf(plan.planId, plan.schedule, plan.feasibility, plan.steering, plan.areas, plan.bases, plan.examChoices)

/** The search for the time that covers everything, for the plan revision it was asked of. */
sealed interface TimeToCoverState {
    data object Idle : TimeToCoverState

    data class Pending(
        val revision: List<Any?>,
    ) : TimeToCoverState

    /** The plan was still being built, or waits for what changes what it needs: the learner asks again. */
    data class Building(
        val revision: List<Any?>,
    ) : TimeToCoverState

    data class Failed(
        val revision: List<Any?>,
    ) : TimeToCoverState

    data class Answered(
        val revision: List<Any?>,
        val time: PlanTimeToCover,
    ) : TimeToCoverState
}

private val TimeToCoverState.revision: List<Any?>?
    get() =
        when (this) {
            TimeToCoverState.Idle -> null
            is TimeToCoverState.Pending -> revision
            is TimeToCoverState.Building -> revision
            is TimeToCoverState.Failed -> revision
            is TimeToCoverState.Answered -> revision
        }

/** Idle for any plan but the one it was asked of, so a re-planned page never shows a stale answer. */
internal fun TimeToCoverState.forPlan(plan: Plan): TimeToCoverState =
    takeIf { revision == timeToCoverRevision(plan) } ?: TimeToCoverState.Idle

/** What a search came to; [Stale] when the plan changed while it ran. */
sealed interface TimeToCoverOutcome {
    data class Answered(
        val time: PlanTimeToCover,
    ) : TimeToCoverOutcome

    data object Building : TimeToCoverOutcome

    data object Failed : TimeToCoverOutcome

    data object Stale : TimeToCoverOutcome
}

/** Main's `TimeToCoverAnswer`: a time that covers everything, or none (with the time every topic needs, when known). */
sealed interface TimeToCoverAnswer {
    data class Covers(
        val minutes: Int,
    ) : TimeToCoverAnswer

    data class None(
        val coreMinutes: Int?,
    ) : TimeToCoverAnswer
}

internal fun PlanTimeToCover.answer(): TimeToCoverAnswer =
    recommendedMinutes?.let { TimeToCoverAnswer.Covers(it.toInt()) } ?: TimeToCoverAnswer.None(coreMinutes?.toInt())

/** The time the answer offers among the time a day's chips. */
internal val TimeToCoverAnswer.offeredMinutes: Int?
    get() =
        when (this) {
            is TimeToCoverAnswer.Covers -> minutes
            is TimeToCoverAnswer.None -> coreMinutes
        }
