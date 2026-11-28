package com.zoonk.android.feature.plan

import com.zoonk.api.models.Plan
import com.zoonk.api.models.PlanChangePreview
import com.zoonk.api.models.PlanFinishPrecision
import com.zoonk.api.models.PlanFinishReason
import com.zoonk.api.models.PlanTimeAdvice
import kotlinx.datetime.toJavaLocalDate
import java.time.LocalDate

/** When an undated plan finishes, as core forecasts it: a month or, further off, a year; or past the ten years a plan lays out. */
sealed interface PlanForecast {
    data class On(
        val date: LocalDate,
        val year: Boolean,
    ) : PlanForecast

    data object Beyond : PlanForecast
}

private fun forecast(
    date: kotlinx.datetime.LocalDate?,
    precision: PlanFinishPrecision?,
    reason: PlanFinishReason?,
): PlanForecast? =
    when {
        date != null -> PlanForecast.On(date.toJavaLocalDate(), year = precision == PlanFinishPrecision.YEAR)
        reason == PlanFinishReason.BEYOND_HORIZON -> PlanForecast.Beyond
        else -> null
    }

/** Null for a dated plan, whose end is its date. */
val Plan.forecast: PlanForecast?
    get() = if (schedule.targetDate != null) null else forecast(estimate.endDate, estimate.precision, estimate.finishReason)

val PlanTimeAdvice.forecast: PlanForecast? get() = forecast(endDate, precision, finishReason)

val PlanChangePreview.forecast: PlanForecast? get() = forecast(finishDate, precision, finishReason)
