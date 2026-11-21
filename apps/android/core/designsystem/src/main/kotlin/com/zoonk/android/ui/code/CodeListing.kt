package com.zoonk.android.ui.code

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.semantics.text
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.ParagraphStyle
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextIndent
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import com.zoonk.android.R
import com.zoonk.android.ui.components.TagUnder
import com.zoonk.android.ui.components.arrowKeyScroll
import com.zoonk.android.ui.components.fadingHorizontalScroll
import com.zoonk.android.ui.components.focusRing
import com.zoonk.android.ui.theme.LocalMoreContrast
import com.zoonk.android.ui.theme.ProvideLayoutDirection
import com.zoonk.android.ui.theme.ZoonkRadius
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.android.ui.theme.zoonkType

enum class CodeLineTone { Plain, Current, Editable, Error }

/** Where code sits: flush in an activity's card, or on its own muted panel in text (main's `CodeFrame` variants). */
enum class CodeFrameVariant { Inset, Panel }

private const val TAB_SIZE = 4

/** With no line numbers to mark a wrapped line's extra rows, they start a little further in. */
private const val SNIPPET_HANG = 2

/** A phone's column wraps a program's lines; a wider one keeps their shape and scrolls, as main does from its `sm` width. */
private val WRAPS_BELOW = 480.dp

/** Half the room between a line's number and its code; the other half pads the line's tone. */
private val NUMBER_GAP = 6.dp
private val CURRENT_MARK = 3.dp
private val PANEL_PADDING = PaddingValues(horizontal = 12.dp, vertical = 10.dp)
private const val TONE_ALPHA = 0.12f
private const val EDGE_ALPHA = 0.4f

/** Main's continuation arrow is 0.75em wide. */
private const val ARROW_SIZE = 0.75f

/** Zero width: where a wrapped line may split, invisible while it fits. */
private const val BREAK_POINT = '\u200B'

/**
 * Geist Mono has no glyph for [BREAK_POINT], so Android draws it in a fallback font, and keeps a `.`
 * or `,` right after it in that font, narrower than a column. Set in the system font, it ends the
 * mono run, and the character after it starts one of its own.
 */
private val BREAK_POINT_STYLE = SpanStyle(fontFamily = FontFamily.Default)
private const val OPENERS = "([{,"
private const val CLOSERS = ")]}"

/** Plain code takes the ink around it: [CodeFrame]'s `onSurface`, or an answer option's. */
@Immutable
data class CodeColors(
    val keyword: Color,
    val builtin: Color,
    val literal: Color,
    val comment: Color,
) {
    fun style(kind: CodeTokenKind): SpanStyle =
        when (kind) {
            CodeTokenKind.Builtin -> SpanStyle(color = builtin)
            CodeTokenKind.Comment -> SpanStyle(color = comment, fontStyle = FontStyle.Italic)
            CodeTokenKind.Keyword -> SpanStyle(color = keyword)
            CodeTokenKind.Number, CodeTokenKind.String -> SpanStyle(color = literal)
            CodeTokenKind.Plain -> SpanStyle()
        }
}

/** Main's token colors: the visualization hues' word shades, readable on any of the app's grounds. */
@Composable
fun codeColors(): CodeColors =
    CodeColors(
        keyword = MaterialTheme.zoonk.vizAccentText,
        builtin = MaterialTheme.zoonk.vizSecondaryText,
        literal = MaterialTheme.zoonk.vizHighlightText,
        comment = MaterialTheme.colorScheme.onSurfaceVariant,
    )

/**
 * Where a wrapped line of code reads best when it splits (main's `code-breaks`): before a `.`, after
 * an opening bracket or a comma, never inside an empty pair (`()`).
 */
internal fun breaksBetween(
    before: Char,
    after: Char,
): Boolean = after == '.' || (before in OPENERS && after !in CLOSERS)

private fun AnnotatedString.Builder.appendBreakPoint() {
    withStyle(BREAK_POINT_STYLE) { append(BREAK_POINT) }
}

/** [text] with its break points, for inline code in a sentence. */
fun withBreakPoints(text: String): AnnotatedString =
    buildAnnotatedString {
        text.forEachIndexed { index, char ->
            if (index > 0 && breaksBetween(text[index - 1], char)) appendBreakPoint()
            append(char)
        }
    }

/**
 * A line's colored runs, its tabs set to [TAB_SIZE] columns, with [withBreakPoints]'s break points
 * between and inside plain runs, never inside a string or a comment. A [field]'s text keeps every
 * character as typed, so its cursor maps one to one and it wraps where the field does.
 */
fun styledCodeLine(
    tokens: List<CodeToken>,
    colors: CodeColors,
    field: Boolean = false,
): AnnotatedString =
    buildAnnotatedString {
        var column = 0
        var previous: Char? = null

        tokens.forEach { token ->
            withStyle(colors.style(token.kind)) {
                token.text.forEachIndexed { index, char ->
                    val splittable = index == 0 || token.kind == CodeTokenKind.Plain
                    if (!field && splittable && previous?.let { breaksBetween(it, char) } == true) appendBreakPoint()

                    if (char == '\t' && !field) {
                        val spaces = TAB_SIZE - column % TAB_SIZE
                        append(" ".repeat(spaces))
                        column += spaces
                    } else {
                        append(char)
                        column++
                    }

                    previous = char
                }
            }
        }
    }

