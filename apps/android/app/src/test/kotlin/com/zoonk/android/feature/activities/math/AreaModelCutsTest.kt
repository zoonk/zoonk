package com.zoonk.android.feature.activities.math

import org.junit.Assert.assertEquals
import org.junit.Test

/** Expected values are what main's `area-model-cuts.ts` returns for the same input. */
class AreaModelCutsTest {
    private fun side(
        cuts: List<Double>,
        total: Double,
    ) = SideCuts(cuts, step = 1.0, total = total)

    @Test
    fun splitLinesSitAtTheRunningTotals() {
        assertEquals(listOf(20.0), partsToCuts(listOf(20.0, 3.0)))
        assertEquals(listOf(10.0, 20.0), partsToCuts(listOf(10.0, 10.0, 4.0)))
        assertEquals(emptyList<Double>(), partsToCuts(listOf(14.0)))
    }

    @Test
    fun partsReadBackWithoutFloatNoise() {
        assertEquals(listOf(20.0, 3.0), cutsToParts(listOf(20.0), 23.0))
        assertEquals(listOf(0.1, 0.2, 0.3), cutsToParts(listOf(0.1, 0.3), 0.6))
    }

    @Test
    fun theStepIsTheRoundestThatReachesEveryPart() {
        assertEquals(1.0, splitStep(listOf(20.0, 3.0)), 0.0)
        assertEquals(0.5, splitStep(listOf(2.5, 1.0)), 0.0)
        assertEquals(0.1, splitStep(listOf(0.2, 0.1)), 0.0)
    }

    @Test
    fun aMovedSplitSnapsAndKeepsEveryPartAStepWide() {
        assertEquals(listOf(18.0), moveCut(side(listOf(20.0), 23.0), 0, 17.6))
        assertEquals(listOf(19.0, 20.0), moveCut(side(listOf(10.0, 20.0), 23.0), 0, 25.0))
        assertEquals(listOf(10.0, 22.0), moveCut(side(listOf(10.0, 20.0), 23.0), 1, 30.0))
        assertEquals(listOf(1.0), moveCut(side(listOf(5.0), 23.0), 0, -4.0))
    }

    @Test
    fun aGridMultipliesEveryRowByEveryColumn() {
        assertEquals(listOf(200.0, 30.0, 80.0, 12.0), pieces(listOf(listOf(20.0, 3.0), listOf(10.0, 4.0))))
        assertEquals(listOf(20.0, 3.0), pieces(listOf(listOf(20.0, 3.0))))
    }
}
