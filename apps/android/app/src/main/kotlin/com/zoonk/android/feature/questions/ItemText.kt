package com.zoonk.android.feature.questions

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.zoonk.android.ui.richtext.MarkupKind
import com.zoonk.android.ui.richtext.RichSegment
import com.zoonk.android.ui.richtext.RichTable
import com.zoonk.android.ui.richtext.RichText
import com.zoonk.android.ui.richtext.RichTextLine
import com.zoonk.android.ui.richtext.SegmentKind
import com.zoonk.android.ui.richtext.TableAlign
import com.zoonk.android.ui.richtext.parseInlineMarkup
import com.zoonk.android.ui.richtext.readMarkdownTable
import com.zoonk.android.ui.richtext.richText

internal sealed interface ItemBlock {
    data class Paragraph(
        val segments: List<RichSegment>,
    ) : ItemBlock

    data class Table(
        val align: List<TableAlign?>,
        val header: List<List<RichSegment>>,
        val rows: List<List<List<RichSegment>>>,
    ) : ItemBlock
}

/**
 * A question's context, a set's passage or an explanation (main's `ItemText`): paragraphs, data
 * tables and inline code, bold and italics, as item writers are told. Anything else stays text,
 * math included, since "$5" here is money.
 */
@Composable
fun ItemText(
    text: String,
    modifier: Modifier = Modifier,
    style: TextStyle = LocalTextStyle.current,
) {
    val blocks = remember(text) { parseItemText(text) }

    Column(modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        blocks.forEach { block ->
            when (block) {
                is ItemBlock.Paragraph -> {
                    RichTextLine(richText(block.segments), Modifier, style)
                }

                is ItemBlock.Table -> {
                    RichTable(block.align, block.header.map { richText(it) }, block.rows.map { row -> row.map { richText(it) } })
                }
            }
        }
    }
}

/** One line of an option, a step or an entry, with its emphasis (main's `ItemLine`). */
@Composable
fun ItemLine(
    text: String,
    modifier: Modifier = Modifier,
    style: TextStyle = LocalTextStyle.current,
) {
    val segments = remember(text) { parseItemLine(text) }
    RichTextLine(richText(segments), modifier, style)
}

/** The question itself, with its math, as a TalkBack heading; quiet once it's graded. */
@Composable
fun QuestionTitle(
    text: String,
    modifier: Modifier = Modifier,
    graded: Boolean = false,
) {
    val style = MaterialTheme.typography.titleLarge
    RichText(
        text = text,
        modifier = modifier.semantics { heading() },
        style = if (graded) style.copy(color = MaterialTheme.colorScheme.onSurfaceVariant) else style,
    )
}

internal fun parseItemText(text: String): List<ItemBlock> {
    val lines = text.split(LINE_END)
    val blocks = mutableListOf<ItemBlock>()
    var index = 0

    while (index < lines.size) {
        if (lines[index].isBlank()) {
            index++
            continue
        }

        val read = readMarkdownTable(lines, index)
        if (read != null) {
            blocks +=
                ItemBlock.Table(
                    align = read.table.align,
                    header = read.table.header.map(::parseInline),
                    rows = read.table.rows.map { row -> row.map(::parseInline) },
                )
            index = read.end
            continue
        }

        var end = index + 1
        while (end < lines.size && lines[end].isNotBlank() && readMarkdownTable(lines, end) == null) end++
        val paragraph = lines.subList(index, end).map { parseInline(it.trim()) }
        blocks += ItemBlock.Paragraph(paragraph.flatMapIndexed { line, segments -> if (line == 0) segments else listOf(BREAK) + segments })
        index = end
    }

    return blocks
}

internal fun parseItemLine(text: String): List<RichSegment> = parseInline(text.trim().replace(LINE_BREAKS, " "))

/** An option's words without their marks, for TalkBack labels and "Right answer: …" lines. */
fun plainItemLine(text: String): String = parseItemLine(text).joinToString("") { it.text }

private fun parseInline(text: String): List<RichSegment> =
    parseInlineMarkup(text).map { markup ->
        when (markup.kind) {
            MarkupKind.Code -> RichSegment(SegmentKind.Code, markup.text)
            MarkupKind.Bold -> RichSegment(SegmentKind.Bold, keepAmountsTogether(markup.text))
            MarkupKind.Italic -> RichSegment(SegmentKind.Italic, keepAmountsTogether(markup.text))
            MarkupKind.Text -> RichSegment(SegmentKind.Text, keepAmountsTogether(markup.text))
        }
    }

/** "R$ 5" and "5 %" never break between the sign and the amount. */
private fun keepAmountsTogether(text: String): String =
    text
        .replace(SIGN_THEN_AMOUNT, "$1$NO_BREAK_SPACE")
        .replace(AMOUNT_THEN_SIGN, "$1$NO_BREAK_SPACE")

private val LINE_END = Regex("\\r?\n")
private val LINE_BREAKS = Regex("\\s*\\r?\\n\\s*")
private val SIGN_THEN_AMOUNT = Regex("(\\p{Sc})[ \\t](?=\\d)")
private val AMOUNT_THEN_SIGN = Regex("(\\d)[ \\t](?=[\\p{Sc}%])")
private val BREAK = RichSegment(SegmentKind.Text, "\n")
private const val NO_BREAK_SPACE = '\u00A0'

/** One line of [this] style, so a symbol beside it grows with the font. */
@Composable
internal fun TextStyle.lineHeightDp(): Dp = with(LocalDensity.current) { lineHeight.toDp() }
