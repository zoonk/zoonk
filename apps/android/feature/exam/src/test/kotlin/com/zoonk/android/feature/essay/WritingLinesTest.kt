package com.zoonk.android.feature.essay

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Every case of core's `_test-utils/writing-lines.json`, so a line counts alike on every client and
 * in grading.
 */
class WritingLinesTest {
    private data class Case(
        val text: String,
        val perLine: Int,
        val dense: Int,
        val limit: Int?,
        val estimated: Int,
        val ignoredFrom: Int?,
    )

    @Test
    fun matchesCoresSharedCases() {
        listOf(
            Case("e\u0301🙂\r\n\r\nnext", 2, 2, 2, 3, 10),
            Case("aaaaaaaaaa\n", 10, 10, 1, 1, null),
            Case("aaaaaaaaaa\r\n", 10, 10, 1, 1, null),
            Case("aaaaaaaaaa\r", 10, 10, 1, 1, null),
            Case("aaaaaaaaaa\u2028", 10, 10, 1, 1, null),
            Case("aaaaaaaaaa\u2029", 10, 10, 1, 1, null),
            Case("aaaaaaaaaa\r\n\r\n", 10, 10, 1, 1, null),
            Case("ab\n\ncd", 5, 5, 1, 2, 4),
            Case("\n\nab\n \t\u00a0\r\n\u2029cd\n\n", 5, 5, 2, 2, null),
            Case("abcdefgh", 4, 6, 2, 2, null),
            Case("abcdefghij", 4, 6, 2, 3, null),
            Case("abcdefghijklm", 4, 6, 2, 4, 12),
            Case("abcdefghijklm", 4, 6, null, 4, null),
            Case("👍🏽👨\u200d👩\u200d👧e\u0301x", 2, 2, 1, 2, 12),
            Case("", 10, 10, 1, 0, null),
        ).forEach { case ->
            assertEquals(
                case.text,
                WritingLines(case.estimated, case.ignoredFrom),
                countWritingLines(case.text, case.perLine, case.dense, case.limit),
            )
        }
    }

    @Test
    fun onlyAWordTheLimitSplitsIsShownPastIt() {
        val cut = countWritingLines("abc def", 3, 3, 1).ignoredFrom!!
        assertEquals(3, wordStart("abc def", cut))
        assertEquals(4, wordStart("abc def", 6))
        assertEquals(7, wordStart("abc def", 7))
    }
}
