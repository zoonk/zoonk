package com.zoonk.android.ui.richtext

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withLink
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import com.zoonk.android.ui.components.fadingHorizontalScroll
import com.zoonk.android.ui.theme.GeistMono
import com.zoonk.android.ui.theme.withTabularFigures
import org.commonmark.ext.gfm.strikethrough.Strikethrough
import org.commonmark.ext.gfm.strikethrough.StrikethroughExtension
import org.commonmark.ext.gfm.tables.TableBlock
import org.commonmark.ext.gfm.tables.TableCell
import org.commonmark.ext.gfm.tables.TableRow
import org.commonmark.ext.gfm.tables.TablesExtension
import org.commonmark.node.AbstractVisitor
import org.commonmark.node.BlockQuote
import org.commonmark.node.BulletList
import org.commonmark.node.Code
import org.commonmark.node.Emphasis
import org.commonmark.node.FencedCodeBlock
import org.commonmark.node.HardLineBreak
import org.commonmark.node.Heading
import org.commonmark.node.HtmlBlock
import org.commonmark.node.HtmlInline
import org.commonmark.node.Image
import org.commonmark.node.IndentedCodeBlock
import org.commonmark.node.Link
import org.commonmark.node.ListItem
import org.commonmark.node.Node
import org.commonmark.node.OrderedList
import org.commonmark.node.Paragraph
import org.commonmark.node.SoftLineBreak
import org.commonmark.node.StrongEmphasis
import org.commonmark.node.ThematicBreak
import org.commonmark.parser.Parser
import org.commonmark.node.Text as TextNode

/**
 * A tutor's answer drawn from its Markdown, as main draws it with Streamdown: paragraphs,
 * headings, lists, quotes, code, tables and `$$…$$` math (single dollars stay text), with no
 * pictures or HTML of its own. Links open through `onOpenLink`, which decides what a link may open;
 * without it (an answer still streaming, or one whose links weren't checked), every link reads as
 * its words.
 */
@Composable
fun MarkdownText(
    markdown: String,
    modifier: Modifier = Modifier,
    onOpenLink: ((url: String) -> Unit)? = null,
    style: TextStyle = LocalTextStyle.current,
) {
    val document = remember(markdown) { parseMarkdown(markdown) }
    val open by rememberUpdatedState(onOpenLink)
    val links: ((String) -> Unit)? = if (onOpenLink == null) null else remember { { url -> open?.invoke(url) } }

    Blocks(document.root, document.formulas, links, style, modifier)
}

private val MARKDOWN = Parser.builder().extensions(listOf(TablesExtension.create(), StrikethroughExtension.create())).build()

private val BLOCK_GAP = 12.dp
private val ITEM_GAP = 6.dp
private val MARKER_WIDTH = 20.dp
private val MARKER_GAP = 4.dp
private val QUOTE_RULE = 3.dp
private val CODE_PADDING = 12.dp
private const val CODE_SIZE = 0.85f

/** Where a formula was taken out of an answer's Markdown, so its LaTeX never reads as Markdown. */
private const val FORMULA_OPEN = '\uE000'
private const val FORMULA_CLOSE = '\uE001'
internal val FORMULA = Regex("$FORMULA_OPEN(\\d+)$FORMULA_CLOSE")

/** `source` is what the writer wrote, which shows wherever Markdown reads the formula as code. */
internal data class MarkdownFormula(
    val display: Boolean,
    val latex: String,
    val source: String,
)

internal class MarkdownDocument(
    val root: Node,
    val formulas: List<MarkdownFormula>,
)

internal fun parseMarkdown(markdown: String): MarkdownDocument {
    val (text, formulas) = takeOutFormulas(markdown)
    val root = MARKDOWN.parse(text)
    root.accept(FormulasInCodeAsWritten(formulas))
    return MarkdownDocument(root, formulas)
}

private class FormulasInCodeAsWritten(
    private val formulas: List<MarkdownFormula>,
) : AbstractVisitor() {
    private fun asWritten(code: String) = FORMULA.replace(code) { formulas[it.groupValues[1].toInt()].source }

    override fun visit(code: Code) {
        code.literal = asWritten(code.literal)
    }

    override fun visit(fencedCodeBlock: FencedCodeBlock) {
        fencedCodeBlock.literal = asWritten(fencedCodeBlock.literal)
    }

    override fun visit(indentedCodeBlock: IndentedCodeBlock) {
        indentedCodeBlock.literal = asWritten(indentedCodeBlock.literal)
    }
}

