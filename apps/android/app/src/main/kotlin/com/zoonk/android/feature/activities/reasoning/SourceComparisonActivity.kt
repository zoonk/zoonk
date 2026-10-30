package com.zoonk.android.feature.activities.reasoning

import androidx.annotation.DrawableRes
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withLink
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.activities.ActivityBadge
import com.zoonk.android.feature.activities.ActivityCanvas
import com.zoonk.android.feature.activities.ActivityProps
import com.zoonk.android.feature.activities.ActivityRenderer
import com.zoonk.android.feature.activities.selectionAnswer
import com.zoonk.android.feature.activities.selectionIds
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf25FieldsSourcesInner
import com.zoonk.api.models.PlayableLibraryStepAnyOfContent.PlayableLibraryStepAnyOfContentOneOf25Value as SourceComparisonContent
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOfCheck.PlayableLibraryStepAnyOfContentOneOfCheckOneOf1Value as InteractionCheckValue

val sourceComparisonRenderer =
    ActivityRenderer(
        badge = { ActivityBadge(R.string.activities_reasoning_badge_compare_sources, R.drawable.ic_view_column_2) },
        canvas = { SourceComparisonActivity(it) },
    )

private typealias Source = PlayableLibraryStepAnyOfContentOneOf25FieldsSourcesInner

private enum class PassageState { Unmarked, Marked, Correct, Incorrect, Missed }

@Composable
private fun SourceComparisonActivity(props: ActivityProps) {
    val content = (props.content as SourceComparisonContent).value
    val fields = content.fields
    var marked by rememberSaveable { mutableStateOf(props.answer.selectionIds.orEmpty()) }

    fun toggle(id: String) {
        if (props.isLocked) return
        marked = if (id in marked) marked - id else marked + id
        if (content.check is InteractionCheckValue) props.onAnswerChange(marked.takeIf { it.isNotEmpty() }?.let(::selectionAnswer))
    }

    ActivityCanvas {
        Text(fields.markPrompt, style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium))
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            fields.sources.forEachIndexed { index, source ->
                SourceCard(
                    source = source,
                    icon = if (index % 2 == 0) R.drawable.ic_history_edu else R.drawable.ic_menu_book,
                    marked = marked,
                    isChecked = props.isChecked,
                    onToggle = ::toggle,
                )
            }
        }
        if (props.isChecked) {
            val passages = fields.sources.flatMap { it.passages }
            Legend(
                found = passages.any { it.isTarget && it.id in marked },
                missed = passages.any { it.isTarget && it.id !in marked },
                wrong = passages.any { !it.isTarget && it.id in marked },
            )
        }
    }
}

@Composable
private fun SourceCard(
    source: Source,
    @DrawableRes icon: Int,
    marked: List<String>,
    isChecked: Boolean,
    onToggle: (String) -> Unit,
) {
    val accent = MaterialTheme.zoonk.vizAccent
    val citation = source.citation
    val details = listOfNotNull(citation.title, citation.publisher, citation.year?.toString()).joinToString(", ")

    Surface(
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(32.dp).clip(CircleShape).background(accent.copy(alpha = SOFT)), contentAlignment = Alignment.Center) {
                    Icon(painterResource(icon), contentDescription = null, modifier = Modifier.size(16.dp), tint = accent)
                }
                Column {
                    Text(source.author, style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold))
                    Text(source.date, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
                }
            }
            Excerpt(source, marked, isChecked, onToggle)
            val url = citation.url
            Text(
                if (url == null) {
                    buildAnnotatedString { append(details) }
                } else {
                    buildAnnotatedString {
                        withLink(
                            LinkAnnotation.Url(url.toString(), TextLinkStyles(SpanStyle(textDecoration = TextDecoration.Underline))),
                        ) { append(details) }
                    }
                },
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodySmall,
            )
        }
    }
}

/**
 * The excerpt with its passages: a tap or a key marks one. TalkBack reads the whole excerpt with
 * what's marked (and, once checked, what was marked by mistake or missed), and marks a passage
 * through its actions.
 */
