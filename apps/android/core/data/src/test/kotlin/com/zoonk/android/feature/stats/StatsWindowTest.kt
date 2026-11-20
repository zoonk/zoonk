package com.zoonk.android.feature.stats

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalDate

class StatsWindowTest {
    private val window = StatsWindow(LocalDate.of(2026, 8, 23), LocalDate.of(2026, 11, 20))

    @Test fun aDateSitsByItsDaysFromTheStart() {
        assertEquals(82.0 / 89, window.position(LocalDate.of(2026, 11, 13)), 0.00001)
        assertEquals(1.0, window.position(window.end), 0.00001)
    }

    /** Core groups answers under their week's Monday, which can come before the window's first day. */
    @Test fun aWeekThatBeganBeforeTheWindowStartsAtItsStart() {
        assertEquals(0.0, window.position(LocalDate.of(2026, 8, 17)), 0.00001)
    }
}
