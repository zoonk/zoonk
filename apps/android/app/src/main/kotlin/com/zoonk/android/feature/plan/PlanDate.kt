package com.zoonk.android.feature.plan

import android.icu.text.DateFormat
import android.icu.util.TimeZone
import android.icu.util.ULocale
import com.zoonk.api.models.Plan
import com.zoonk.api.models.PlanDay
import kotlinx.datetime.toJavaLocalDate
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import java.util.Date
import java.util.Locale
import kotlin.math.abs

/**
 * A day in the plan as main's `PlanDateText` writes it: "Nov 3", with the year only more than a
 * year away; [month] for a date standing for its month ("Nov").
 */
fun formatPlanDate(
    date: LocalDate,
    today: LocalDate,
    locale: Locale,
    month: Boolean = false,
): String {
    val near = abs(ChronoUnit.DAYS.between(today, date)) <= YEAR_AWAY_DAYS
    val skeleton =
        when {
            month && near -> "MMM"
            month -> "yMMM"
            near -> "MMMd"
            else -> "yMMMd"
        }
    return formatDay(date, skeleton, locale)
}

/** A calendar day carries no time zone, so it's formatted as a UTC instant in UTC. */
internal fun formatDay(
    date: LocalDate,
    skeleton: String,
    locale: Locale,
): String =
    DateFormat
        .getInstanceForSkeleton(skeleton, ULocale.forLocale(locale))
        .apply { timeZone = TimeZone.GMT_ZONE }
        .format(Date(date.toEpochDay() * MILLIS_PER_DAY))

private const val YEAR_AWAY_DAYS = 365
private const val MILLIS_PER_DAY = 86_400_000L

val Plan.today: LocalDate
    get() = (week.days.firstOrNull { it.state == PlanDay.State.TODAY }?.date ?: week.startDate).toJavaLocalDate()
