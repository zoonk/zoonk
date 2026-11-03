package com.zoonk.android.feature.activities.sorting

import com.zoonk.android.feature.activities.assignmentAnswer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** Main's `categorize-placements.test.ts`. */
class CategorizePlacementsTest {
    private val ids = listOf("ice", "wood", "rust", "sugar")

    @Test
    fun answersOnlyOnceEveryItemHasAGroup() {
        assertNull(placementsAnswer(ids, mapOf("ice" to "physical", "wood" to "chemical")))
        assertEquals(
            assignmentAnswer(mapOf("ice" to "physical", "wood" to "chemical", "rust" to "chemical", "sugar" to "chemical")),
            placementsAnswer(ids, mapOf("ice" to "physical", "rust" to "chemical", "sugar" to "chemical", "wood" to "chemical")),
        )
    }

    @Test
    fun keepsTheListOrder() {
        assertEquals(listOf("ice", "rust", "sugar"), unplacedItems(ids, mapOf("wood" to "chemical")) { it })
    }
}
