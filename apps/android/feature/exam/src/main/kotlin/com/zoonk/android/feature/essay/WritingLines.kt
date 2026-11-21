package com.zoonk.android.feature.essay

import java.text.BreakIterator

/** How many lines a handwritten answer sheet would take, and where the text passes its limit. */
data class WritingLines(
    val estimated: Int,
    /** The UTF-16 offset where the text passes the limit, as the grade's `ignoredFrom`; null within it. */
    val ignoredFrom: Int?,
)

/**
 * Core's `countWritingLines`: each grapheme takes a character of a line [charactersPerLine] long,
 * and each line break inside the text starts a new line, so an answer typed here counts as the sheet would.
 */
fun countWritingLines(
    text: String,
    charactersPerLine: Int,
    limit: Int?,
): WritingLines {
    var lines = 0
    var used = 0
    var ignoredFrom: Int? = null
    val graphemes = BreakIterator.getCharacterInstance().apply { setText(text) }
    var start = graphemes.first()
    var end = graphemes.next()

    while (end != BreakIterator.DONE) {
        val lineBreak = isLineBreak(text.substring(start, end))
        if (lines == 0 || (used == charactersPerLine && !lineBreak)) {
            lines += 1
            used = 0
        }
        if (limit != null && lines > limit && ignoredFrom == null) ignoredFrom = start
        if (lineBreak) {
            // A break that ends the text starts no line of its own.
            if (end < text.length) lines += 1
            used = 0
        } else {
            used += 1
        }
        start = end
        end = graphemes.next()
    }
    return WritingLines(lines, ignoredFrom)
}

private fun isLineBreak(grapheme: String): Boolean = grapheme == "\r\n" || (grapheme.length == 1 && grapheme[0] in LINE_BREAKS)

private val LINE_BREAKS = setOf('\r', '\n', ' ', ' ')
