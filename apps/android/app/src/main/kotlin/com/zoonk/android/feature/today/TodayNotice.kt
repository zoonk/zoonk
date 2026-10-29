package com.zoonk.android.feature.today

import com.zoonk.android.feature.session.DayView
import com.zoonk.api.models.ExamMoment
import com.zoonk.api.models.MemoryInsight
import com.zoonk.api.models.MemoryInsightPlanChange
import com.zoonk.api.models.PlanChange
import com.zoonk.api.models.Today

enum class TodayNoticeKind { Exam, ExamAccess, ExamChoice, Insight, PlanChange, Practice, SourceChange, SuggestedGoal, UploadRequest }

/** Whether other lanes' notices have something to say: the language practice row, a source change, an upload request. */
data class HostNotices(
    val practice: Boolean = false,
    val sourceChange: Boolean = false,
    val uploadRequest: Boolean = false,
)

/**
 * One notice at most, the most pressing first. A free exam plan's ended week goes before anything
 * that asks more of the plan, and a fresh start is the session's own words, never a notice.
 */
fun pickTodayNotice(
    today: Today,
    day: DayView,
    host: HostNotices,
): TodayNoticeKind? {
    val exam = today.exam
    val insight = today.insight
    val insightChange = insight?.takeIf { it.kind == MemoryInsight.Kind.PLAN_CHANGE }?.planChange?.status
    val planChange = today.planChangeStatus()

    val candidates =
        listOf(
            TodayNoticeKind.Exam to exam.isExamDay(),
            TodayNoticeKind.ExamAccess to day.examAccess.trialEnded,
            TodayNoticeKind.PlanChange to (planChange == PlanChange.Status.PROPOSED),
            TodayNoticeKind.Insight to (insightChange == MemoryInsightPlanChange.Status.PROPOSED),
            TodayNoticeKind.SourceChange to host.sourceChange,
            TodayNoticeKind.Exam to (exam?.stage == ExamMoment.Stage.FINAL_STRETCH),
            TodayNoticeKind.UploadRequest to host.uploadRequest,
            TodayNoticeKind.ExamChoice to (today.examChoice != null),
            TodayNoticeKind.PlanChange to (planChange == PlanChange.Status.APPLIED),
            TodayNoticeKind.Insight to (insight != null),
            TodayNoticeKind.Practice to host.practice,
            TodayNoticeKind.SuggestedGoal to (today.suggestedGoal != null && !day.showsFreshStart(today.studiedToday)),
        )

    return candidates.firstOrNull { (_, available) -> available }?.first
}

private fun ExamMoment?.isExamDay(): Boolean =
    when (this?.stage) {
        ExamMoment.Stage.AFTER_EXAM -> !resultReported
        ExamMoment.Stage.DAY_BEFORE, ExamMoment.Stage.EXAM_DAY -> true
        else -> false
    }

/** The insight's own change is answered on the insight; one the learner fell behind for asks again. */
private fun Today.planChangeStatus(): PlanChange.Status? {
    val change = planChange ?: return null
    if (insight?.planChange?.id == change.id) return null
    return if (change.behind != null) PlanChange.Status.PROPOSED else change.status
}
