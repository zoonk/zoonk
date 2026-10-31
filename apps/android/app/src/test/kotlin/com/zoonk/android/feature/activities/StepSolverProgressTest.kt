package com.zoonk.android.feature.activities

import org.junit.Assert.assertEquals
import org.junit.Test

/** Expected values are what main's `step-solver-progress.ts` returns for the same picks. */
class StepSolverProgressTest {
    private val steps = listOf(SolverStep("s1", correctId = "b"), SolverStep("s2", correctId = "c"))

    @Test
    fun aStepIsDoneOnceItsRightChoiceIsPickedAndItsFirstPickIsGraded() {
        assertEquals(
            listOf(
                0,
                0,
                2,
            ),
            listOf(emptyMap(), mapOf("s1" to listOf("a")), mapOf("s1" to listOf("a", "b"), "s2" to listOf("c"))).map {
                currentStepIndex(steps, it)
            },
        )
        assertEquals(null, firstPicks(steps, mapOf("s1" to listOf("a", "b"))))
        assertEquals(mapOf("s1" to "a", "s2" to "c"), firstPicks(steps, mapOf("s1" to listOf("a", "b"), "s2" to listOf("c"))))
        assertEquals(mapOf("s1" to listOf("a")), addPick(mapOf("s1" to listOf("a")), "s1", "a"))
        assertEquals(mapOf("s1" to listOf("a", "b")), addPick(mapOf("s1" to listOf("a")), "s1", "b"))
    }
}
