package com.zoonk.android.feature.session

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class SharedRowTest {
    @Test
    fun twoLabelsThatFitTogetherShareTheLineAndGrowEquallyFromTheirOwnWidths() {
        assertEquals(listOf(184, 136), sharedRowWidths(listOf(179, 131), gap = 8, minWidth = 328, maxWidth = 328))
    }

    @Test
    fun aRoomyBarKeepsEachButtonAtItsLabelsWidth() {
        assertEquals(listOf(179, 131), sharedRowWidths(listOf(179, 131), gap = 8, minWidth = 0, maxWidth = 600))
    }

    @Test
    fun labelsThatDontFitTogetherStack() {
        assertNull(sharedRowWidths(listOf(200, 200), gap = 8, minWidth = 328, maxWidth = 328))
    }
}
