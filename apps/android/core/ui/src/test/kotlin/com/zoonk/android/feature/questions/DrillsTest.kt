package com.zoonk.android.feature.questions

import org.junit.Assert.assertEquals
import org.junit.Test

class DrillsTest {
    @Test
    fun theClockReadsAsMainWritesIt() {
        assertEquals("0:45", formatClock(45_000))
        assertEquals("0:10", formatClock(9_001))
        assertEquals("0:00", formatClock(0))
        assertEquals("1:02:05", formatClock(3_725_000))
    }
}
