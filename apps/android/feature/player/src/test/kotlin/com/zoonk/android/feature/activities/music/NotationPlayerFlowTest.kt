package com.zoonk.android.feature.activities.music

import org.junit.Assert.assertEquals
import org.junit.Test

class NotationPlayerFlowTest {
    @Test
    fun slowerTemposArePracticeSteps() {
        assertEquals(listOf(50, 65, 80), practiceTempos(80))
        assertEquals(listOf(25, 30, 40), practiceTempos(40))
    }
}
