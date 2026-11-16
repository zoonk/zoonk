package com.zoonk.android.feature.stats

import java.time.LocalDate
import java.time.temporal.ChronoUnit

data class StatsWindow(
    val start: LocalDate,
    val end: LocalDate,
) {
    val days: Long get() = ChronoUnit.DAYS.between(start, end)

    fun position(date: LocalDate): Double = ChronoUnit.DAYS.between(start, date).toDouble() / days.coerceAtLeast(1)

    companion object {
        /** The 90 days ending today that "Score · 90 days" names, however few weeks have answers. */
        fun score(today: LocalDate): StatsWindow = StatsWindow(today.minusDays(89), today)
    }
}
