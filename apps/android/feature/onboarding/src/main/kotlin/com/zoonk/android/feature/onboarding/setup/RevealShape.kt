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
    /** The schedule picker already showed the estimate for a finish beyond the horizon. */
    val forecast: PlanForecast.On?,
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
        forecast = forecast as? PlanForecast.On,
    )
