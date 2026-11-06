package com.zoonk.android.ui.richtext

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.platform.LocalResources
import androidx.compose.ui.semantics.CollectionInfo
import androidx.compose.ui.semantics.CollectionItemInfo
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.collectionInfo
import androidx.compose.ui.semantics.collectionItemInfo
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import com.zoonk.android.ui.components.fadingHorizontalScroll
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk
import java.util.Locale

/**
 * Lesson text with paragraphs, short lists and tables of data, as the step contract allows, and
 * the `mark` sentence highlighted where the text shows it (main's `RichTextBlocks`). Paragraphs
 * take `style` (the surrounding `LocalTextStyle` by default); tables use the smaller body size.
 * `literalNumbers` keeps numbers as written, for text whose digits are characters (main's
 * `LessonRichText`). A teaching screen also draws its `underline` phrase with a hand-drawn line and,
 * with [marksTerms], its bold term on a highlighter, so the term stays bold and the marks are only
 * drawing.
 */
@Composable
fun RichText(
    text: String,
    modifier: Modifier = Modifier,
    mark: String? = null,
    style: TextStyle = LocalTextStyle.current,
    literalNumbers: Boolean = false,
    underline: String? = null,
    marksTerms: Boolean = false,
) {
    val locale = currentLocale()
    val blocks =
        remember(text, mark, underline, locale, literalNumbers) {
            val parsed = parseRichBlocks(text)
            val marked = if (mark.isNullOrEmpty()) parsed else markRichBlocks(parsed, mark)
            val underlined = if (underline.isNullOrEmpty()) marked else underlineRichBlocks(marked, underline)
            if (literalNumbers) underlined else underlined.map { typesetBlock(it, locale) }
        }

    Column(modifier, verticalArrangement = Arrangement.spacedBy(BLOCK_GAP)) {
        blocks.forEach { block ->
            when (block) {
                is RichBlock.Paragraph -> {
                    RichLines(block.lines, style, marksTerms)
                }

                is RichBlock.ListBlock -> {
                    RichList(block, style, marksTerms)
                }

                is RichBlock.Table -> {
                    RichTable(
                        block.align,
                        block.header.map { richText(it) },
                        block.rows.map { row ->
                            row.map { richText(it) }
                        },
                    )
                }
            }
        }
    }
}

/**
 * One line of lesson text (a question, an option, a label) with its emphasis and math, and the
 * `mark` sentence highlighted when the line shows it (main's `LessonRichText`). Past [maxLines] it
 * ends in an ellipsis.
 */
@Composable
fun RichInlineText(
    text: String,
    modifier: Modifier = Modifier,
    mark: String? = null,
    style: TextStyle = LocalTextStyle.current,
    maxLines: Int = Int.MAX_VALUE,
) {
    val locale = currentLocale()
    val segments =
        remember(text, mark, locale) {
            val parsed = parseRichInline(toOneLine(text))
            typeset(if (mark.isNullOrEmpty()) parsed else markRichInline(parsed, mark), locale)
        }

    RichTextLine(richText(segments), modifier, style, maxLines)
}

/**
 * A formula on its own, such as a worked example's `math` (main draws these as display math):
 * typeset as text, centered, and scrolling sideways when it's wider than the screen. TalkBack reads
 * it in words ("1 over 4").
 */
@Composable
fun MathText(
    latex: String,
    modifier: Modifier = Modifier,
    style: TextStyle = LocalTextStyle.current,
) {
    val words = rememberMathWords()
    val math = remember(latex, words) { typesetMath(latex, words) }
    DisplayMath(math, modifier, style)
}

private val BLOCK_GAP = 12.dp
private val ITEM_GAP = 6.dp
private val MARKER_WIDTH = 20.dp
private val MARKER_GAP = 4.dp

private const val CODE_SIZE = 0.85f

@Composable
fun rememberMathWords(): MathWords {
    val resources = LocalResources.current
    return remember(resources) { MathWords.from(resources) }
}

@Immutable
data class SpokenText(
    val text: AnnotatedString,
    val spoken: String? = null,
)

