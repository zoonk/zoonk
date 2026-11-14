package com.zoonk.android.feature.plan

import android.icu.text.DateFormat
import android.icu.util.TimeZone
import android.icu.util.ULocale
import com.zoonk.api.models.Plan
import com.zoonk.api.models.PlanDay
import kotlinx.datetime.toJavaLocalDate
import java.time.LocalDate
import java.util.Date
import java.util.Locale

/** Main's `isInAnotherYear`: a date outside today's calendar year names its year, so it never reads as this year's. */
fun isInAnotherYear(
    date: LocalDate,
    today: LocalDate,
): Boolean = date.year != today.year

/**
 * A day in the plan as main's `formatPlanDate` writes it: "Nov 3", with the year when it's in another
 * year; [month] for a date standing for its month ("Nov"), [weekday] for an exam's day ("Sat, Nov 8").
 */
fun formatPlanDate(
    date: LocalDate,
    today: LocalDate,
    locale: Locale,
    month: Boolean = false,
    weekday: Boolean = false,
): String {
    val year = if (isInAnotherYear(date, today)) "y" else ""
    val day = if (month) "MMM" else "MMMd"
    return formatDay(date, year + (if (weekday) "EEE" else "") + day, locale)
}

/** A calendar day carries no time zone, so it's formatted as a UTC instant in UTC. */
fun formatDay(
    date: LocalDate,
    skeleton: String,
    locale: Locale,
): String =
    DateFormat
        .getInstanceForSkeleton(skeleton, ULocale.forLocale(locale))
        .apply { timeZone = TimeZone.GMT_ZONE }
        .format(Date(date.toEpochDay() * MILLIS_PER_DAY))

private const val MILLIS_PER_DAY = 86_400_000L

val Plan.today: LocalDate
    get() = (week.days.firstOrNull { it.state == PlanDay.State.TODAY }?.date ?: week.startDate).toJavaLocalDate()
