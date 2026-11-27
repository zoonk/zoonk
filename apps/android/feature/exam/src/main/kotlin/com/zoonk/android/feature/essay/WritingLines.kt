package com.zoonk.android.feature.essay

import java.text.BreakIterator

/** How many lines a handwritten answer sheet would take, and where the text passes its limit. */
data class WritingLines(
    val estimated: Int,
    /** The UTF-16 offset where the text passes the limit, as the grade's `ignoredFrom`; null within it. */
    val ignoredFrom: Int?,
)

/** Core's `estimateWritingLines`: how many lines of the sheet the text would take at a typical hand. */
fun estimateWritingLines(
    text: String,
    charactersPerLine: Int,
): Int = countLines(text, charactersPerLine, null).estimated

/**
 * Core's `countWritingLines`: the estimate at a typical hand ([charactersPerLine]), and where the text
 * passes [limit] even at the densest published hand ([maxCharactersPerLine]), the part no grader would read.
 */
fun countWritingLines(
    text: String,
    charactersPerLine: Int,
    maxCharactersPerLine: Int,
    limit: Int?,
): WritingLines =
    WritingLines(
        estimateWritingLines(text, charactersPerLine),
        countLines(text, maxCharactersPerLine, limit).ignoredFrom,
    )

/**
 * Each grapheme takes a character of a line [charactersPerLine] long. A paragraph starts on the next
 * line of the sheet, none is left blank between paragraphs, and a space never starts a line, so only
 * text opens one. The text past the limit starts at a word.
 */
private fun countLines(
    text: String,
    charactersPerLine: Int,
    limit: Int?,
): WritingLines {
    var lines = 0
    var used = 0
    var broken = false
    var passedFrom: Int? = null
    var wordStart = 0
    val graphemes = BreakIterator.getCharacterInstance().apply { setText(text) }
    var start = graphemes.first()
    var end = graphemes.next()

    while (end != BreakIterator.DONE) {
        val grapheme = text.substring(start, end)
        val space = grapheme.all { it in WHITE_SPACE }
        if (isLineBreak(grapheme)) {
            broken = lines > 0
        } else if (!space) {
            if (lines == 0 || broken || used == charactersPerLine) {
                lines += 1
                used = 0
                broken = false
            }
            if (limit != null && lines > limit && passedFrom == null) passedFrom = wordStart
            used += 1
        } else if (lines > 0 && !broken && used < charactersPerLine) {
            used += 1
        }
        if (space) wordStart = end
        start = end
        end = graphemes.next()
    }
    return WritingLines(lines, passedFrom)
}

private fun isLineBreak(grapheme: String): Boolean = grapheme == "\r\n" || (grapheme.length == 1 && grapheme[0] in LINE_BREAKS)

private val LINE_BREAKS = setOf('\r', '\n', ' ', ' ')

/** Unicode's `White_Space`, core's `\p{White_Space}`, listed so it doesn't depend on the regex engine a device runs. */
private val WHITE_SPACE =
    (
        ('\u0009'..'\u000D') + '\u0020' + '\u0085' + '\u00A0' + '\u1680' + ('\u2000'..'\u200A') +
            '\u2028' + '\u2029' + '\u202F' + '\u205F' + '\u3000'
    ).toSet()
