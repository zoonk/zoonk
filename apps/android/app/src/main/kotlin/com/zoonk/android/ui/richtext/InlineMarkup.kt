package com.zoonk.android.ui.richtext

/**
 * Words AI writers quote in angle quotes («caption» or <<caption>>) read as italics, without the
 * marks. Anything else stays text, so a stray marker never changes a screen's layout.
 */
internal enum class MarkupKind { Bold, Code, Italic, Text }

internal data class InlineMarkup(
    val kind: MarkupKind,
    val text: String,
)

private data class Span(
    val content: String,
    val start: Int,
    val end: Int,
)

private val WORD_CHARACTER = Regex("[\\p{L}\\p{N}]")

/** JavaScript's `\s` (Unicode whitespace), with the end of the text counting as whitespace. */
internal fun isWhitespaceAt(
    text: String,
    index: Int,
): Boolean = text.getOrNull(index)?.isWhitespace() ?: true

private fun isWordAt(
    text: String,
    index: Int,
): Boolean = text.getOrNull(index)?.let { WORD_CHARACTER.matches(it.toString()) } ?: false

private fun findCode(text: String): Span? {
    val start = text.indexOf('`')
    val end = if (start == -1) -1 else text.indexOf('`', start + 1)
    return if (end > start + 1) Span(text.substring(start + 1, end), start, end + 1) else null
}

private val ANGLE_QUOTES = listOf("«" to "»", "<<" to ">>")

private fun findAngleQuote(text: String): Span? =
    ANGLE_QUOTES
        .mapNotNull { (open, close) ->
            val start = text.indexOf(open)
            val end = if (start == -1) -1 else text.indexOf(close, start + open.length)
            val content = if (end == -1) "" else text.substring(start + open.length, end)
            if (content.isNotBlank() && '\n' !in content) Span(content.trim(), start, end + close.length) else null
        }.minByOrNull { it.start }

private fun findBold(text: String): Span? {
    val start = text.indexOf("**")
    val end = if (start == -1) -1 else text.indexOf("**", start + 2)
    return if (end > start + 2) Span(text.substring(start + 2, end), start, end + 2) else null
}

/**
 * `_word_` counts only at word edges, so snake_case names stay text; `*word*` needs text right
 * inside both markers, so "2 * 3 * 4" stays text; and a run of markers is never one, so a fill-in
 * blank ("___") stays a blank.
 */
private fun isItalicOpen(
    text: String,
    index: Int,
    marker: Char,
): Boolean {
    val opensWord = marker == '*' || !isWordAt(text, index - 1)
    return text[index] == marker && opensWord && !isWhitespaceAt(text, index + 1) && text.getOrNull(index + 1) != marker
}

private fun isItalicClose(
    text: String,
    index: Int,
    marker: Char,
): Boolean {
    val closesWord = marker == '*' || !isWordAt(text, index + 1)
    return text[index] == marker && closesWord && !isWhitespaceAt(text, index - 1) && text.getOrNull(index - 1) != marker
}

private tailrec fun findItalicClose(
    text: String,
    marker: Char,
    from: Int,
): Int? {
    val index = text.indexOf(marker, from)

    return when {
        index == -1 -> null
        isItalicClose(text, index, marker) -> index
        else -> findItalicClose(text, marker, index + 1)
    }
}

private tailrec fun findItalic(
    text: String,
    from: Int = 0,
): Span? {
    val first =
        listOf('*', '_')
            .mapNotNull { marker -> text.indexOf(marker, from).takeIf { it != -1 }?.let { marker to it } }
            .minByOrNull { it.second } ?: return null

    val (marker, start) = first
    val close = if (isItalicOpen(text, start, marker)) findItalicClose(text, marker, start + 2) else null

    return if (close == null) findItalic(text, start + 1) else Span(text.substring(start + 1, close), start, close + 1)
}

/** On a tie, bold wins over the italics inside its markers. */
private fun findFirstMark(text: String): Pair<MarkupKind, Span>? =
    listOfNotNull(
        findBold(text)?.let { MarkupKind.Bold to it },
        findItalic(text)?.let { MarkupKind.Italic to it },
        findAngleQuote(text)?.let { MarkupKind.Italic to it },
    ).minByOrNull { it.second.start }

private fun around(
    text: String,
    kind: MarkupKind,
    span: Span,
    rest: (String) -> List<InlineMarkup>,
): List<InlineMarkup> = rest(text.substring(0, span.start)) + InlineMarkup(kind, span.content) + rest(text.substring(span.end))

private fun parseEmphasis(text: String): List<InlineMarkup> {
    val mark = findFirstMark(text)

    return when {
        mark != null -> around(text, mark.first, mark.second, ::parseEmphasis)
        text.isEmpty() -> emptyList()
        else -> listOf(InlineMarkup(MarkupKind.Text, text))
    }
}

/** Inline code first, so its punctuation stays literal. */
internal fun parseInlineMarkup(text: String): List<InlineMarkup> {
    val code = findCode(text)
    return if (code != null) around(text, MarkupKind.Code, code, ::parseInlineMarkup) else parseEmphasis(text)
}
