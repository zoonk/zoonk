package com.zoonk.android.ui.richtext

/**
 * Lesson text is Markdown limited to emphasis, short lists, GFM tables of data, inline code and
 * `$...$` math (main's `@zoonk/learn/rich-text/parser`). This parser covers exactly that subset,
 * so generated headings or links can never change a screen's layout.
 */
enum class SegmentKind { Bold, Code, DisplayMath, Italic, Math, Text }

/**
 * A run of lesson text with one formatting primitive. `marked` runs are a sentence the screen
 * points at, such as the one a question rests on, read again after a wrong answer.
 */
data class RichSegment(
    val kind: SegmentKind,
    val text: String,
    val marked: Boolean = false,
)

sealed interface RichBlock {
    data class Paragraph(
        val lines: List<List<RichSegment>>,
    ) : RichBlock

    data class ListBlock(
        val items: List<List<RichSegment>>,
        val ordered: Boolean,
    ) : RichBlock

    data class Table(
        val align: List<TableAlign?>,
        val header: List<List<RichSegment>>,
        val rows: List<List<List<RichSegment>>>,
    ) : RichBlock
}

private data class MathSpan(
    val content: String,
    val start: Int,
    val end: Int,
    val display: Boolean,
)

private val UPPERCASE_LETTER = Regex("\\p{Lu}")

// JavaScript's `\s`, spelled out: the JVM's `\s` is ASCII only, and Android's ICU regex rejects `(?U)`.
private const val SPACE = "[\\t\\n\\u000B\\f\\r \\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF]"
private val UNORDERED_ITEM = Regex("^$SPACE*[-*•]$SPACE+(.+)$")
private val ORDERED_ITEM = Regex("^$SPACE*[0-9]{1,3}[.)]$SPACE+(.+)$")
private val LINE_BREAK = Regex("$SPACE*\\n$SPACE*")
private val LINE_END = Regex("\\r?\\n")

private fun isDigitAt(
    text: String,
    index: Int,
): Boolean = text.getOrNull(index)?.let { it in '0'..'9' } ?: false

private fun isEscaped(
    text: String,
    index: Int,
): Boolean = index > 0 && text[index - 1] == '\\'

/** "R$ 80", "US$5" and "C$ 12" are currency signs, never math delimiters. */
private fun isCurrencySign(
    text: String,
    index: Int,
): Boolean {
    val before = text.getOrNull(index - 1) ?: return false
    val priceAfter = isDigitAt(text, index + 1) || (text.getOrNull(index + 1)?.isWhitespace() == true && isDigitAt(text, index + 2))
    return UPPERCASE_LETTER.matches(before.toString()) && priceAfter
}

private fun isDelimiter(
    text: String,
    index: Int,
): Boolean = !isEscaped(text, index) && !isCurrencySign(text, index)

/**
 * A closing `$` has text right before it and no digit right after, so prices like "$5 and $10"
 * stay text (Pandoc's rule), and a currency sign like "R$ 80" never closes math.
 */
private tailrec fun findInlineMathClose(
    text: String,
    from: Int,
): Int? {
    val index = text.indexOf('$', from)
    if (index == -1) return null

    val isClose = isDelimiter(text, index) && !isWhitespaceAt(text, index - 1) && !isDigitAt(text, index + 1)
    return if (isClose) index else findInlineMathClose(text, index + 1)
}

private fun matchMathAt(
    text: String,
    start: Int,
): MathSpan? {
    if (text.startsWith("$$", start)) {
        val close = text.indexOf("$$", start + 2)
        val content = if (close == -1) "" else text.substring(start + 2, close).trim()
        return if (content.isNotEmpty()) MathSpan(content, start, close + 2, display = true) else null
    }

    if (isWhitespaceAt(text, start + 1)) return null

    val close = findInlineMathClose(text, start + 2) ?: return null
    return MathSpan(text.substring(start + 1, close), start, close + 1, display = false)
}

