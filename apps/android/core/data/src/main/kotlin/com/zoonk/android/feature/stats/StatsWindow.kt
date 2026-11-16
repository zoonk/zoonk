package com.zoonk.android.feature.stats

import java.time.LocalDate
import java.time.temporal.ChronoUnit

data class StatsWindow(
    val start: LocalDate,
    val end: LocalDate,
) {
    fun position(date: LocalDate): Double =
        ChronoUnit.DAYS.between(start, date).toDouble() / ChronoUnit.DAYS.between(start, end).coerceAtLeast(1)

    companion object {
        fun score(today: LocalDate): StatsWindow = StatsWindow(today.minusDays(89), today)

        fun year(today: LocalDate): StatsWindow = StatsWindow(today.minusMonths(12).plusDays(1), today)
    }
}
