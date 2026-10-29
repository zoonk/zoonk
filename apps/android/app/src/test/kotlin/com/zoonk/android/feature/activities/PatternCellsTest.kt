package com.zoonk.android.feature.activities

import org.junit.Assert.assertEquals
import org.junit.Test

/** Expected values are what main's `pattern-cells.ts` returns for the same input. */
class PatternCellsTest {
    @Test
    fun aFormSplitsIntoItsSharedStemAndItsEnding() {
        assertEquals(
            listOf("habl", "como", "", ""),
            listOf(listOf("hablo", "hablas", "habla"), listOf("como"), emptyList(), listOf("ser", "estar")).map(::commonStem),
        )
        assertEquals(
            listOf(FormParts("habl", "amos"), FormParts("habl", ""), FormParts("como", "")),
            listOf(splitForm("hablamos", "habl"), splitForm("habl", "habl"), splitForm("como", "habl")),
        )
        assertEquals(
            listOf("habl", "hablo"),
            listOf(blankStem(listOf("o", "as", "amos", "mos"), "hablamos"), blankStem(listOf("x"), "hablo")),
        )
    }

    @Test
    fun theNextBlankIsTheNextOpenOneWrappingAround() {
        assertEquals(1, nextOpenBlank(listOf(1, 3, 4), null, emptyMap()))
        assertEquals(1, nextOpenBlank(listOf(1, 3, 4), 3, mapOf("4" to "x")))
        assertEquals(null, nextOpenBlank(listOf(1, 3), 1, mapOf("1" to "a", "3" to "b")))
    }
}

class TableWidthsTest {
    @Test
    fun columnsShareTheWidthLikeABrowserTable() {
        assertEquals(listOf(40, 60, 80), tableWidths(narrowest = listOf(10, 20, 30), widest = listOf(30, 50, 70), room = 180))
        assertEquals(listOf(20, 35, 50), tableWidths(narrowest = listOf(10, 20, 30), widest = listOf(30, 50, 70), room = 105))
        assertEquals(listOf(10, 20, 30), tableWidths(narrowest = listOf(10, 20, 30), widest = listOf(30, 50, 70), room = 40))
    }
}
