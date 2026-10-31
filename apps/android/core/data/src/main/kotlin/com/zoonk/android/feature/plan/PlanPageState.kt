package com.zoonk.android.feature.plan

import androidx.compose.runtime.Immutable
import com.zoonk.api.models.LearnerSummary
import com.zoonk.api.models.LearnerSummaryGoal
import com.zoonk.api.models.Plan
import java.time.LocalDate

@Immutable
data class PlanPageState(
    val goal: LearnerSummaryGoal,
    val plan: Plan,
    val summary: LearnerSummary,
) {
    val today: LocalDate = plan.today
    val isExam: Boolean get() = goal.kind == LearnerSummaryGoal.Kind.EXAM
    val isPaused: Boolean get() = goal.status == LearnerSummaryGoal.Status.PAUSED
    val mocksRequirePlus: Boolean get() = plan.access.mocksRequirePlus
    val finish: PlanFinish? = plan.finish(goal.kind)
    val libraryCourse get() = plan.course?.takeIf { it.planChapterCount > 0 && it.brandSlug != null }
}
