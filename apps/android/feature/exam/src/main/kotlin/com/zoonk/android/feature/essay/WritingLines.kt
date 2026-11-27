package com.zoonk.android.feature.essay

import com.zoonk.api.models.WritingPromptOutput
import java.text.BreakIterator

/** How many lines a handwritten answer sheet would take, and where graders stop reading. */
data class WritingLines(
    val estimated: Int,
    /** The UTF-16 offset where the text passes the limit even in dense handwriting, as the grade's `ignoredFrom`. */
    val ignoredFrom: Int?,
)

/** Whether a text fits its sheet at a typical hand, only in small handwriting, or not even then. */
enum class WritingFit { Fits, SmallHandwriting, Over }

/**
 * Core's `countWritingLines`: lines at a typical hand of [charactersPerLine], each grapheme taking a
 * character and each line break starting a line, while a blank line takes none, since a sheet skips
 * no line between paragraphs. Graders stop where the text passes [limit] even at [denseCharactersPerLine].
 */
fun countWritingLines(
    text: String,
    charactersPerLine: Int,
    denseCharactersPerLine: Int,
    limit: Int?,
): WritingLines =
    WritingLines(
        estimateWritingLines(text, charactersPerLine),
        layOutLines(text, denseCharactersPerLine, limit).second,
    )

fun estimateWritingLines(
    text: String,
    charactersPerLine: Int,
): Int = layOutLines(text, charactersPerLine, null).first

/** The text's count against the prompt's limit and how it fits, or null where the prompt has none. */
fun writingFit(
    text: String,
    writing: WritingPromptOutput,
): Pair<WritingLines, WritingFit>? {
    val limit = writing.lines?.toInt() ?: return null
    val lines = countWritingLines(text, writing.charactersPerLine.toInt(), writing.denseCharactersPerLine.toInt(), limit)
    val fit =
        when {
            lines.ignoredFrom != null -> WritingFit.Over
            lines.estimated > limit -> WritingFit.SmallHandwriting
            else -> WritingFit.Fits
        }
    return lines to fit
}

private fun layOutLines(
    text: String,
    perLine: Int,
    limit: Int?,
): Pair<Int, Int?> {
    var lines = 0
    var pastLimitFrom: Int? = null
    val line = mutableListOf<Int>()
    var blank = true

    fun endLine() {
        if (!blank) {
            line.forEachIndexed { position, start ->
                if (pastLimitFrom == null && limit != null && lines + position / perLine >= limit) pastLimitFrom = start
            }
            lines += (line.size + perLine - 1) / perLine
        }
        line.clear()
        blank = true
    }

    val graphemes = BreakIterator.getCharacterInstance().apply { setText(text) }
    var start = graphemes.first()
    var end = graphemes.next()

    while (end != BreakIterator.DONE) {
        val grapheme = text.substring(start, end)
        if (isLineBreak(grapheme)) {
            endLine()
        } else {
            line += start
            blank = blank && WHITE_SPACE.matches(grapheme)
        }
        start = end
        end = graphemes.next()
    }
    endLine()
    return lines to pastLimitFrom
}

private val WHITE_SPACE = Regex("\\p{IsWhite_Space}+")

private fun isLineBreak(grapheme: String): Boolean = grapheme == "\r\n" || (grapheme.length == 1 && grapheme[0] in LINE_BREAKS)

private val LINE_BREAKS = setOf('\r', '\n', '\u2028', '\u2029')
