package com.zoonk.android.feature.essay

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** The same cases as core's `countWritingLines`, so a line counts alike on every client and in grading. */
class WritingLinesTest {
    @Test
    fun countsGraphemesKeepsUtf16OffsetsAndCountsBlankLines() {
        val text = "é🙂\r\n\r\nnext"
        assertEquals(WritingLines(estimated = 4, ignoredFrom = text.indexOf("next")), countWritingLines(text, charactersPerLine = 2, limit = 2))
    }

    @Test
    fun aFullLineWrapsOnlyWhenMoreTextFollows() {
        assertEquals(WritingLines(1, null), countWritingLines("abcd", charactersPerLine = 4, limit = 1))
        assertEquals(WritingLines(2, 4), countWritingLines("abcde", charactersPerLine = 4, limit = 1))
    }

    @Test
    fun emptyTextTakesNoLines() {
        assertEquals(WritingLines(0, null), countWritingLines("", charactersPerLine = 55, limit = 30))
    }

    @Test
    fun withoutALimitNothingIsIgnored() {
        assertNull(countWritingLines("a".repeat(500), charactersPerLine = 55, limit = null).ignoredFrom)
    }
}
