package com.zoonk.android.feature.stats

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalDate

class StatsWindowTest {
    @Test fun sparseScoresStillSpanNinetyDays() {
        val today = LocalDate.of(2026, 10, 27)
        val window = StatsWindow.score(today)
        assertEquals(today.minusDays(89), window.start)
        assertEquals(today, window.end)
        assertEquals(82.0 / 89, window.position(today.minusDays(7)), 0.00001)
    }

    @Test fun anEmptyScoreStillHasTheNamedWindow() {
        val today = LocalDate.of(2026, 10, 27)
        assertEquals(today.minusDays(89), StatsWindow.score(today).start)
    }
}
