package com.zoonk.android.feature.activities.code

import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

// Main's `sql-rows.test.ts`, then core's `gradeRows` for the reference query.
class SqlRowsTest {
    private fun row(vararg cells: Any?) =
        cells.map {
            when (it) {
                null -> JsonNull
                is String -> JsonPrimitive(it)
                else -> JsonPrimitive(it as Number)
            }
        }

    private val expected = listOf(row("India", 1451), row("China", 1419), row("Indonesia", 283))

    @Test
    fun marksExtraAndMissingRowsWhenOrderDoesntMatter() {
        assertEquals(
            RowMatch(listOf(true, true, false), listOf(true, true, false)),
            compareRows(listOf(row("China", 1419), row("India", 1451), row("Brazil", 212)), expected, orderMatters = false),
        )
    }

    @Test
    fun comparesPositionByPositionWhenOrderMatters() {
        assertEquals(
            RowMatch(listOf(false, false, true), listOf(false, false, true)),
            compareRows(listOf(row("China", 1419), row("India", 1451), row("Indonesia", 283)), expected, orderMatters = true),
        )
    }

    @Test
    fun tellsANumberFromTheSameDigitsAsText() {
        assertEquals(
            RowMatch(listOf(false), listOf(false)),
            compareRows(listOf(row("India", "1451")), listOf(row("India", 1451)), orderMatters = false),
        )
    }

    @Test
    fun readsAWholeNumberAndNullAsTheSameCellWhateverTheirSpelling() {
        assertEquals(
            RowMatch(listOf(true), listOf(true)),
            compareRows(listOf(row("Atlantis", 203.0, null)), listOf(row("Atlantis", 203, null)), orderMatters = true),
        )
    }

    @Test
    fun theReferenceQueryReturnsTheRowsWithColumnsInAnyCaseAndRowsAsAMultiset() {
        val result = QueryResult(listOf("Name", "pop"), listOf(row("A", 1), row("B", 2), row("A", 1)))

        assertTrue(returnsRows(result, listOf("name", "POP"), listOf(row("B", 2), row("A", 1), row("A", 1)), orderMatters = false))
        assertFalse(returnsRows(result, listOf("name", "pop"), listOf(row("B", 2), row("A", 1), row("B", 2)), orderMatters = false))
        assertFalse(returnsRows(result, listOf("name", "pop"), listOf(row("B", 2), row("A", 1), row("A", 1)), orderMatters = true))
        assertFalse(returnsRows(result, listOf("name"), listOf(row("A", 1), row("B", 2), row("A", 1)), orderMatters = true))
    }
}