private tailrec fun findDollarMath(
    text: String,
    from: Int = 0,
): MathSpan? {
    val start = text.indexOf('$', from)
    if (start == -1) return null

    val span = if (isDelimiter(text, start)) matchMathAt(text, start) else null
    return span ?: findDollarMath(text, start + 1)
}

private data class Delimiters(
    val open: String,
    val close: String,
    val display: Boolean,
)

private val BRACKETS =
    listOf(
        Delimiters("\\\\(", "\\\\)", display = false),
        Delimiters("\\\\[", "\\\\]", display = true),
        Delimiters("\\(", "\\)", display = false),
        Delimiters("\\[", "\\]", display = true),
    )

private fun findMath(text: String): MathSpan? {
    val brackets =
        BRACKETS.mapNotNull { (open, close, display) ->
            val start = text.indexOf(open)
            val end = if (start == -1) -1 else text.indexOf(close, start + open.length)
            if (end < 0) null else MathSpan(text.substring(start + open.length, end), start, end + close.length, display)
        }

    return (listOfNotNull(findDollarMath(text)) + brackets).minByOrNull { it.start }
}

private fun MarkupKind.toSegmentKind(): SegmentKind =
    when (this) {
        MarkupKind.Bold -> SegmentKind.Bold
        MarkupKind.Code -> SegmentKind.Code
        MarkupKind.Italic -> SegmentKind.Italic
        MarkupKind.Text -> SegmentKind.Text
    }

/** An escaped `\$` is a dollar sign that isn't math. */
private fun parseMarkup(text: String): List<RichSegment> =
    parseInlineMarkup(text).map { (kind, content) ->
        RichSegment(kind.toSegmentKind(), if (kind == MarkupKind.Text) content.replace("\\$", "$") else content)
    }

/** A question, an option or a label is one line: its line breaks read as spaces. */
fun toOneLine(text: String): String = text.replace(LINE_BREAK, " ")

/** Math first, so emphasis markers never touch LaTeX. */
fun parseRichInline(text: String): List<RichSegment> {
    val math = findMath(text) ?: return parseMarkup(text)

    return parseMarkup(text.substring(0, math.start)) +
        RichSegment(if (math.display) SegmentKind.DisplayMath else SegmentKind.Math, math.content) +
        parseRichInline(text.substring(math.end))
}

private sealed interface Line {
    data object Blank : Line

    data class Item(
        val text: String,
        val ordered: Boolean,
    ) : Line

    data class Text(
        val text: String,
    ) : Line
}

private fun classifyLine(line: String): Line {
    UNORDERED_ITEM.find(line)?.let { return Line.Item(it.groupValues[1], ordered = false) }
    ORDERED_ITEM.find(line)?.let { return Line.Item(it.groupValues[1], ordered = true) }
    return line.trim().let { if (it.isEmpty()) Line.Blank else Line.Text(it) }
}

private fun appendLine(
    blocks: List<RichBlock>,
    line: Line,
    previous: Line?,
): List<RichBlock> {
    val last = blocks.lastOrNull()
    val head = blocks.dropLast(1)

    return when (line) {
        Line.Blank -> {
            blocks
        }

        is Line.Item -> {
            val inline = parseRichInline(line.text)
            if (last is RichBlock.ListBlock && last.ordered == line.ordered && previous is Line.Item) {
                head + last.copy(items = last.items + listOf(inline))
            } else {
                blocks + RichBlock.ListBlock(listOf(inline), line.ordered)
            }
        }

        is Line.Text -> {
            val inline = parseRichInline(line.text)
            if (last is RichBlock.Paragraph && previous is Line.Text) {
                head + last.copy(lines = last.lines + listOf(inline))
            } else {
                blocks + RichBlock.Paragraph(listOf(inline))
            }
        }
    }
}

private fun parseTextLines(lines: List<String>): List<RichBlock> {
    val classified = lines.map(::classifyLine)

    return classified.foldIndexed(emptyList()) { index, blocks, line ->
        appendLine(blocks, line, classified.getOrNull(index - 1))
    }
}