private fun typeset(
    segments: List<RichSegment>,
    locale: Locale,
): List<RichSegment> =
    segments.map {
        when (it.kind) {
            SegmentKind.Math, SegmentKind.DisplayMath, SegmentKind.Code -> it
            else -> it.copy(text = typesetNumbers(locale, it.text))
        }
    }

private fun typesetBlock(
    block: RichBlock,
    locale: Locale,
): RichBlock =
    when (block) {
        is RichBlock.Paragraph -> {
            block.copy(lines = block.lines.map { typeset(it, locale) })
        }

        is RichBlock.ListBlock -> {
            block.copy(items = block.items.map { typeset(it, locale) })
        }

        is RichBlock.Table -> {
            block.copy(
                header = block.header.map { typeset(it, locale) },
                rows =
                    block.rows.map { row ->
                        row.map { typeset(it, locale) }
                    },
            )
        }
    }

/** Main's `bg-warning/15`. */
private const val MARK_ALPHA = 0.15f

/** [marksTerms] puts bold runs, a teaching screen's new term, on the highlighter. */
@Composable
fun richText(
    segments: List<RichSegment>,
    marksTerms: Boolean = false,
): SpokenText {
    val words = rememberMathWords()
    val codeBackground = MaterialTheme.colorScheme.surfaceContainerHigh

    return remember(segments, words, codeBackground, marksTerms) {
        var hasMath = false
        val spoken = StringBuilder()
        var markFrom: Int? = null
        var underlineFrom: Int? = null

        val text =
            buildAnnotatedString {
                segments.forEach { segment ->
                    val start = length

                    when (segment.kind) {
                        SegmentKind.Math, SegmentKind.DisplayMath -> {
                            val math = typesetMath(segment.text, words)
                            hasMath = true
                            append(math.text)
                            spoken.append(math.spoken)
                        }

                        SegmentKind.Bold -> {
                            withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append(segment.text) }
                            if (marksTerms) addStringAnnotation(TextMarkKind.Highlight.tag, "", start, length)
                        }

                        SegmentKind.Italic -> {
                            withStyle(SpanStyle(fontStyle = FontStyle.Italic)) { append(segment.text) }
                        }

                        SegmentKind.Code -> {
                            withStyle(SpanStyle(fontFamily = FontFamily.Monospace, fontSize = CODE_SIZE.em, background = codeBackground)) {
                                append(segment.text)
                            }
                        }

                        SegmentKind.Text -> {
                            append(segment.text)
                        }
                    }

                    if (segment.kind != SegmentKind.Math && segment.kind != SegmentKind.DisplayMath) spoken.append(segment.text)
                    // One mark per marked run, so it spans a whole sentence or phrase.
                    val from = markFrom
                    if (segment.marked && from == null) markFrom = start
                    if (!segment.marked && from != null) {
                        addStringAnnotation(TextMarkKind.Highlight.tag, "", from, start)
                        markFrom = null
                    }
                    val underlineStart = underlineFrom
                    if (segment.underlined && underlineStart == null) underlineFrom = start
                    if (!segment.underlined && underlineStart != null) {
                        addStringAnnotation(TextMarkKind.Underline.tag, "", underlineStart, start)
                        underlineFrom = null
                    }
                }

                markFrom?.let { addStringAnnotation(TextMarkKind.Highlight.tag, "", it, length) }
                underlineFrom?.let { addStringAnnotation(TextMarkKind.Underline.tag, "", it, length) }
            }

        SpokenText(text, if (hasMath) spoken.toString() else null)
    }
}

private val LINE_BREAK = RichSegment(SegmentKind.Text, "\n")

/**
 * A paragraph's lines, each on its own line. A display formula (`$$…$$`) stands on its own line,
 * centered, between the text around it, as main draws it.
 */
