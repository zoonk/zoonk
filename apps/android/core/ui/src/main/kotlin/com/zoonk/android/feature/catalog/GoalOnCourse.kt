package com.zoonk.android.feature.catalog

import com.zoonk.api.models.LearnerSummary
import com.zoonk.api.models.LearnerSummaryGoal

fun LearnerSummary.goalOnCourse(courseId: String): LearnerSummaryGoal? =
    goals.firstOrNull { goal ->
        goal.courseId?.toString() == courseId &&
            goal.status == LearnerSummaryGoal.Status.ACTIVE &&
            goal.kind != LearnerSummaryGoal.Kind.EXPLAIN
    }
