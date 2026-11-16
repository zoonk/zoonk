package com.zoonk.android.feature.stats

import androidx.compose.ui.unit.dp
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CalendarSizeTest {
    @Test fun aWideColumnShowsTheWholeYear() {
        val size = calendarSize(1100.dp, weeks = 53)
        assertEquals(53, size.weeks)
        assertFalse(size.recent)
    }

    @Test fun aPhoneShowsItsLast26WeeksAcrossTheColumn() {
        val size = calendarSize(379.dp, weeks = 53)
        assertEquals(26, size.weeks)
        assertTrue(size.recent)
        assertTrue(size.cell * 26 + 2.dp * 25 <= 379.dp)
    }

    /** Weeks spread apart on a tablet's narrower column would leave wider gaps between weeks than between days. */
    @Test fun aTabletsRecentWeeksFillItsColumnWithOneGap() {
        val size = calendarSize(650.dp, weeks = 53)
        assertEquals(26, size.weeks)
        val grid = size.cell * 26 + 2.dp * 25
        assertTrue(grid <= 650.dp && grid > 650.dp - 26.dp)
    }
}
