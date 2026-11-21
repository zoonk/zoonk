package com.zoonk.android.feature.goalcontent

import org.junit.Assert.assertEquals
import org.junit.Test

class WrittenTrendTest {
    @Test
    fun oneAnswerHasNoTrend() {
        assertEquals(emptyList<Float>(), writtenTrendBarShares(listOf(3.0)))
    }

    @Test
    fun twoAnswersAreScaledToTheHigherValue() {
        assertEquals(listOf(0.5f, 1f), writtenTrendBarShares(listOf(2.0, 4.0)))
    }
}
