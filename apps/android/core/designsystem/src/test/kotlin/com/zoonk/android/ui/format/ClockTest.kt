package com.zoonk.android.ui.format

import org.junit.Assert.assertEquals
import org.junit.Test
import java.util.Locale

class ClockTest {
    @Test
    fun theClockReadsAsMainWritesIt() {
        assertEquals("0:45", formatClock(45_000))
        assertEquals("0:10", formatClock(9_001))
        assertEquals("0:00", formatClock(0))
        assertEquals("1:02:05", formatClock(3_725_000))
    }

    @Test
    fun aDeviceInALanguageWithOtherDigitsStillGetsMainsDigits() {
        val device = Locale.getDefault()
        Locale.setDefault(Locale.forLanguageTag("fa-IR"))
        try {
            assertEquals("1:02:05", formatClock(3_725_000))
        } finally {
            Locale.setDefault(device)
        }
    }
}
