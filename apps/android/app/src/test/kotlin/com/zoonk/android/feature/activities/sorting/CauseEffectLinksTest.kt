package com.zoonk.android.feature.activities.sorting

import org.junit.Assert.assertEquals
import org.junit.Test

/** Main's `cause-effect-links.test.ts`. */
class CauseEffectLinksTest {
    private fun ids(nodes: List<Pair<String, Long?>>) = orderNodes(nodes) { it.second }.map { it.first }

    @Test
    fun ordersDatedNodesByYearAndKeepsTheWritersOrderOtherwise() {
        assertEquals(listOf("plow", "drought", "dust"), ids(listOf("dust" to 1934L, "plow" to 1920L, "drought" to 1931L)))
        assertEquals(listOf("b", "a"), ids(listOf("b" to 1934L, "a" to null)))
    }

    @Test
    fun togglesALinkAndTreatsAReversedOneAsDifferent() {
        val added = emptyList<CauseLink>().toggle(CauseLink("plow", "dust"))
        assertEquals(listOf(CauseLink("plow", "dust")), added)
        assertEquals(emptyList<CauseLink>(), added.toggle(CauseLink("plow", "dust")))
        assertEquals(2, listOf(CauseLink("a", "b")).toggle(CauseLink("b", "a")).size)
    }

    @Test
    fun marksRightAndWrongLinksAndListsTheMissedOnes() {
        assertEquals(
            listOf(
                LinkResult(CauseLink("plow", "dust"), LinkState.Correct),
                LinkResult(CauseLink("dust", "plow"), LinkState.Incorrect),
                LinkResult(CauseLink("drought", "dust"), LinkState.Missed),
            ),
            compareLinks(
                listOf(CauseLink("plow", "dust"), CauseLink("dust", "plow")),
                listOf(CauseLink("plow", "dust"), CauseLink("drought", "dust")),
            ),
        )
    }

    @Test
    fun bowsFurtherForCardsFurtherApartWithinTheGutter() {
        assertEquals(listOf(14f, 28f, 46f), listOf(1, 3, 9).map(::arcDepth))
    }
}
