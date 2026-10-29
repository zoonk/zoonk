package com.zoonk.android.feature.questions

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class DrillsTest {
    @Test
    fun theClockReadsAsMainWritesIt() {
        assertEquals("0:45", formatClock(45_000))
        assertEquals("0:10", formatClock(9_001))
        assertEquals("0:00", formatClock(0))
        assertEquals("1:02:05", formatClock(3_725_000))
    }

    @Test
    fun onlyTenFiveAndTheFirstWarningSecondAreReadAloud() {
        assertNull(announcedSeconds(null, 30))
        assertEquals(10, announcedSeconds(null, 10))
        assertEquals(10, announcedSeconds(10, 7))
        assertEquals(5, announcedSeconds(10, 5))
        assertEquals(5, announcedSeconds(5, 2))
        assertEquals(8, announcedSeconds(null, 8))
    }
}