private fun readBlocks(
    lines: List<String>,
    from: Int,
): List<RichBlock> {
    val index = (from until lines.size).firstOrNull { readMarkdownTable(lines, it) != null }
    val read = index?.let { readMarkdownTable(lines, it) } ?: return parseTextLines(lines.subList(from, lines.size))
    val (align, header, rows) = read.table

    val table =
        RichBlock.Table(
            align = align,
            header = header.map(::parseRichInline),
            rows = rows.map { row -> row.map(::parseRichInline) },
        )

    return parseTextLines(lines.subList(from, index)) + table + readBlocks(lines, read.end)
}

fun parseRichBlocks(text: String): List<RichBlock> = readBlocks(text.split(LINE_END), 0)

private fun List<RichSegment>.shownText(): String = joinToString("") { it.text }

/** Only words can be cut; a formula or code is marked whole once the quote reaches into it. */
private fun RichSegment.canSplit(): Boolean = kind == SegmentKind.Text || kind == SegmentKind.Bold || kind == SegmentKind.Italic

private fun markSegment(
    segment: RichSegment,
    start: Int,
    end: Int,
): List<RichSegment> {
    val from = maxOf(0, start)
    val to = minOf(segment.text.length, end)

    return when {
        from >= to -> {
            listOf(segment)
        }

        !segment.canSplit() -> {
            listOf(segment.copy(marked = true))
        }

        else -> {
            listOf(
                segment.copy(text = segment.text.substring(0, from)),
                segment.copy(text = segment.text.substring(from, to), marked = true),
                segment.copy(text = segment.text.substring(to)),
            ).filter { it.text.isNotEmpty() }
        }
    }
}

private fun markLine(
    segments: List<RichSegment>,
    quote: String,
): List<RichSegment>? {
    val start = segments.shownText().indexOf(quote)
    if (start == -1) return null

    val end = start + quote.length
    var offset = 0

    return segments.flatMap { segment ->
        markSegment(segment, start - offset, end - offset).also { offset += segment.text.length }
    }
}

private fun markLines(
    lines: List<List<RichSegment>>,
    quote: String,
): List<List<RichSegment>>? {
    lines.forEachIndexed { index, line ->
        val marked = markLine(line, quote)
        if (marked != null) return lines.mapIndexed { at, other -> if (at == index) marked else other }
    }

    return null
}

private fun markBlock(
    block: RichBlock,
    quote: String,
): RichBlock? =
    when (block) {
        is RichBlock.Paragraph -> markLines(block.lines, quote)?.let { block.copy(lines = it) }
        is RichBlock.ListBlock -> markLines(block.items, quote)?.let { block.copy(items = it) }
        is RichBlock.Table -> null
    }

/**
 * A quote is written like lesson text, Markdown marks included, so it's compared by the words it
 * shows, read as its line is: a list item without its marker ("- ", "1. "). One that cuts a mark
 * in two shows the mark itself, which no line shows.
 */
private fun shownQuote(quote: String): String =
    when (val line = classifyLine(quote.trim())) {
        Line.Blank -> ""
        is Line.Item -> parseRichInline(line.text).shownText()
        is Line.Text -> parseRichInline(line.text).shownText()
    }

fun markRichInline(
    segments: List<RichSegment>,
    quote: String,
): List<RichSegment> {
    val shown = shownQuote(quote)
    return shown.takeIf { it.isNotEmpty() }?.let { markLine(segments, it) } ?: segments
}

/**
 * The blocks with one sentence marked: the first paragraph line or list item that shows the
 * quote's words. A quote no line shows marks nothing.
 */
fun markRichBlocks(
    blocks: List<RichBlock>,
    quote: String,
): List<RichBlock> {
    val shown = shownQuote(quote).takeIf { it.isNotEmpty() } ?: return blocks

    blocks.forEachIndexed { index, block ->
        val marked = markBlock(block, shown)
        if (marked != null) return blocks.mapIndexed { at, other -> if (at == index) marked else other }
    }

    return blocks
}
