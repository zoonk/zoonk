package com.zoonk.android.feature.onboarding.setup

import com.zoonk.android.feature.plan.estimateNamesMonth
import com.zoonk.api.models.Plan
import kotlinx.datetime.toJavaLocalDate
import java.time.LocalDate
import java.time.temporal.ChronoUnit

internal data class RevealFacts(
    /** Days to the goal's date; null without one. */
    val days: Int?,
    val daysEstimated: Boolean,
    /** Without a date: when the plan ends at this pace. */
    val end: LocalDate?,
    /** The end is far off, so it reads as a month, never "October" in October. */
    val endAsMonth: Boolean,
)

internal fun Plan.revealFacts(today: LocalDate): RevealFacts {
    val targetDate = schedule.targetDate?.toJavaLocalDate()
    val end = estimate.endDate?.toJavaLocalDate().takeIf { targetDate == null }

    return RevealFacts(
        days =
            targetDate?.let {
                ChronoUnit.DAYS
                    .between(today, it)
                    .toInt()
                    .coerceAtLeast(0)
            },
        daysEstimated = schedule.targetDateEstimated,
        end = end,
        endAsMonth = end != null && estimateNamesMonth(end),
    )
}
