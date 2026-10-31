package com.zoonk.android.feature.activities.math

import androidx.compose.ui.geometry.Offset
import org.junit.Assert.assertEquals
import org.junit.Test

/** Expected values are what main's `number-line-geometry.ts` returns for the same input. */
class NumberLineGeometryTest {
    private fun assertNear(
        expected: Offset,
        actual: Offset,
    ) {
        assertEquals(expected.x, actual.x, 0.01f)
        assertEquals(expected.y, actual.y, 0.01f)
    }

    @Test
    fun arcsAboveTheLineHigherForLongerJumps() {
        val short = jumpArc(baseline = 100f, from = 40f, to = 80f)
        val long = jumpArc(baseline = 100f, from = 40f, to = 200f)

        assertNear(Offset(60f, 64f), short.control)
        assertNear(Offset(60f, 75f), short.label)
        assertNear(Offset(120f, -28f), long.control)
        assertNear(Offset(120f, 29f), long.label)
    }

    @Test
    fun theArrowheadPointsBackAlongTheArc() {
        val rightward = jumpArc(baseline = 100f, from = 40f, to = 80f)
        val leftward = jumpArc(baseline = 100f, from = 100f, to = 0f)

        assertNear(Offset(74f, 96.4f), rightward.wings.first)
        assertNear(Offset(80.12f, 93f), rightward.wings.second)
        assertNear(Offset(50f, 10f), leftward.control)
        assertNear(Offset(-0.12f, 93f), leftward.wings.first)
        assertNear(Offset(6f, 96.4f), leftward.wings.second)
    }

    @Test
    fun listsTheStartAndWhereEachJumpLands() {
        assertEquals(listOf(-3.0, 0.0, 5.0), jumpStops(-3.0, listOf(3.0, 5.0)))
        assertEquals(listOf(4.0, -2.0), jumpStops(4.0, listOf(-6.0)))
    }

    @Test
    fun ticksMarkEveryStepAndLabelEveryOtherOnLongLines() {
        assertEquals(
            listOf(-2.0, -1.0, 0.0, 1.0, 2.0).map { NumberLineTick(it, isLabelled = true) },
            numberLineTicks(min = -2.0, max = 2.0, step = 1.0),
        )
        assertEquals(
            listOf(-10.0, -8.0, -6.0, -4.0, -2.0, 0.0, 2.0, 4.0, 6.0, 8.0),
            numberLineTicks(min = -10.0, max = 9.0, step = 1.0).filter { it.isLabelled }.map { it.value },
        )
        assertEquals(listOf(0.0, 0.1, 0.2, 0.3), numberLineTicks(min = 0.0, max = 0.3, step = 0.1).map { it.value })
        assertEquals(21, numberLineTicks(min = 0.124, max = 0.126, step = 0.0001).size)
    }

    @Test
    fun thinnedLabelsCountFromZeroSoItsNeighborsNeverCrowdIt() {
        assertEquals(
            listOf(-4.0, -2.0, 0.0, 2.0, 4.0, 6.0, 8.0),
            numberLineTicks(min = -5.0, max = 9.0, step = 1.0).filter { it.isLabelled }.map { it.value },
        )
        assertEquals(
            listOf(-3.0, 0.0, 3.0, 6.0),
            numberLineTicks(min = -5.0, max = 7.0, step = 1.0, minEvery = 3).filter { it.isLabelled }.map { it.value },
        )
        assertEquals(
            listOf(1.0, 3.0, 5.0),
            numberLineTicks(min = 1.0, max = 6.0, step = 1.0, minEvery = 2)
                .filter {
                    it.isLabelled
                }.map { it.value },
        )
    }

    @Test
    fun theEquationAddsEachJumpToTheStart() {
        val format = { value: Double -> value.toInt().toString() }

        assertEquals("-3", numberLineEquation(-3.0, emptyList(), format))
        assertEquals("-3 + 3 + 5 = 5", numberLineEquation(-3.0, listOf(3.0, 5.0), format))
        assertEquals("4 − 6 = -2", numberLineEquation(4.0, listOf(-6.0), format))
    }
}
