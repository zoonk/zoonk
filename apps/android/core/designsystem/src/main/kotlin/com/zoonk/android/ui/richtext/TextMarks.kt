package com.zoonk.android.ui.richtext

import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.style.ResolvedTextDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.isSpecified
import androidx.compose.ui.unit.sp
import kotlin.math.PI
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.pow
import kotlin.math.sin

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

/** A mark's part on one line: its edges, its baseline, and whether the line reads right to left. */
internal data class LineSpan(
    val left: Float,
    val right: Float,
    val baseline: Float,
    val rtl: Boolean = false,
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
        LineSpan(
            minOf(first.left, final.left),
            maxOf(first.right, final.right),
            getLineBaseline(line),
            getParagraphDirection(from) == ResolvedTextDirection.Rtl,
        )
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
        val spans = layout.lineSpans(mark.start, mark.end)
        when (mark.kind) {
            TextMarkKind.Highlight -> spans.forEach { drawHighlight(it, em, highlight) }
            TextMarkKind.Underline -> drawUnderline(underlineStroke(spans, em), em, ink)
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

/** The pen's two passes under a phrase, as points on each line it covers. */
internal class UnderlineStroke(
    val pen: List<List<Offset>>,
    val echo: List<List<Offset>>,
)

/**
 * A pen's underline, as the concept draws it ("Lousa"): one wavy stroke just under the descenders
 * and a thinner pass under it. Each pass is one line along the whole phrase whose waves keep their
 * length at the text's size, so a phrase that wraps gives each line its slice of the same stroke,
 * never a whole squiggle squeezed into a short word. The pen lifts with a small curl only where the
 * phrase ends, never at a line break.
 */
internal fun underlineStroke(
    spans: List<LineSpan>,
    em: Float,
): UnderlineStroke {
    val length = spans.sumOf { (it.right - it.left).toDouble() }.toFloat()
    val curl = minOf(em * CURL_LENGTH, length / 3)

    return UnderlineStroke(
        pen =
            alongPhrase(spans, em, trim = 0f) { at ->
                val lift = if (at > length - curl) em * CURL_LIFT * ((at - (length - curl)) / curl).pow(2) else 0f
                em * (PEN_DROP + PEN_SWAY * sin(TAU * at / (em * PEN_WAVE)) + PEN_RIPPLE * sin(TAU * at / (em * RIPPLE_WAVE) + 1.3f)) - lift
            },
        echo =
            alongPhrase(
                spans,
                em,
                trim = em * ECHO_TRIM,
            ) { at -> em * (ECHO_DROP + ECHO_SWAY * sin(TAU * at / (em * ECHO_WAVE) + 2.1f)) },
    )
}

/**
 * Points every [em] / 6 along the phrase, read as one line across [spans] and kept [trim] away from
 * its two ends, with [depth] giving how far below the baseline the stroke runs at each distance.
 */
private fun alongPhrase(
    spans: List<LineSpan>,
    em: Float,
    trim: Float,
    depth: (Float) -> Float,
): List<List<Offset>> {
    val length = spans.sumOf { (it.right - it.left).toDouble() }.toFloat()
    val step = em / 6
    val starts = spans.runningFold(0f) { start, span -> start + span.right - span.left }

    return spans.zip(starts).mapNotNull { (span, start) ->
        val from = maxOf(start, trim)
        val to = minOf(start + span.right - span.left, length - trim)
        if (to <= from) return@mapNotNull null
        val between = (floor(from / step).toInt() + 1..ceil(to / step).toInt() - 1).map { it * step }

        (listOf(from) + between + to).map { at ->
            Offset(if (span.rtl) span.right - (at - start) else span.left + (at - start), span.baseline + depth(at))
        }
    }
}

private fun DrawScope.drawUnderline(
    stroke: UnderlineStroke,
    em: Float,
    color: Color,
) {
    val width = maxOf(em * UNDERLINE_WIDTH, 1.5.dp.toPx())
    val echo = color.copy(alpha = color.alpha * UNDERLINE_ECHO_ALPHA)
    stroke.pen.forEach { drawPath(it.toPath(), color, style = Stroke(width, cap = StrokeCap.Round, join = StrokeJoin.Round)) }
    stroke.echo.forEach {
        drawPath(it.toPath(), echo, style = Stroke(maxOf(width / 2, 1.dp.toPx()), cap = StrokeCap.Round, join = StrokeJoin.Round))
    }
}

private fun List<Offset>.toPath() =
    Path().apply {
        moveTo(first().x, first().y)
        drop(1).forEach { lineTo(it.x, it.y) }
    }

private const val HIGHLIGHT_ABOVE = 0.9f
private const val HIGHLIGHT_BELOW = 0.28f
private const val HIGHLIGHT_OUTSET = 0.12f
private const val HIGHLIGHT_CORNER = 0.25f
private const val TAU = 2 * PI.toFloat()

// In ems: the pen's height below the baseline, its sway and the length of one wave, with a faster
// ripple over it as a hand's; the curl's length and lift; the echo pass likewise, trimmed at the ends.
private const val PEN_DROP = 0.27f
private const val PEN_SWAY = 0.05f
private const val PEN_WAVE = 9f
private const val PEN_RIPPLE = 0.015f
private const val RIPPLE_WAVE = 3.7f
private const val CURL_LENGTH = 0.7f
private const val CURL_LIFT = 0.16f
private const val ECHO_DROP = 0.4f
private const val ECHO_SWAY = 0.03f
private const val ECHO_WAVE = 13f
private const val ECHO_TRIM = 0.35f
private const val UNDERLINE_WIDTH = 0.12f
private const val UNDERLINE_ECHO_ALPHA = 0.65f