@Composable
private fun Excerpt(
    source: Source,
    marked: List<String>,
    isChecked: Boolean,
    onToggle: (String) -> Unit,
) {
    val segments = remember(source) { splitExcerpt(source.excerpt, source.passages.map { ExcerptPassage(it.id, it.text) }) }
    val ranges = mutableListOf<Pair<TextRange, PassageState>>()
    val text =
        buildAnnotatedString {
            segments.forEach { segment ->
                val passage = source.passages.find { it.id == segment.passageId }
                if (passage == null) {
                    append(segment.text)
                    return@forEach
                }
                val start = length
                val state = passageState(isChecked, passage.id in marked, passage.isTarget)
                if (isChecked) {
                    append(segment.text)
                } else {
                    val link =
                        LinkAnnotation.Clickable(
                            passage.id,
                            TextLinkStyles(focusedStyle = SpanStyle(textDecoration = TextDecoration.Underline)),
                        ) { onToggle(passage.id) }
                    withLink(link) { append(segment.text) }
                }
                ranges += TextRange(start, length) to state
            }
        }
    val markedTexts = source.passages.filter { it.id in marked }.map { it.text }
    val wrongTexts = source.passages.filter { isChecked && !it.isTarget && it.id in marked }.map { it.text }
    val missedTexts = source.passages.filter { isChecked && it.isTarget && it.id !in marked }.map { it.text }
    val summary =
        listOfNotNull(
            if (markedTexts.isEmpty()) {
                stringResource(R.string.activities_reasoning_source_nothing_marked)
            } else {
                stringResource(R.string.activities_reasoning_source_you_marked, markedTexts.joinToString("; "))
            },
            wrongTexts.takeIf { it.isNotEmpty() }?.let {
                stringResource(R.string.activities_reasoning_source_wrong_passages, it.joinToString("; "))
            },
            missedTexts.takeIf { it.isNotEmpty() }?.let {
                stringResource(
                    R.string.activities_reasoning_source_missed_passages,
                    it.joinToString("; "),
                )
            },
        ).joinToString(" ")
    val markLabels = source.passages.map { stringResource(R.string.activities_reasoning_source_mark, it.text) }
    val unmarkLabels = source.passages.map { stringResource(R.string.activities_reasoning_source_unmark, it.text) }
    val colors = passageColors()
    var layout by remember { mutableStateOf<TextLayoutResult?>(null) }
    val style = MaterialTheme.typography.bodyLarge

    Text(
        text,
        modifier =
            Modifier
                .drawBehind { layout?.let { drawPassages(it, ranges, colors, style.fontSize.toPx()) } }
                .clearAndSetSemantics {
                    contentDescription = source.excerpt
                    stateDescription = summary
                    if (!isChecked) {
                        customActions =
                            source.passages.mapIndexed { index, passage ->
                                CustomAccessibilityAction(if (passage.id in marked) unmarkLabels[index] else markLabels[index]) {
                                    onToggle(passage.id)
                                    true
                                }
                            }
                    }
                },
        style = style.copy(lineHeight = style.fontSize * LINE_HEIGHT),
        onTextLayout = { layout = it },
    )
}

private fun passageState(
    isChecked: Boolean,
    isMarked: Boolean,
    isTarget: Boolean,
): PassageState =
    when {
        !isChecked -> if (isMarked) PassageState.Marked else PassageState.Unmarked
        isTarget -> if (isMarked) PassageState.Correct else PassageState.Missed
        else -> if (isMarked) PassageState.Incorrect else PassageState.Unmarked
    }

private class PassageColors(
    val unmarked: Color,
    val marked: Color,
    val correct: Color,
    val incorrect: Color,
    val missed: Color,
)

@Composable
private fun passageColors() =
    PassageColors(
        unmarked = MaterialTheme.zoonk.vizAccent,
        marked = MaterialTheme.zoonk.vizHighlight.copy(alpha = SOFT),
        correct = MaterialTheme.colorScheme.tertiaryContainer,
        incorrect = MaterialTheme.colorScheme.errorContainer,
        missed = MaterialTheme.colorScheme.onTertiaryContainer,
    )

