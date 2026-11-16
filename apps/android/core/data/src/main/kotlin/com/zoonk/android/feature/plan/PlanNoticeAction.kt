package com.zoonk.android.feature.plan

import com.zoonk.android.R

enum class PlanNoticeAction(
    val label: Int,
) {
    Retry(R.string.load_failed_try_again),
    Undo(R.string.plan_undo),
}

/** A change whose undo didn't save offers to try again, never Undo beside "Couldn't undo". */
fun planNoticeActions(
    failed: Boolean,
    canUndo: Boolean,
): List<PlanNoticeAction> =
    when {
        failed -> listOf(PlanNoticeAction.Retry)
        canUndo -> listOf(PlanNoticeAction.Undo)
        else -> emptyList()
    }
