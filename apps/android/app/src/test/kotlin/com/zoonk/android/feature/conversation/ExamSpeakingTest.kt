package com.zoonk.android.feature.conversation

import org.junit.Assert.assertEquals
import org.junit.Test

class ExamSpeakingTest {
    @Test
    fun anEstimatesMiddleAtTheLevelIsAtItAndItsTopAloneIsNear() {
        assertEquals(LevelStanding.At, levelStanding(bandLow = 2.0, bandHigh = 3.0, levelMark = 2.0))
        assertEquals(LevelStanding.At, levelStanding(bandLow = 1.5, bandHigh = 2.5, levelMark = 2.0))
        assertEquals(LevelStanding.Near, levelStanding(bandLow = 1.0, bandHigh = 2.0, levelMark = 2.0))
        assertEquals(LevelStanding.Below, levelStanding(bandLow = 1.0, bandHigh = 1.5, levelMark = 2.0))
    }
}
