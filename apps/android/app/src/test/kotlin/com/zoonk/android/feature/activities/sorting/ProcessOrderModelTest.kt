package com.zoonk.android.feature.activities.sorting

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

/** Main's `process-order-model.test.ts`. */
class ProcessOrderModelTest {
    private val steps = listOf("absorb", "split", "store", "calvin", "starch")

    @Test
    fun shufflesTheSameWayForTheSameSeed() {
        assertEquals(shuffleSteps(steps, "leaf"), shuffleSteps(steps, "leaf"))
        assertEquals(steps.sorted(), shuffleSteps(steps, "leaf").sorted())
    }

    @Test
    fun neverStartsInTheRightOrderWhateverTheSeed() {
        repeat(50) {
            assertEquals(listOf("b", "a"), shuffleSteps(listOf("a", "b"), "seed-$it"))
            assertNotEquals(steps, shuffleSteps(steps, "seed-$it"))
        }
    }

    @Test
    fun pairsEachStepsTruePlaceWithTheLearners() {
        assertEquals(
            listOf(StepResult("a", 1, 1), StepResult("b", 3, 2), StepResult("c", 2, 3)),
            stepResults(listOf("a", "b", "c"), listOf("a", "c", "b")),
        )
        assertEquals(StepResult("b", null, 2), stepResults(listOf("a", "b"), listOf("a"))[1])
    }
}
