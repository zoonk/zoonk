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
}
