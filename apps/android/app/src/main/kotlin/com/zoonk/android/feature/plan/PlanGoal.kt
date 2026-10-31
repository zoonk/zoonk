package com.zoonk.android.feature.plan

import com.zoonk.api.models.LearnerSummary
import com.zoonk.api.models.LearnerSummaryGoal

/** The goal the Plan and its pages show: the active one. A quick explanation has no plan, as on main. */
val LearnerSummary.planGoal: LearnerSummaryGoal?
    get() = goals.firstOrNull { it.isActive }?.takeUnless { it.kind == LearnerSummaryGoal.Kind.EXPLAIN }
