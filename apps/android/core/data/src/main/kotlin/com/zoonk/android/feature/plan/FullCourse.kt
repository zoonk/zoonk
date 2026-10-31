package com.zoonk.android.feature.plan

import androidx.compose.runtime.Immutable
import com.zoonk.api.models.LearnerSummaryGoal
import kotlinx.datetime.toJavaLocalDate
import java.time.LocalDate

/**
 * Main's `useFullCourse`: studying everything, an exam's past its date and another goal's without
 * one. [endDate] only for an exam, whose plan already knows it. A dated goal's plan practices until
 * its date, so its end without one is previewed when asked.
 */
@Immutable
data class FullCourse(
    val isExam: Boolean,
    val on: Boolean,
    val endDate: LocalDate?,
    val targetDate: LocalDate,
    val targetDateNamedMonth: Boolean,
) {
    fun operations(on: Boolean): List<PlanOp> = if (isExam) listOf(PlanOp.FullCourse(on)) else listOf(PlanOp.TargetDate(null))
}

/** Null when there's nothing to choose. */
fun fullCourse(page: PlanPageState): FullCourse? {
    val plan = page.plan
    val schedule = plan.schedule
    val target = schedule.targetDate ?: return null
    val fits = plan.feasibility?.fits ?: false
    if (page.goal.kind == LearnerSummaryGoal.Kind.EXPLAIN || (page.isExam && fits && !schedule.fullCourse)) return null
    val end = if (page.isExam) plan.estimate.fullCourseEndDate else null
    return FullCourse(page.isExam, schedule.fullCourse, end?.toJavaLocalDate(), target.toJavaLocalDate(), schedule.targetDateNamedMonth)
}
