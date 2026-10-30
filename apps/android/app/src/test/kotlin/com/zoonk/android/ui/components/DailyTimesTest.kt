package com.zoonk.android.ui.components

import org.junit.Assert.assertEquals
import org.junit.Test

class DailyTimesTest {
    @Test
    fun theTimesListedKeepAPickedOrOfferedTimeOutsideTheUsualOnes() {
        assertEquals(listOf(15, 30, 45, 60, 70, 90, 120, 180, 240), timeChoices(70, null, 30))
        assertEquals(listOf(5, 30, 45), pickerTimes(listOf(5, 30, 45), 45))
        assertEquals(listOf(5, 30, 45, 100), pickerTimes(listOf(5, 30, 45), 100, null))
    }
}