/** How many columns a line's leading spaces and tabs take. */
internal fun indentOf(tokens: List<CodeToken>): Int =
    codeLineText(tokens).takeWhile { it == ' ' || it == '\t' }.fold(0) { column, char ->
        if (char == '\t') column + TAB_SIZE - column % TAB_SIZE else column + 1
    }

/**
 * One column of code at [style], so a wrapped line's rows can start at its indentation. In ems, so
 * it grows with the text: Android scales large sizes in sp less than the font at a big font scale.
 */
@Composable
private fun columnWidth(style: TextStyle): TextUnit {
    val measurer = rememberTextMeasurer(cacheSize = 1)
    val density = LocalDensity.current
    return remember(style, measurer, density) {
        val width =
            measurer
                .measure("0".repeat(COLUMN_SAMPLE), style, softWrap = false)
                .size.width
                .toFloat() / COLUMN_SAMPLE
        (width / with(density) { style.fontSize.toPx() }).em
    }
}

private const val COLUMN_SAMPLE = 20

/**
 * A code line's text. Wrapped, each extra row starts at the line's own indentation plus [hang]
 * columns (an editor's "same indent"), and with [marksRows] an arrow under the line's number marks
 * each one (main's `CodeLine`). A listing measures [column] once for all its lines.
 */
@Composable
fun CodeLineText(
    tokens: List<CodeToken>,
    wraps: Boolean,
    modifier: Modifier = Modifier,
    style: TextStyle = MaterialTheme.zoonkType.code,
    hang: Int = 0,
    marksRows: Boolean = true,
    column: TextUnit = columnWidth(style),
) {
    val colors = codeColors()
    val text =
        remember(tokens, colors, column, hang) {
            val indent = indentOf(tokens) + hang
            val line = styledCodeLine(tokens, colors)
            if (indent == 0) {
                line
            } else {
                AnnotatedString
                    .Builder()
                    .apply {
                        withStyle(ParagraphStyle(textIndent = TextIndent(restLine = column * indent))) { append(line) }
                    }.toAnnotatedString()
            }
        }
    var layout by remember { mutableStateOf<TextLayoutResult?>(null) }
    val arrow = painterResource(R.drawable.ic_subdirectory_arrow_right)
    val ink = MaterialTheme.colorScheme.onSurfaceVariant
    val gap = NUMBER_GAP * 2

    Text(
        text = text,
        modifier =
            modifier.then(
                if (wraps && marksRows) {
                    Modifier.drawBehind {
                        val rows = layout ?: return@drawBehind
                        val size =
                            rows.layoutInput.style.fontSize
                                .toPx() * ARROW_SIZE
                        for (row in 1 until rows.lineCount) {
                            val top = rows.getLineTop(row) + (rows.getLineBottom(row) - rows.getLineTop(row) - size) / 2
                            translate(left = -gap.toPx() - size, top = top) {
                                with(arrow) { draw(Size(size, size), colorFilter = ColorFilter.tint(ink)) }
                            }
                        }
                    }
                } else {
                    Modifier
                },
            ),
        style = style,
        softWrap = wraps,
        onTextLayout = { layout = it },
    )
}

/**
 * A line of code after its number, which TalkBack skips; the number keeps its width across a
 * listing ([digits]) and stays clear of the line's [tone], which starts after it.
 */
