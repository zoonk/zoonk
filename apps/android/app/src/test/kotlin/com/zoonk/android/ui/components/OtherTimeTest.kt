package com.zoonk.android.ui.components

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class OtherTimeTest {
    @Test
    fun theTimesListedKeepAPickedOrOfferedTimeOutsideTheUsualOnes() {
        assertEquals(listOf(15, 30, 45, 60, 70, 90, 120, 180, 240), timeChoices(70, null, 30))
        assertEquals(otherTimes(null), otherTimes(45))
        assertEquals(listOf(90, 100, 105), otherTimes(100).filter { it in 90..105 })
        assertEquals(1440, otherTimes(null).last())
    }
}
