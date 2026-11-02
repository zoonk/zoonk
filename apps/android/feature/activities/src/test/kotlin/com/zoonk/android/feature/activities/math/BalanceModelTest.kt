package com.zoonk.android.feature.activities.math

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Expected values are what main's `balance-model.ts` and `balance-layout.ts` return for the same input. */
class BalanceModelTest {
    private val start = checkNotNull(parseBalance("4*x + 1", "2*x + 7", "x"))
    private val steps = listOf("2*x + 1" to "7", "2*x" to "6", "x" to "3").map { (left, right) -> parseBalance(left, right, "x") }

    @Test
    fun readsEachSideAsBagsAndBlocks() {
        assertEquals(BalanceState(Pan(units = 1.0, x = 4.0), Pan(units = 7.0, x = 2.0)), start)
        assertEquals(3.0, solveBalance(start))
        assertTrue(canDrawBlocks(start, 3.0))
        assertNull(parseBalance("x^2", "4", "x"))
        assertFalse(canDrawBlocks(checkNotNull(parseBalance("x + 0.5", "3", "x")), 2.5))
    }

    @Test
    fun aOneSidedMoveTipsTheScale() {
        assertEquals(0.0, tiltDegrees(start, 3.0), 0.0)
        assertEquals(2.076923076923077, tiltDegrees(applyMove(start, BalanceMove.TakeX(PanSide.Left)), 3.0), 1e-12)
    }

    @Test
    fun equalMovesReachTheWorkedStepsAndSolveIt() {
        val history = mutableListOf<BalanceState>()
        var state = start
        listOf(PanSide.Left, PanSide.Right, PanSide.Left, PanSide.Right).forEach { side ->
            history += state
            state = applyMove(state, BalanceMove.TakeX(side))
        }
        assertEquals(1, reachedSteps(state, history, 3.0, steps))

        history += state
        state = applyMove(state, BalanceMove.TakeUnit(PanSide.Left))
        history += state
        state = applyMove(state, BalanceMove.TakeUnit(PanSide.Right))
        assertEquals(BalanceState(Pan(units = 0.0, x = 2.0), Pan(units = 6.0, x = 0.0)), state)
        assertEquals(2.0, splitGroups(state))

        val solved = applyMove(state, BalanceMove.Split(2.0))
        assertEquals(BalanceState(Pan(units = 0.0, x = 1.0), Pan(units = 3.0, x = 0.0)), solved)
        assertEquals(3.0, isolatedValue(solved))
        assertEquals(3, reachedSteps(solved, history, 3.0, steps))
    }

    @Test
    fun writesEachPanAsAnExpression() {
        val format = { value: Double -> if (value == kotlin.math.floor(value)) value.toInt().toString() else value.toString() }

        assertEquals(
            listOf("4x + 1", "2x + 7", "x", "0", "2.5"),
            listOf(start.left, start.right, Pan(0.0, 1.0), Pan(0.0, 0.0), Pan(2.5, 0.0)).map { panText(it, "x", format) },
        )
    }

    @Test
    fun laysBagsInRowsAndBlocksInStacks() {
        val four = panLayout(start.left, 144f)
        assertEquals(listOf(0f to 44f, 36f to 44f, 72f to 44f, 0f to 88f), four.bags.map { it.x to it.y })
        assertEquals(listOf(114f to 23f), four.blocks.map { it.x to it.y })
        assertEquals(88f, four.height, 0f)

        val full = panLayout(Pan(units = 12.0, x = 6.0), 144f)
        assertEquals(6, full.bags.size)
        assertEquals(0f to 264f, full.bags.last().let { it.x to it.y })
        assertEquals(listOf(42f to 23f, 42f to 46f, 42f to 69f, 65f to 23f), full.blocks.take(4).map { it.x to it.y })
        assertEquals(264f, full.height, 0f)

        val weighed = panLayout(Pan(units = 2.5, x = 1.0), 144f)
        assertEquals(ItemPosition(42f, 30f), weighed.weight)
        assertEquals(44f, weighed.height, 0f)
        assertEquals(0f, panLayout(Pan(0.0, 0.0), 144f).height, 0f)
    }
}
