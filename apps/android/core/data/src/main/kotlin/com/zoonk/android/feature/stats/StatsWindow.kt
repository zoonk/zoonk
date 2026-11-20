package com.zoonk.android.feature.stats

import java.time.LocalDate
import java.time.temporal.ChronoUnit

/** The period a statistics chart names, such as "Score · 90 days", however few of its days have answers. */
data class StatsWindow(
    val start: LocalDate,
    val end: LocalDate,
) {
    val days: Long get() = ChronoUnit.DAYS.between(start, end)

    /** Where a date sits, 0 at the start and 1 at the end; core dates a week by its Monday, so a week that began before the window starts where the window starts. */
    fun position(date: LocalDate): Double = ChronoUnit.DAYS.between(start, maxOf(date, start)).toDouble() / days.coerceAtLeast(1)
}
