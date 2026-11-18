package com.zoonk.android.feature.onboarding.setup

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class BesideStartWidthTest {
    @Test
    fun aShortLabelKeepsItsWidthBesideConfirm() {
        assertEquals(150, besideStartWidth(label = 150, longestWord = 90, width = 400, gap = 8, endMin = 160))
    }

    @Test
    fun aLongLabelWrapsBesideConfirmRatherThanMovingConfirmAbove() {
        assertEquals(232, besideStartWidth(label = 300, longestWord = 120, width = 400, gap = 8, endMin = 160))
    }

    @Test
    fun aWordWiderThanTheRoomLeftStacksTheButtons() {
        assertNull(besideStartWidth(label = 300, longestWord = 260, width = 400, gap = 8, endMin = 160))
    }
}