private val FENCE = Regex("^ {0,3}(`{3,}|~{3,})")
private val QUOTE = Regex("^(?: {0,3}> ?)*")
private val MATH_FENCE = Regex("([ \\t]*)([$]{2,})[^$]*")

/** Blank lines and lines that open a heading, a thematic break or a list item end a paragraph. */
private val PARAGRAPH_END =
    Regex(
        "^(?:[ \\t]*$| {0,3}(?:#{1,6}(?:[ \\t]|$)|(?:-[ \\t]*){3,}$|(?:\\*[ \\t]*){3,}$|(?:_[ \\t]*){3,}$)|[ \\t]*(?:[-+*]|\\d{1,9}[.)])(?:[ \\t]|$))",
    )

private fun quoteOf(line: String): String = QUOTE.find(line)?.value.orEmpty()

private fun depthOf(line: String): Int = quoteOf(line).count { it == '>' }

private fun bodyOf(line: String): String = line.substring(quoteOf(line).length)

private fun placeholder(index: Int): String = "$FORMULA_OPEN$index$FORMULA_CLOSE"

internal fun takeOutFormulas(markdown: String): Pair<String, List<MarkdownFormula>> {
    val lines = markdown.split('\n')
    val formulas = mutableListOf<MarkdownFormula>()
    val output = mutableListOf<String>()
    val prose = mutableListOf<String>()
    var fence: String? = null
    var index = 0

    fun flushProse() {
        if (prose.isNotEmpty()) output += takeOutInline(prose.joinToString("\n"), formulas)
        prose.clear()
    }

    while (index < lines.size) {
        val line = lines[index++]
        val quote = quoteOf(line)
        val body = line.substring(quote.length)
        val marker = FENCE.find(body)?.groupValues?.get(1)
        val open = fence
        val math = MATH_FENCE.matchEntire(body)

        when {
            open != null -> {
                output += line
                if (marker != null && marker[0] == open[0] && marker.length >= open.length) fence = null
            }

            marker != null -> {
                flushProse()
                output += line
                fence = marker
            }

            math != null -> {
                flushProse()
                val (indent, dollars) = math.destructured
                val depth = depthOf(line)
                val end =
                    (index until lines.size).firstOrNull {
                        depthOf(lines[it]) < depth || closesMath(bodyOf(lines[it]), dollars.length)
                    } ?: lines.size
                val next = if (end < lines.size && depthOf(lines[end]) >= depth) end + 1 else end
                val content = lines.subList(index, end).map { bodyOf(it).withoutIndent(indent.length) }
                val source = (listOf(body.substring(indent.length)) + lines.subList(index, next)).joinToString("\n")
                // Blank lines around it make it a paragraph of its own, drawn as a block.
                output += listOf(quote.trimEnd(), quote + indent + placeholder(formulas.size), quote.trimEnd())
                formulas += MarkdownFormula(display = true, latex = content.joinToString("\n"), source = source)
                index = next
            }

            else -> {
                prose += line
            }
        }
    }

    flushProse()
    return output.joinToString("\n") to formulas
}

/** remark-math's math flow: its block runs to a fence at least as long, the end of its quote, or the end. */
private fun closesMath(
    line: String,
    length: Int,
): Boolean {
    val fence = line.trim(' ', '\t')
    return fence.length >= length && fence.all { it == '$' }
}

/** Inside a list item, the fence lines up with the item's text. */
private fun String.withoutIndent(length: Int): String = drop(take(length).takeWhile { it == ' ' || it == '\t' }.length)

/** remark-math closes `$$` like a code span: on a run of exactly as many dollars, in the same paragraph. */
private fun takeOutInline(
    text: String,
    formulas: MutableList<MarkdownFormula>,
): String {
    val output = StringBuilder()
    var index = 0

    while (index < text.length) {
        val character = text[index]

        if (character == '\\' && index + 1 < text.length) {
            output.append(character).append(text[index + 1])
            index += 2
            continue
        }

        if (character != '`' && character != '$') {
            output.append(character)
            index++
            continue
        }

        val run = runLength(text, index)
        val close = if (character == '`' || run >= 2) closingRun(text, index, run) else null
        val end = if (close == null) index + run else close + run

        if (close != null && character == '$') {
            val latex =
                text
                    .substring(index + run, close)
                    .split('\n')
                    .mapIndexed { line, part -> if (line == 0) part else bodyOf(part) }
                    .joinToString("\n")
            output.append(placeholder(formulas.size))
            formulas += MarkdownFormula(display = false, latex = unpadded(latex), source = text.substring(index, end))
        } else {
            output.append(text, index, end)
        }

        index = end
    }

    return output.toString()
}

