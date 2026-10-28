package com.zoonk.android.ui.richtext

import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalConfiguration
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
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.core.os.ConfigurationCompat
import java.util.Locale

/**
 * Lesson text with paragraphs, short lists and tables of data, as the step contract allows, and
 * the `mark` sentence highlighted where the text shows it (main's `RichTextBlocks`). Paragraphs
 * take `style` (the surrounding `LocalTextStyle` by default); tables use the smaller body size.
 */
@Composable
fun RichText(
    text: String,
    modifier: Modifier = Modifier,
    mark: String? = null,
    style: TextStyle = LocalTextStyle.current,
) {
    val locale = currentLocale()
    val blocks =
        remember(text, mark, locale) {
            val parsed = parseRichBlocks(text)
            (if (mark.isNullOrEmpty()) parsed else markRichBlocks(parsed, mark)).map { typesetBlock(it, locale) }
        }

    Column(modifier, verticalArrangement = Arrangement.spacedBy(BLOCK_GAP)) {
        blocks.forEach { block ->
            when (block) {
                is RichBlock.Paragraph -> {
                    RichLines(block.lines, style)
                }

                is RichBlock.ListBlock -> {
                    RichList(block, style)
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
 * `mark` sentence highlighted when the line shows it (main's `LessonRichText`).
 */
@Composable
fun RichInlineText(
    text: String,
    modifier: Modifier = Modifier,
    mark: String? = null,
    style: TextStyle = LocalTextStyle.current,
) {
    val locale = currentLocale()
    val segments =
        remember(text, mark, locale) {
            val parsed = parseRichInline(toOneLine(text))
            typeset(if (mark.isNullOrEmpty()) parsed else markRichInline(parsed, mark), locale)
        }

    RichTextLine(richText(segments), modifier, style)
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
@ReadOnlyComposable
private fun currentLocale(): Locale = ConfigurationCompat.getLocales(LocalConfiguration.current)[0] ?: Locale.ROOT

@Composable
internal fun rememberMathWords(): MathWords {
    val resources = LocalResources.current
    return remember(resources) { MathWords.from(resources) }
}

@Immutable
internal data class SpokenText(
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

/** The design system's highlighter for a sentence the screen points at, under the text's own color. */
private val markColor: Color
    @Composable @ReadOnlyComposable
    get() = MaterialTheme.colorScheme.tertiaryContainer

@Composable
internal fun richText(segments: List<RichSegment>): SpokenText {
    val words = rememberMathWords()
    val codeBackground = MaterialTheme.colorScheme.surfaceContainerHigh
    val mark = markColor

    return remember(segments, words, codeBackground, mark) {
        var hasMath = false
        val spoken = StringBuilder()
        var markFrom: Int? = null

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
                    // One highlight per marked run, so it spans a whole sentence.
                    val from = markFrom
                    if (segment.marked && from == null) markFrom = start
                    if (!segment.marked && from != null) {
                        addStyle(SpanStyle(background = mark), from, start)
                        markFrom = null
                    }
                }

                markFrom?.let { addStyle(SpanStyle(background = mark), it, length) }
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
) {
    val segments = lines.flatMapIndexed { index, line -> if (index == 0) line else listOf(LINE_BREAK) + line }

    if (segments.none { it.kind == SegmentKind.DisplayMath }) {
        RichTextLine(richText(segments), Modifier, style)
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
                RichTextLine(richText(part), Modifier, style)
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
internal fun RichTextLine(
    text: SpokenText,
    modifier: Modifier,
    style: TextStyle,
) {
    val spoken = text.spoken

    Text(
        text = text.text,
        modifier = if (spoken == null) modifier else modifier.semantics { contentDescription = spoken },
        style = style,
    )
}

@Composable
private fun DisplayMath(
    math: TypesetMath,
    modifier: Modifier,
    style: TextStyle,
) {
    Box(modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), contentAlignment = Alignment.Center) {
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
                    style = style.copy(fontFeatureSettings = "tnum"),
                    textAlign = TextAlign.End,
                )

                RichTextLine(richText(item), Modifier.weight(1f).alignByBaseline(), style)
            }
        }
    }
}
