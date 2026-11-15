package com.zoonk.android.feature.plan

import com.zoonk.api.models.Plan
import com.zoonk.api.models.PlanBase

/** Main's `useBasesAdviceStore`: what the prerequisites sheet's opening asked, for the plan revision it was asked of. */
data class BasesAdviceAsk(
    val revision: List<Any?>,
    val status: Status,
    val recommended: PlanBase.Choice? = null,
) {
    enum class Status { Pending, Answered, Unanswered }
}

/** The choice to mark Recommended on [plan]: none for any other plan or day than the one it was asked of. */
fun BasesAdviceAsk?.recommendedFor(plan: Plan): PlanBase.Choice? = this?.takeIf { it.revision == planAdviceRevision(plan) }?.recommended
