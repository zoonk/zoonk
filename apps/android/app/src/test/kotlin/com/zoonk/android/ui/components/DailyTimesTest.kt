package com.zoonk.android.ui.components

import org.junit.Assert.assertEquals
import org.junit.Test

class DailyTimesTest {
    @Test
    fun theTimesListedKeepAPickedOrOfferedTimeOutsideCoresList() {
        assertEquals(listOf(5, 30, 45), pickerTimes(listOf(5, 30, 45), 45))
        assertEquals(listOf(5, 30, 45, 100), pickerTimes(listOf(5, 30, 45), 100, null))
    }
}
