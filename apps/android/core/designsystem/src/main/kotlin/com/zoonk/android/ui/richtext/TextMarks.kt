package com.zoonk.android.ui.richtext

import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.isSpecified
import androidx.compose.ui.unit.sp

/** A pen mark on lesson text: the highlighter (a quoted sentence, a teaching screen's term) or a hand-drawn underline. */
internal enum class TextMarkKind(
    val tag: String,
) {
    Highlight("zoonk.highlight"),
    Underline("zoonk.underline"),
}

internal data class TextMark(
    val kind: TextMarkKind,
    val start: Int,
    val end: Int,
)

/** Highlights first, so an underline inside a highlighted run draws over it. */
internal fun textMarks(text: AnnotatedString): List<TextMark> =
    TextMarkKind.entries.flatMap { kind ->
        text.getStringAnnotations(kind.tag, 0, text.length).map { TextMark(kind, it.start, it.end) }
    }

private data class LineSpan(
    val left: Float,
    val right: Float,
    val baseline: Float,
)

/** A mark's part on each line it covers, so it follows the text across line breaks. */
private fun TextLayoutResult.lineSpans(
    start: Int,
    end: Int,
): List<LineSpan> {
    if (end <= start || start >= layoutInput.text.length) return emptyList()
    val last = end.coerceAtMost(layoutInput.text.length) - 1

    return (getLineForOffset(start)..getLineForOffset(last)).mapNotNull { line ->
        val from = maxOf(start, getLineStart(line))
        val to = minOf(last, getLineEnd(line, visibleEnd = true) - 1)
        if (to < from) return@mapNotNull null
        val first = getBoundingBox(from)
        val final = getBoundingBox(to)
        LineSpan(minOf(first.left, final.left), maxOf(first.right, final.right), getLineBaseline(line))
    }
}

internal fun DrawScope.drawTextMarks(
    layout: TextLayoutResult,
    marks: List<TextMark>,
    highlight: Color,
    ink: Color,
) {
    val fontSize = layout.layoutInput.style.fontSize
    val em = (if (fontSize.isSpecified) fontSize else 16.sp).toPx()

    marks.forEach { mark ->
        layout.lineSpans(mark.start, mark.end).forEach { span ->
            when (mark.kind) {
                TextMarkKind.Highlight -> drawHighlight(span, em, highlight)
                TextMarkKind.Underline -> drawUnderline(span, em, ink)
            }
        }
    }
}

/** A marker stroke from the cap height to below the baseline, a little past the words, with soft corners. */
private fun DrawScope.drawHighlight(
    span: LineSpan,
    em: Float,
    color: Color,
) {
    val outset = em * HIGHLIGHT_OUTSET
    val top = span.baseline - em * HIGHLIGHT_ABOVE
    drawRoundRect(
        color = color,
        topLeft = Offset(span.left - outset, top),
        size = Size(span.right - span.left + outset * 2, span.baseline + em * HIGHLIGHT_BELOW - top),
        cornerRadius = CornerRadius(em * HIGHLIGHT_CORNER),
    )
}

/**
 * A pen's underline: one wavy stroke just under the descenders and a thinner one under it, as the
 * concept draws it ("Lousa"), stretched to the words' width and sized by the text.
 */
private fun DrawScope.drawUnderline(
    span: LineSpan,
    em: Float,
    color: Color,
) {
    val width = span.right - span.left

    fun x(at: Float) = span.left + width * at

    fun y(at: Float) = span.baseline + em * (UNDERLINE_TOP + at * UNDERLINE_DEPTH)

    val main =
        Path().apply {
            moveTo(x(0.01f), y(0.62f))
            cubicTo(x(0.15f), y(0.38f), x(0.31f), y(0.75f), x(0.49f), y(0.54f))
            cubicTo(x(0.67f), y(0.33f), x(0.84f), y(0.38f), x(0.99f), y(0.58f))
        }
    val second =
        Path().apply {
            moveTo(x(0.04f), y(0.83f))
            cubicTo(x(0.26f), y(0.67f), x(0.61f), y(0.88f), x(0.96f), y(0.75f))
        }

    drawPath(main, color, style = Stroke(maxOf(em * UNDERLINE_WIDTH, 1.5.dp.toPx()), cap = StrokeCap.Round))
    drawPath(
        second,
        color.copy(alpha = color.alpha * UNDERLINE_ECHO_ALPHA),
        style = Stroke(maxOf(em * UNDERLINE_WIDTH / 2, 1.dp.toPx()), cap = StrokeCap.Round),
    )
}

private const val HIGHLIGHT_ABOVE = 0.9f
private const val HIGHLIGHT_BELOW = 0.28f
private const val HIGHLIGHT_OUTSET = 0.12f
private const val HIGHLIGHT_CORNER = 0.25f
private const val UNDERLINE_TOP = 0.06f
private const val UNDERLINE_DEPTH = 0.42f
private const val UNDERLINE_WIDTH = 0.12f
private const val UNDERLINE_ECHO_ALPHA = 0.65f