private fun runLength(
    text: String,
    index: Int,
): Int = text.drop(index).takeWhile { it == text[index] }.length

private fun closingRun(
    text: String,
    open: Int,
    length: Int,
): Int? {
    val depth = depthOf(text.substring(text.lastIndexOf('\n', open) + 1))
    var index = open + length

    while (index < text.length) {
        when {
            text[index] == '\n' && endsParagraph(text.substring(index + 1).substringBefore('\n'), depth) -> {
                return null
            }

            text[index] != text[open] -> {
                index++
            }

            runLength(text, index) == length -> {
                return index
            }

            else -> {
                index += runLength(text, index)
            }
        }
    }

    return null
}

/** A deeper quote opens a new block; a shallower line is a lazy continuation. */
private fun endsParagraph(
    line: String,
    depth: Int,
): Boolean = depthOf(line) > depth || PARAGRAPH_END.containsMatchIn(bodyOf(line))

/** remark-math drops one space or line break from each side when both sides have one. */
private fun unpadded(latex: String): String {
    val padding = setOf(' ', '\n')
    val padded = latex.length > 2 && latex.first() in padding && latex.last() in padding && latex.any { it !in padding }
    return if (padded) latex.substring(1, latex.length - 1) else latex
}

private fun Node.children(): List<Node> = generateSequence(firstChild) { it.next }.toList()

@Composable
private fun Blocks(
    parent: Node,
    formulas: List<MarkdownFormula>,
    links: ((String) -> Unit)?,
    style: TextStyle,
    modifier: Modifier = Modifier,
    gap: Dp = BLOCK_GAP,
) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(gap)) {
        parent.children().forEach { Block(it, formulas, links, style) }
    }
}

@Composable
private fun Block(
    node: Node,
    formulas: List<MarkdownFormula>,
    links: ((String) -> Unit)?,
    style: TextStyle,
) {
    when (node) {
        is Paragraph -> {
            val formula = soleFormula(node)

            if (formula != null && formulas[formula].display) {
                MathText(formulas[formula].latex, style = style)
            } else {
                RichTextLine(inlineText(node, formulas, links), Modifier, style)
            }
        }

        is Heading -> {
            val typography = MaterialTheme.typography
            val headingStyle =
                when (node.level) {
                    1 -> typography.titleLarge
                    2 -> typography.titleMedium
                    else -> typography.titleSmall
                }
            RichTextLine(inlineText(node, formulas, links), Modifier.semantics { heading() }, headingStyle)
        }

        is BulletList, is OrderedList -> {
            MarkdownList(node, formulas, links, style)
        }

        is BlockQuote -> {
            Row(Modifier.height(IntrinsicSize.Min)) {
                Box(Modifier.width(QUOTE_RULE).fillMaxHeight().background(MaterialTheme.colorScheme.outlineVariant))
                Blocks(
                    node,
                    formulas,
                    links,
                    style.copy(color = MaterialTheme.colorScheme.onSurfaceVariant),
                    Modifier.padding(start = CODE_PADDING),
                )
            }
        }

        is FencedCodeBlock -> {
            CodeBlock(node.literal)
        }

        is IndentedCodeBlock -> {
            CodeBlock(node.literal)
        }

        is HtmlBlock -> {
            Text(node.literal.trimEnd(), style = style)
        }

        is ThematicBreak -> {
            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
        }

        is TableBlock -> {
            MarkdownTable(node, formulas, links)
        }

        else -> {
            Blocks(node, formulas, links, style)
        }
    }
}

private fun soleFormula(paragraph: Paragraph): Int? {
    val only = paragraph.firstChild as? TextNode ?: return null
    if (only.next != null) return null
    return FORMULA
        .matchEntire(only.literal.trim())
        ?.groupValues
        ?.get(1)
        ?.toInt()
}

@Composable
private fun CodeBlock(code: String) {
    Box(
        Modifier
            .fillMaxWidth()
            .clip(MaterialTheme.shapes.small)
            .background(MaterialTheme.colorScheme.surfaceContainerHigh)
            .fadingHorizontalScroll(rememberScrollState())
            .padding(CODE_PADDING),
    ) {
        Text(code.trimEnd('\n'), style = MaterialTheme.typography.bodyMedium.copy(fontFamily = GeistMono), softWrap = false)
    }
}