/**
 * Main's passage marks: a dotted line under a passage to mark, a tint once marked or checked, a
 * dashed line under a missed one. A tint covers the letters, not the roomy line spacing.
 */
private fun DrawScope.drawPassages(
    layout: TextLayoutResult,
    ranges: List<Pair<TextRange, PassageState>>,
    colors: PassageColors,
    fontSize: Float,
) {
    val line = 2.dp.toPx()
    val pad = 2.dp.toPx()
    ranges.forEach { (range, state) ->
        lineSpans(layout, range).forEach { (left, right, baseline) ->
            val fill =
                when (state) {
                    PassageState.Marked -> colors.marked
                    PassageState.Correct -> colors.correct
                    PassageState.Incorrect -> colors.incorrect
                    else -> null
                }
            if (fill != null) {
                val top = baseline - fontSize * ASCENT
                drawRoundRect(
                    fill,
                    topLeft = Offset(left - pad, top - pad),
                    size = Size(right - left + 2 * pad, fontSize * (ASCENT + DESCENT) + 2 * pad),
                    cornerRadius = CornerRadius(pad),
                )
            } else {
                val y = baseline + fontSize * DESCENT + line
                val dash = if (state == PassageState.Missed) line * 2 else line
                drawLine(
                    if (state == PassageState.Missed) colors.missed else colors.unmarked,
                    Offset(left, y),
                    Offset(right, y),
                    strokeWidth = line,
                    pathEffect = PathEffect.dashPathEffect(floatArrayOf(dash, dash)),
                )
            }
        }
    }
}

private data class LineSpan(
    val left: Float,
    val right: Float,
    val baseline: Float,
)

/** Where [range]'s glyphs sit on each line it spans. */
private fun lineSpans(
    layout: TextLayoutResult,
    range: TextRange,
): List<LineSpan> =
    (layout.getLineForOffset(range.start)..layout.getLineForOffset(range.end - 1)).mapNotNull { line ->
        val from = maxOf(range.start, layout.getLineStart(line))
        val to = minOf(range.end, layout.getLineEnd(line, visibleEnd = true)) - 1
        if (to < from) return@mapNotNull null
        val boxes = (from..to).map(layout::getBoundingBox)
        LineSpan(boxes.minOf { it.left }, boxes.maxOf { it.right }, layout.getLineBaseline(line))
    }

@Composable
private fun Legend(
    found: Boolean,
    missed: Boolean,
    wrong: Boolean,
) {
    val dash = MaterialTheme.colorScheme.onTertiaryContainer

    FlowRow(
        Modifier.clearAndSetSemantics {},
        horizontalArrangement = Arrangement.spacedBy(16.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        if (found) {
            LegendEntry(
                stringResource(R.string.activities_reasoning_source_what_to_mark),
                Modifier.tint(MaterialTheme.colorScheme.tertiaryContainer),
            )
        }
        if (missed) {
            LegendEntry(
                stringResource(R.string.activities_reasoning_source_missed),
                Modifier.width(16.dp).height(2.dp).drawBehind {
                    drawLine(
                        dash,
                        Offset(0f, size.height / 2),
                        Offset(size.width, size.height / 2),
                        strokeWidth = size.height,
                        pathEffect = PathEffect.dashPathEffect(floatArrayOf(size.height * 2, size.height * 2)),
                    )
                },
            )
        }
        if (wrong) {
            LegendEntry(
                stringResource(R.string.activities_reasoning_source_wrong_mark),
                Modifier.tint(MaterialTheme.colorScheme.errorContainer),
            )
        }
    }
}

@Composable
private fun LegendEntry(
    label: String,
    swatch: Modifier,
) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Box(swatch)
        Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
    }
}

private fun Modifier.tint(color: Color) = size(width = 16.dp, height = 12.dp).clip(RoundedCornerShape(2.dp)).background(color)

private const val SOFT = 0.16f
private const val LINE_HEIGHT = 1.9f

/** Roughly how far the font's letters reach above and below the baseline, as shares of its size. */
private const val ASCENT = 0.9f
private const val DESCENT = 0.25f
