package com.zoonk.android.feature.stats

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalDate

class MonthLabelWeeksTest {
    private fun weeksFrom(
        first: LocalDate,
        count: Int,
    ) = (0 until count).map { week -> (0 until 7).map { first.plusDays(week * 7L + it) } }

    @Test fun theFirstWeeksOfAMonthStartedEarlierAreNamedForIt() {
        // 26 weeks from Sunday, April 26: May starts in the first week, so April's few days stay unnamed.
        val fromLateApril = monthLabelWeeks(weeksFrom(LocalDate.of(2026, 4, 26), 26))
        assertEquals(0 to LocalDate.of(2026, 5, 1), fromLateApril.first())

        // 26 weeks from Sunday, May 3: May's first four weeks fall under "May" before June starts.
        val fromEarlyMay = monthLabelWeeks(weeksFrom(LocalDate.of(2026, 5, 3), 26))
        assertEquals(listOf(0 to LocalDate.of(2026, 5, 3), 4 to LocalDate.of(2026, 6, 1)), fromEarlyMay.take(2))
    }

    @Test fun aMonthStartedTooCloseToTheNextOneKeepsOnlyTheNextName() {
        val weeks = monthLabelWeeks(weeksFrom(LocalDate.of(2026, 5, 17), 26))
        assertEquals(2 to LocalDate.of(2026, 6, 1), weeks.first())
    }
}
