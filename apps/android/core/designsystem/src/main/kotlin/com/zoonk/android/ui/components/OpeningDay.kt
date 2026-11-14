package com.zoonk.android.ui.components

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/** The day the next free lesson opens, in the learner's own calendar (main's `toOpeningDay`). */
sealed interface OpeningDay {
    data object Today : OpeningDay

    data object Tomorrow : OpeningDay

    data class On(
        val date: LocalDate,
    ) : OpeningDay
}

/** An instant already past opens "today": the lesson is there to start. */
fun openingDay(
    at: Instant,
    now: Instant = Instant.now(),
    zone: ZoneId = ZoneId.systemDefault(),
): OpeningDay {
    val day = at.atZone(zone).toLocalDate()
    val today = now.atZone(zone).toLocalDate()
    return when {
        !day.isAfter(today) -> OpeningDay.Today
        day == today.plusDays(1) -> OpeningDay.Tomorrow
        else -> OpeningDay.On(day)
    }
}