@Composable
fun CodeLine(
    number: Int,
    digits: Int,
    modifier: Modifier = Modifier,
    tone: CodeLineTone = CodeLineTone.Plain,
    state: String? = null,
    style: TextStyle = MaterialTheme.zoonkType.code,
    content: @Composable RowScope.() -> Unit,
) {
    val colors = MaterialTheme.colorScheme
    val highlight = MaterialTheme.zoonk.vizHighlight
    val shape =
        if (tone == CodeLineTone.Current) {
            RoundedCornerShape(topEnd = ZoonkRadius.md, bottomEnd = ZoonkRadius.md)
        } else {
            RoundedCornerShape(ZoonkRadius.md)
        }
    val toned =
        when (tone) {
            CodeLineTone.Plain -> {
                Modifier
            }

            CodeLineTone.Current -> {
                Modifier.background(highlight.copy(alpha = TONE_ALPHA), shape).drawBehind {
                    drawRect(highlight, size = Size(CURRENT_MARK.toPx(), size.height), topLeft = Offset.Zero)
                }
            }

            CodeLineTone.Editable -> {
                val edge = if (LocalMoreContrast.current) 1f else EDGE_ALPHA
                Modifier.background(colors.surface, shape).border(1.dp, MaterialTheme.zoonk.vizAccent.copy(alpha = edge), shape)
            }

            CodeLineTone.Error -> {
                Modifier.background(MaterialTheme.zoonk.destructive.copy(alpha = TONE_ALPHA), shape)
            }
        }

    Row(
        modifier
            .fillMaxWidth()
            .then(if (state == null) Modifier else Modifier.semantics { stateDescription = state }),
    ) {
        Text(
            number.toString().padStart(digits),
            Modifier
                .alignByBaseline()
                .padding(end = NUMBER_GAP)
                .clearAndSetSemantics {},
            color = colors.onSurfaceVariant,
            style = style,
            softWrap = false,
        )
        Row(
            Modifier
                .alignByBaseline()
                .weight(1f)
                .then(toned)
                .padding(start = NUMBER_GAP, end = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            content = content,
        )
    }
}

/**
 * Lines of code under one sideways scroller. On a phone's width the lines wrap; on a wider one they
 * keep their shape and the frame scrolls, by touch and by the arrow keys, taking keyboard focus
 * while there's more to see. [wraps] decides it instead, as for code with fields in it. For
 * TalkBack it's one stop that says its [label] and then the lines as written, or, with
 * [stopPerLine], one stop per line, for a line the learner edits or one marked as the current
 * step. Code reads left to right in every language.
 */
@Composable
fun CodeFrame(
    label: String,
    modifier: Modifier = Modifier,
    variant: CodeFrameVariant = CodeFrameVariant.Inset,
    wraps: Boolean? = null,
    stopPerLine: Boolean = false,
    content: @Composable ColumnScope.(wraps: Boolean) -> Unit,
) {
    val panel = variant == CodeFrameVariant.Panel
    val shape = RoundedCornerShape(if (panel) ZoonkRadius.xl else ZoonkRadius.md)
    val scroll = rememberScrollState()
    var focused by remember { mutableStateOf(false) }

    ProvideLayoutDirection(LayoutDirection.Ltr) {
        BoxWithConstraints(
            modifier
                .fillMaxWidth()
                .semantics(
                    mergeDescendants = !stopPerLine,
                ) { if (stopPerLine) contentDescription = label else text = AnnotatedString(label) }
                .clip(shape)
                .then(if (panel) Modifier.background(MaterialTheme.colorScheme.surfaceContainerHigh) else Modifier)
                .focusRing(focused, shape),
        ) {
            val wrapped = wraps ?: (maxWidth < WRAPS_BELOW)

            Column(
                (
                    if (wrapped) {
                        Modifier.fillMaxWidth()
                    } else {
                        Modifier
                            .fadingHorizontalScroll(scroll)
                            .arrowKeyScroll(scroll) { focused = it }
                            .widthIn(min = maxWidth)
                            .width(IntrinsicSize.Max)
                    }
                ).then(if (panel) Modifier.padding(PANEL_PADDING) else Modifier),
                verticalArrangement = Arrangement.spacedBy(if (panel) 0.dp else 2.dp),
            ) {
                CompositionLocalProvider(LocalContentColor provides MaterialTheme.colorScheme.onSurface) { content(wrapped) }
            }
        }
    }
}

/** A program with its lines numbered (main's `CodeListing`). `language` is a fence's name for it, or null. */
@Composable
fun CodeListing(
    code: String,
    language: String?,
    label: String,
    modifier: Modifier = Modifier,
    variant: CodeFrameVariant = CodeFrameVariant.Inset,
    toneOf: (Int) -> CodeLineTone = { CodeLineTone.Plain },
    stateOf: (Int) -> String? = { null },
    stopPerLine: Boolean = false,
) {
    val lines = remember(code, language) { highlightCode(code, language) }
    val digits = lines.size.toString().length
    val column = columnWidth(MaterialTheme.zoonkType.code)

    CodeFrame(label, modifier, variant, stopPerLine = stopPerLine) { wraps ->
        lines.forEachIndexed { index, tokens ->
            val number = index + 1
            CodeLine(number, digits, tone = toneOf(number), state = stateOf(number)) {
                CodeLineText(tokens, wraps, Modifier.weight(1f, fill = wraps), column = column)
            }
        }
    }
}

/** A fenced block in a lesson's or a question's text, on its own panel. */
@Composable
fun CodeBlock(
    code: String,
    language: String?,
    modifier: Modifier = Modifier,
) {
    CodeListing(code, language, stringResource(R.string.richtext_code), modifier, CodeFrameVariant.Panel)
}

/**
 * Code inside something the learner presses or reads in one line, such as an answer option (main's
 * `CodeSnippet`): no panel and no line numbers, every line wrapped, its extra rows indented. An
 * option's tag goes under it, rather than squeezing the code.
 */
@Composable
fun CodeSnippet(
    code: String,
    language: String?,
    modifier: Modifier = Modifier,
) {
    val lines = remember(code, language) { highlightCode(code, language) }
    val column = columnWidth(MaterialTheme.zoonkType.code)

    ProvideLayoutDirection(LayoutDirection.Ltr) {
        Column(modifier.fillMaxWidth().then(TagUnder)) {
            lines.forEach { tokens -> CodeLineText(tokens, wraps = true, hang = SNIPPET_HANG, marksRows = false, column = column) }
        }
    }
}
