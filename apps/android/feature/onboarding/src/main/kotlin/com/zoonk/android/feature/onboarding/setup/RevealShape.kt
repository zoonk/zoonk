package com.zoonk.android.feature.onboarding.setup

import com.zoonk.android.feature.plan.PlanForecast
import com.zoonk.android.feature.plan.forecast
import com.zoonk.api.models.Plan
import kotlinx.datetime.toJavaLocalDate
import java.time.LocalDate
import java.time.temporal.ChronoUnit

internal data class RevealFacts(
    /** Days to the goal's date; null without one. */
    val days: Int?,
    val daysEstimated: Boolean,
    /** Without a date: when the plan ends at this pace. */
    val forecast: PlanForecast?,
)

internal fun Plan.revealFacts(today: LocalDate): RevealFacts =
    RevealFacts(
        days =
            schedule.targetDate?.toJavaLocalDate()?.let {
                ChronoUnit.DAYS
                    .between(today, it)
                    .toInt()
                    .coerceAtLeast(0)
            },
        daysEstimated = schedule.targetDateEstimated,
        forecast = forecast,
    )