@Composable
private fun MarkdownList(
    list: Node,
    formulas: List<MarkdownFormula>,
    links: ((String) -> Unit)?,
    style: TextStyle,
) {
    val start = (list as? OrderedList)?.markerStartNumber ?: 1

    Column(verticalArrangement = Arrangement.spacedBy(ITEM_GAP)) {
        list.children().filterIsInstance<ListItem>().forEachIndexed { index, item ->
            Row(horizontalArrangement = Arrangement.spacedBy(MARKER_GAP)) {
                val ordered = list is OrderedList

                Text(
                    text = if (ordered) "${start + index}." else "•",
                    modifier =
                        Modifier
                            .widthIn(min = MARKER_WIDTH)
                            .alignByBaseline()
                            .then(if (ordered) Modifier else Modifier.clearAndSetSemantics {}),
                    style = style.withTabularFigures(),
                    textAlign = TextAlign.End,
                )

                Blocks(item, formulas, links, style, Modifier.weight(1f).alignByBaseline(), gap = ITEM_GAP)
            }
        }
    }
}

@Composable
private fun MarkdownTable(
    table: TableBlock,
    formulas: List<MarkdownFormula>,
    links: ((String) -> Unit)?,
) {
    val rows = table.children().flatMap { section -> section.children().filterIsInstance<TableRow>() }
    val header = rows.firstOrNull()?.children()?.filterIsInstance<TableCell>() ?: return

    val align =
        header.map {
            when (it.alignment) {
                TableCell.Alignment.LEFT -> TableAlign.Start
                TableCell.Alignment.CENTER -> TableAlign.Center
                TableCell.Alignment.RIGHT -> TableAlign.End
                null -> null
            }
        }

    val empty = SpokenText(AnnotatedString(""))

    RichTable(
        align = align,
        header = header.map { inlineText(it, formulas, links) },
        rows =
            rows.drop(1).map { row ->
                val cells = row.children().filterIsInstance<TableCell>().map { inlineText(it, formulas, links) }
                List(header.size) { cells.getOrElse(it) { empty } }
            },
    )
}

@Composable
private fun inlineText(
    block: Node,
    formulas: List<MarkdownFormula>,
    links: ((String) -> Unit)?,
): SpokenText {
    val words = rememberMathWords()
    val codeBackground = MaterialTheme.colorScheme.surfaceContainerHigh

    return remember(block, formulas, links, words, codeBackground) {
        InlineWriter(formulas, links, words, codeBackground).write(block)
    }
}

private class InlineWriter(
    private val formulas: List<MarkdownFormula>,
    private val links: ((String) -> Unit)?,
    private val words: MathWords,
    private val codeBackground: Color,
) {
    private val builder = AnnotatedString.Builder()
    private val spoken = StringBuilder()
    private var hasMath = false

    fun write(block: Node): SpokenText {
        block.children().forEach(::inline)
        return SpokenText(builder.toAnnotatedString(), if (hasMath) spoken.toString() else null)
    }

    private fun append(text: String) {
        builder.append(text)
        spoken.append(text)
    }

    private fun children(node: Node) = node.children().forEach(::inline)

    private fun inline(node: Node) {
        when (node) {
            is TextNode -> {
                text(node.literal)
            }

            is SoftLineBreak -> {
                append(" ")
            }

            is HardLineBreak -> {
                append("\n")
            }

            is Code -> {
                builder.withStyle(SpanStyle(fontFamily = GeistMono, fontSize = CODE_SIZE.em, background = codeBackground)) {
                    append(node.literal)
                }
            }

            is Emphasis -> {
                builder.withStyle(SpanStyle(fontStyle = FontStyle.Italic)) { children(node) }
            }

            is StrongEmphasis -> {
                builder.withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { children(node) }
            }

            is Strikethrough -> {
                builder.withStyle(SpanStyle(textDecoration = TextDecoration.LineThrough)) { children(node) }
            }

            is Link -> {
                link(node)
            }

            is HtmlInline -> {
                append(node.literal)
            }

            is Image -> {
                // Answers show no pictures of their own, as on main.
            }

            else -> {
                children(node)
            }
        }
    }

    private fun link(node: Link) {
        val open = links

        if (open == null) {
            children(node)
            return
        }

        val annotation =
            LinkAnnotation.Clickable(
                tag = node.destination,
                styles = TextLinkStyles(SpanStyle(textDecoration = TextDecoration.Underline)),
            ) { open(node.destination) }

        builder.withLink(annotation) { children(node) }
    }

    private fun text(literal: String) {
        var from = 0

        FORMULA.findAll(literal).forEach { match ->
            append(literal.substring(from, match.range.first))
            val math = typesetMath(formulas[match.groupValues[1].toInt()].latex, words)
            builder.append(math.text)
            spoken.append(math.spoken)
            hasMath = true
            from = match.range.last + 1
        }

        append(literal.substring(from))
    }
}