@Composable
private fun RichLines(
    lines: List<List<RichSegment>>,
    style: TextStyle,
    marksTerms: Boolean,
) {
    val segments = lines.flatMapIndexed { index, line -> if (index == 0) line else listOf(LINE_BREAK) + line }

    if (segments.none { it.kind == SegmentKind.DisplayMath }) {
        RichTextLine(richText(segments, marksTerms), Modifier, style)
        return
    }

    val words = rememberMathWords()
    val parts = remember(segments) { splitAtDisplayMath(segments) }

    Column(verticalArrangement = Arrangement.spacedBy(BLOCK_GAP)) {
        parts.forEach { part ->
            if (part.size == 1 && part[0].kind == SegmentKind.DisplayMath) {
                val math = remember(part, words) { typesetMath(part[0].text, words) }
                DisplayMath(math, Modifier, style)
            } else {
                RichTextLine(richText(part, marksTerms), Modifier, style)
            }
        }
    }
}

private fun splitAtDisplayMath(segments: List<RichSegment>): List<List<RichSegment>> {
    val parts = mutableListOf<List<RichSegment>>()
    var current = mutableListOf<RichSegment>()

    fun close() {
        val trimmed =
            current
                .mapIndexed { index, segment ->
                    if (segment.kind != SegmentKind.Text) return@mapIndexed segment
                    val start = if (index == 0) segment.text.trimStart() else segment.text
                    segment.copy(text = if (index == current.lastIndex) start.trimEnd() else start)
                }.filter { it.text.isNotEmpty() }
        if (trimmed.isNotEmpty()) parts += trimmed
        current = mutableListOf()
    }

    segments.forEach { segment ->
        if (segment.kind == SegmentKind.DisplayMath) {
            close()
            parts += listOf(segment)
        } else {
            current += segment
        }
    }

    close()
    return parts
}

@Composable
fun RichTextLine(
    text: SpokenText,
    modifier: Modifier,
    style: TextStyle,
    maxLines: Int = Int.MAX_VALUE,
) {
    val spoken = text.spoken
    val marks = remember(text.text) { textMarks(text.text) }
    var layout by remember { mutableStateOf<TextLayoutResult?>(null) }
    val highlight = MaterialTheme.zoonk.warning.copy(alpha = MARK_ALPHA)
    val ink = MaterialTheme.zoonk.warning

    Text(
        text = text.text,
        modifier =
            (if (spoken == null) modifier else modifier.semantics { contentDescription = spoken })
                .then(if (marks.isEmpty()) Modifier else Modifier.drawBehind { layout?.let { drawTextMarks(it, marks, highlight, ink) } }),
        style = style,
        overflow = if (maxLines == Int.MAX_VALUE) TextOverflow.Clip else TextOverflow.Ellipsis,
        maxLines = maxLines,
        onTextLayout = { if (marks.isNotEmpty()) layout = it },
    )
}

@Composable
private fun DisplayMath(
    math: TypesetMath,
    modifier: Modifier,
    style: TextStyle,
) {
    Box(modifier.fillMaxWidth().fadingHorizontalScroll(rememberScrollState()), contentAlignment = Alignment.Center) {
        Text(
            text = math.text,
            modifier = Modifier.semantics { contentDescription = math.spoken },
            style = style,
            softWrap = false,
        )
    }
}

@Composable
private fun RichList(
    block: RichBlock.ListBlock,
    style: TextStyle,
    marksTerms: Boolean,
) {
    Column(
        modifier = Modifier.semantics { collectionInfo = CollectionInfo(rowCount = block.items.size, columnCount = 1) },
        verticalArrangement = Arrangement.spacedBy(ITEM_GAP),
    ) {
        block.items.forEachIndexed { index, item ->
            Row(
                Modifier.semantics(mergeDescendants = true) {
                    collectionItemInfo = CollectionItemInfo(rowIndex = index, rowSpan = 1, columnIndex = 0, columnSpan = 1)
                },
                horizontalArrangement = Arrangement.spacedBy(MARKER_GAP),
            ) {
                val marker = if (block.ordered) "${index + 1}." else "•"

                Text(
                    text = marker,
                    modifier =
                        Modifier
                            .widthIn(min = MARKER_WIDTH)
                            .alignByBaseline()
                            .then(if (block.ordered) Modifier else Modifier.clearAndSetSemantics {}),
                    style = style.withTabularFigures(),
                    textAlign = TextAlign.End,
                )

                RichTextLine(richText(item, marksTerms), Modifier.weight(1f).alignByBaseline(), style)
            }
        }
    }
}
