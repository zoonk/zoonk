package com.zoonk.android.feature.activities

import org.junit.Assert.assertEquals
import org.junit.Test

/** Expected values are what main's `decision-tree-walk.ts` returns for the same tree. */
class DecisionTreeWalkTest {
    private val nodes =
        listOf(
            TreeNode.Question("q1", "Leaves?", listOf(TreeNode.Branch("Needles", "q2"), TreeNode.Branch("Broad", "oak"))),
            TreeNode.Question("q2", "How?", listOf(TreeNode.Branch("In bundles", "pine"), TreeNode.Branch("Single", "spruce"))),
            TreeNode.Outcome("oak", "Oak"),
            TreeNode.Outcome("pine", "Pine"),
            TreeNode.Outcome("spruce", "Spruce"),
        )

    @Test
    fun aWalkKeepsOnlyTheOutcomesStillReachable() {
        assertEquals(listOf("pine", "spruce", "oak"), nodes.reachableOutcomes("q1").map { it.id })
        assertEquals(listOf("pine", "spruce"), nodes.reachableOutcomes("q2").map { it.id })
        assertEquals(0, nodes.reachableOutcomes("zz").size)
        assertEquals(
            listOf("q1" to "Needles", "q2" to "In bundles"),
            nodes.walkSteps(listOf("q1", "q2", "pine")).map {
                it.node.id to
                    it.branch
            },
        )
    }

    @Test
    fun theWalkIsComparedWhereItFirstLeftTheExpectedOne() {
        val expected = listOf("q1", "q2", "pine")
        assertEquals(null, firstDivergence(expected, expected))
        assertEquals(2, firstDivergence(expected, listOf("q1", "q2", "spruce")))
        assertEquals(2, firstDivergence(listOf("q1", "oak"), listOf("q1", "oak", "x")))
        assertEquals(1, firstDivergence(expected, listOf("q1")))
    }
}
