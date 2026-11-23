package com.zoonk.android.feature.essay

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Every case of core's `_test-utils/writing-lines.json`, so a line counts alike on every client and
 * in grading.
 */
class WritingLinesTest {
    private fun assertLines(
        text: String,
        charactersPerLine: Int,
        limit: Int?,
        estimated: Int,
        ignoredFrom: Int?,
    ) = assertEquals(text, WritingLines(estimated, ignoredFrom), countWritingLines(text, charactersPerLine, limit))

    @Test
    fun graphemesCountOnceAndOffsetsStayUtf16() = assertLines("é🙂\r\n\r\nnext", 2, 2, estimated = 4, ignoredFrom = 8)

    @Test
    fun aBreakThatEndsTheTextStartsNoLine() {
        listOf("\n", "\r\n", "\r", " ", " ").forEach { lineBreak ->
            assertLines("a".repeat(10) + lineBreak, 10, 1, estimated = 1, ignoredFrom = null)
        }
    }

    @Test
    fun aBlankLineInsideStillCounts() = assertLines("a".repeat(10) + "\r\n\r\n", 10, 1, estimated = 2, ignoredFrom = 12)

    @Test
    fun emptyTextTakesNoLines() = assertLines("", 10, 1, estimated = 0, ignoredFrom = null)

    @Test
    fun aFullLineWrapsOnlyWhenMoreTextFollows() {
        assertLines("abcd", 4, 1, estimated = 1, ignoredFrom = null)
        assertLines("abcde", 4, 1, estimated = 2, ignoredFrom = 4)
    }

    @Test
    fun onlyAWordTheLimitSplitsIsShownPastIt() {
        val cut = countWritingLines("abc def", 3, 1).ignoredFrom!!
        assertEquals(3, wordStart("abc def", cut))
        assertEquals(4, wordStart("abc def", 6))
        assertEquals(7, wordStart("abc def", 7))
    }
}
