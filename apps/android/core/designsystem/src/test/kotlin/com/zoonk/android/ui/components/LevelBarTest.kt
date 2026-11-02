package com.zoonk.android.ui.components

import org.junit.Assert.assertEquals
import org.junit.Test

class LevelBarTest {
    @Test
    fun aPlainLevelSitsInTheMiddleOfItsBandAndAPlusAtItsEnd() {
        assertEquals(0.5 / 6, levelShare(0.0), DELTA)
        assertEquals(2.5 / 6, levelShare(2.0), DELTA)
        assertEquals(3.0 / 6, levelShare(2.5), DELTA)
    }

    @Test
    fun theShareStaysOnTheBar() {
        assertEquals(1.0, levelShare(5.0), DELTA)
        assertEquals(0.0, levelShare(-1.0), DELTA)
    }

    @Test
    fun theBandsBelowTheLevelFillAndItsOwnPartly() {
        assertEquals(listOf(1f, 1f, 0.5f, 0f), (0..3).map { bandFill(it, score = 2.0) })
    }

    private companion object {
        const val DELTA = 1e-9
    }
}
