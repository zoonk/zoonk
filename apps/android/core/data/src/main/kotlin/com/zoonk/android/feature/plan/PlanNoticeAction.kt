package com.zoonk.android.feature.plan

import com.zoonk.android.R

enum class PlanNoticeAction(
    val label: Int,
) {
    KeepStudying(R.string.plan_keep_studying),
    ArchiveGoal(R.string.plan_archive_goal_short),
    View(R.string.suggestion_view),
    Retry(R.string.load_failed_try_again),
    Undo(R.string.today_undo),
}

fun planNoticeActions(
    examDatePassed: Boolean,
    failed: Boolean,
    canUndo: Boolean,
): List<PlanNoticeAction> =
    when {
        failed -> listOf(PlanNoticeAction.Retry)
        canUndo -> listOf(PlanNoticeAction.Undo)
        examDatePassed -> listOf(PlanNoticeAction.KeepStudying, PlanNoticeAction.ArchiveGoal)
        else -> listOf(PlanNoticeAction.View)
    }
