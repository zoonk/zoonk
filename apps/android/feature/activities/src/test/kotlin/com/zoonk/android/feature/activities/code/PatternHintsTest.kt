package com.zoonk.android.feature.activities.code

import org.junit.Assert.assertEquals
import org.junit.Test

class PatternHintsTest {
    @Test
    fun aCorrectCheckedPatternKeepsTheHintsItShowed() {
        assertEquals(2, patternHintCount(3, 2, checked = true, correct = true))
    }

    @Test
    fun aWrongCheckedPatternShowsAllHints() {
        assertEquals(3, patternHintCount(3, 0, checked = true, correct = false))
    }

    @Test
    fun answeringShowsOnlyRequestedHints() {
        assertEquals(0, patternHintCount(3, 0, checked = false, correct = null))
        assertEquals(2, patternHintCount(3, 2, checked = false, correct = null))
    }
}
