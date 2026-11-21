package com.zoonk.android.feature.essay

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.VerticalDivider
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.BaselineShift
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import com.zoonk.android.R
import com.zoonk.android.feature.writing.PointsReadout
import com.zoonk.android.feature.writing.RangeMeter
import com.zoonk.android.feature.writing.deductionRange
import com.zoonk.android.feature.writing.formatPoints
import com.zoonk.android.feature.writing.pointsRange
import com.zoonk.android.ui.components.ButtonSize
import com.zoonk.android.ui.components.Eyebrow
import com.zoonk.android.ui.components.Meter
import com.zoonk.android.ui.components.ModalBottomSheet
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.components.stepHeading
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.factsLine
import com.zoonk.android.ui.format.formatPercent
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.models.WritingPromptOutput
import com.zoonk.api.models.WritingResultOutputOneOfCriteriaInner

/**
 * A graded written answer: with a scale, the range, its parts and the passage to rewrite; without
 * one, no total, the one change that helps most and a level per criterion. Then the text as sent.
 */
@Composable
internal fun WritingResultView(
    grade: WritingGrade,
    prompt: WritingPromptOutput,
    text: String,
    eyebrow: String? = null,
) {
    Column(verticalArrangement = Arrangement.spacedBy(40.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(24.dp)) {
            eyebrow?.let { Eyebrow(it) }
            grade.points?.let { PointsHeader(it, grade, prompt, text) }
            WritingProgress(grade)
            WritingNextStep(grade, headingFirst = grade.points == null)
        }
        WritingCriteria(grade, prompt)
        WritingMarkedText(grade, prompt.lines?.toInt(), text)
    }
}

/** The total as a range on the question's scale, then what it's made of, so the parts never contradict it. */
@Composable
private fun PointsHeader(
    points: WritingPoints,
    grade: WritingGrade,
    prompt: WritingPromptOutput,
    text: String,
) {
    val errorCount = grade.errors.size
    val lines = grade.estimatedLines ?: countWritingLines(text, prompt.charactersPerLine.toInt(), prompt.lines?.toInt()).estimated
    val partMinimum = prompt.partMinimum?.let { part -> minimumShare(part.minimum.unit.value, part.minimum.value, part.max) }

    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Column(Modifier.semantics(mergeDescendants = true) { heading() }.stepHeading(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                stringResource(R.string.essay_your_answer),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.labelMedium,
            )
            PointsReadout(points.total.low, points.total.high, points.max)
        }
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            RangeMeter(points.total.low, points.total.high, points.max, minimum = partMinimum?.let { it * points.max })
            prompt.partMinimum?.let { part -> partMinimumLine(part.minimum.unit.value, part.minimum.value, part.max) }?.let { line ->
                Text(
                    line,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        }
        val zero = points.zeroReason
        if (zero != null) {
            Text(zero, style = MaterialTheme.typography.bodyLarge)
        } else {
            Column {
                PartRow(stringResource(R.string.essay_content), detail = null, value = pointsRange(points.content.low, points.content.high))
                HorizontalDivider()
                PartRow(
                    stringResource(R.string.essay_language_errors),
                    detail =
                        factsLine(
                            pluralStringResource(R.plurals.essay_errors, errorCount, errorCount),
                            prompt.lines?.let { limit -> stringResource(R.string.essay_lines_used, lines, limit.toInt()) }
                                ?: pluralStringResource(R.plurals.essay_about_lines, lines, lines),
                        ),
                    value = deductionRange(points.deduction.low, points.deduction.high),
                )
            }
        }
    }
}

/** The written test's minimum as a share of its points, drawn at the same share of this question's. */
private fun minimumShare(
    unit: String,
    value: Double,
    max: Double?,
): Double? =
    when {
        unit == "percent" -> value / PERCENT
        max != null && max > 0 -> value / max
        else -> null
    }?.coerceIn(0.0, 1.0)

/** Named as the written test's, never as this question's: CGU asks half the points on the sum of both questions. */
@Composable
private fun partMinimumLine(
    unit: String,
    value: Double,
    max: Double?,
): String? = minimumShare(unit, value, max)?.let { stringResource(R.string.essay_part_minimum, formatPercent(it, currentLocale())) }

@Composable
private fun PartRow(
    name: String,
    detail: String?,
    value: String,
) {
    Row(
        Modifier.fillMaxWidth().padding(vertical = 12.dp).semantics(mergeDescendants = true) {},
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(name, style = MaterialTheme.typography.bodyMedium)
            detail?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall) }
        }
        Text(value, style = MaterialTheme.typography.labelMedium.withTabularFigures())
    }
}

/** What a rewrite changed, by criterion: only after a second version. */
@Composable
private fun WritingProgress(grade: WritingGrade) {
    val fixed = grade.progress?.fixed.orEmpty()
    val persists = grade.progress?.persists.orEmpty()
    if (fixed.isEmpty() && persists.isEmpty()) return

    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        if (fixed.isNotEmpty()) {
            Text(
                stringResource(R.string.essay_fixed, fixed.joinToString(", ") { grade.criterionName(it) }),
                style = MaterialTheme.typography.bodyMedium,
            )
        }
        if (persists.isNotEmpty()) {
            Text(
                stringResource(R.string.essay_still_to_work_on, persists.joinToString(", ") { grade.criterionName(it) }),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
    }
}

/** The one thing to work on, the same card for every rubric's result; it's the step's heading when no total leads. */
@Composable
private fun WritingNextStep(
    grade: WritingGrade,
    headingFirst: Boolean,
) {
    val nextStep = grade.nextStep
    val heading = if (headingFirst) Modifier.stepHeading() else Modifier

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Eyebrow(stringResource(R.string.essay_next_step))
            Text(
                nextStep?.let {
                    grade.criteria.firstOrNull { it.id == nextStep.criterionId }?.name
                        ?: stringResource(R.string.essay_what_to_rewrite)
                }
                    ?: stringResource(R.string.essay_nothing_left),
                heading.semantics { heading() },
                style = MaterialTheme.typography.headlineSmall,
            )
        }
        if (nextStep == null) {
            Text(
                stringResource(R.string.essay_full_marks),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyLarge,
            )
            return
        }
        nextStep.quote?.let { QuotedLine(it, MaterialTheme.zoonk.warning) }
        Text(nextStep.text, style = MaterialTheme.typography.bodyLarge)
        nextStep.example?.let {
            Text(
                stringResource(R.string.essay_for_example, it),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
    }
}

@Composable
private fun QuotedLine(
    text: String,
    rule: Color,
) {
    Row(Modifier.height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        VerticalDivider(Modifier.fillMaxHeight(), thickness = 2.dp, color = rule)
        Text(text, fontStyle = FontStyle.Italic, style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
private fun levelName(level: WritingResultOutputOneOfCriteriaInner.Level): String =
    stringResource(
        when (level) {
            WritingResultOutputOneOfCriteriaInner.Level.COMPLETE -> R.string.essay_level_complete
            WritingResultOutputOneOfCriteriaInner.Level.STRONG -> R.string.essay_level_strong
            WritingResultOutputOneOfCriteriaInner.Level.PARTIAL -> R.string.essay_level_partial
            WritingResultOutputOneOfCriteriaInner.Level.MISSING -> R.string.essay_level_missing
        },
    )

private val WritingResultOutputOneOfCriteriaInner.Level.cells: Int
    get() =
        when (this) {
            WritingResultOutputOneOfCriteriaInner.Level.COMPLETE -> 4
            WritingResultOutputOneOfCriteriaInner.Level.STRONG -> 3
            WritingResultOutputOneOfCriteriaInner.Level.PARTIAL -> 2
            WritingResultOutputOneOfCriteriaInner.Level.MISSING -> 0
        }

/** A level as four small cells, so it reads at a glance and never by color alone: its name stands beside it. */
@Composable
private fun LevelCells(level: WritingResultOutputOneOfCriteriaInner.Level) {
    val filled = MaterialTheme.colorScheme.tertiary
    val empty = MaterialTheme.colorScheme.surfaceContainerHighest
    Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
        repeat(LEVEL_CELLS) { index ->
            Box(Modifier.size(8.dp).clip(RoundedCornerShape(2.dp)).background(if (index < level.cells) filled else empty))
        }
    }
}

@Composable
private fun criteriaSource(
    grade: WritingGrade,
    prompt: WritingPromptOutput,
): String? =
    when {
        grade.points == null && prompt.criteria.all { it.points == null } -> stringResource(R.string.essay_no_points_in_notice)
        grade.points == null -> null
        prompt.keySource == WritingPromptOutput.KeySource.NOTICE -> stringResource(R.string.essay_criteria_from_notice)
        else -> stringResource(R.string.essay_criteria_from_notice_practice_key)
    }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun WritingCriteria(
    grade: WritingGrade,
    prompt: WritingPromptOutput,
) {
    val locale = currentLocale()
    var comments by rememberSaveable { mutableStateOf(false) }
    val source = criteriaSource(grade, prompt)

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SectionHeader(stringResource(R.string.essay_criteria))
        Column {
            grade.criteria.forEachIndexed { index, criterion ->
                if (index > 0) HorizontalDivider()
                val row = grade.points?.rows?.firstOrNull { it.id == criterion.id }
                val level = levelName(criterion.level)
                Row(
                    Modifier
                        .fillMaxWidth()
                        .padding(vertical = 12.dp)
                        .semantics(mergeDescendants = true) { if (row == null) stateDescription = level },
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(criterion.name, Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
                    if (row != null) {
                        Meter((if (row.max > 0) row.earned / row.max else 0.0).toFloat(), Modifier.width(64.dp))
                        Text(
                            stringResource(R.string.essay_score_of, formatPoints(row.earned, locale), formatPoints(row.max, locale)),
                            Modifier.sizeIn(minWidth = 64.dp),
                            style = MaterialTheme.typography.labelMedium.withTabularFigures(),
                        )
                    } else {
                        LevelCells(criterion.level)
                        Text(
                            level,
                            Modifier.sizeIn(minWidth = 64.dp),
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                }
            }
        }
        OutlinedButton(onClick = { comments = true }, size = ButtonSize.Small) { Text(stringResource(R.string.essay_see_comments)) }
        source?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall) }
    }

    if (comments) {
        ModalBottomSheet(
            onDismissRequest = { comments = false },
            sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        ) {
            SheetColumn {
                Text(stringResource(R.string.essay_comments), Modifier.semantics { heading() }, style = MaterialTheme.typography.titleLarge)
                grade.criteria.forEach { criterion ->
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(
                            criterion.name,
                            Modifier.semantics { heading() },
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.SemiBold,
                        )
                        criterion.quote?.let { QuotedLine(it, MaterialTheme.colorScheme.outlineVariant) }
                        Text(criterion.comment, style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }
        }
    }
}

/** The learner's text as sent, each language error marked and numbered, and what the board wouldn't read set apart. */
@Composable
private fun WritingMarkedText(
    grade: WritingGrade,
    lines: Int?,
    text: String,
) {
    val errors = grade.errors.size
    val errorStyle =
        SpanStyle(
            background = MaterialTheme.colorScheme.error.copy(alpha = ERROR_TINT),
            textDecoration = TextDecoration.Underline,
        )
    val stepStyle = SpanStyle(textDecoration = TextDecoration.Underline, color = MaterialTheme.zoonk.warningText)
    val ignoredStyle = SpanStyle(textDecoration = TextDecoration.LineThrough, color = MaterialTheme.colorScheme.onSurfaceVariant)
    val numberStyle =
        SpanStyle(
            baselineShift = BaselineShift.Superscript,
            fontSize = 0.7.em,
            color = MaterialTheme.colorScheme.error,
            fontWeight = FontWeight.Medium,
        )
    val ignoredFrom = grade.ignoredFrom?.let { wordStart(text, it.coerceIn(0, text.length)) }
    val marked =
        remember(grade, text, errorStyle, stepStyle, ignoredStyle) {
            markText(grade, text, errorStyle, stepStyle, ignoredStyle, numberStyle)
        }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SectionHeader(
            stringResource(R.string.essay_your_text),
            detail = if (errors > 0) pluralStringResource(R.plurals.essay_errors, errors, errors) else null,
        )
        val readable = ignoredFrom?.let { marked.subSequence(0, marked.offsetOf(it)) } ?: marked.text
        Text(readable, style = MaterialTheme.typography.bodyLarge)
        ignoredFrom?.let {
            Text(
                if (lines != null) stringResource(R.string.essay_past_line, lines) else stringResource(R.string.essay_past_limit),
                color = MaterialTheme.zoonk.warningText,
                style = MaterialTheme.typography.labelMedium,
            )
            Text(marked.subSequence(marked.offsetOf(it), marked.length), style = MaterialTheme.typography.bodyLarge)
        }
        if (errors > 0) {
            Column {
                grade.errors.forEachIndexed { index, error ->
                    if (index > 0) HorizontalDivider()
                    Row(
                        Modifier.fillMaxWidth().padding(vertical = 12.dp).semantics(mergeDescendants = true) {},
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Box(
                            Modifier.size(20.dp).border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(4.dp)),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                "${index + 1}",
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                style = MaterialTheme.typography.labelSmall.withTabularFigures(),
                            )
                        }
                        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            Text(error.correction, style = MaterialTheme.typography.bodyMedium)
                            Text(
                                stringResource(R.string.essay_you_wrote, error.quote, error.kind),
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                style = MaterialTheme.typography.bodySmall,
                            )
                        }
                    }
                }
            }
        }
    }
}

/** A marked text and where each of its source offsets landed, since an error's number adds characters after it. */
private class MarkedText(
    val text: AnnotatedString,
    private val offsets: IntArray,
) {
    val length: Int get() = text.length

    fun offsetOf(source: Int): Int = offsets[source.coerceIn(0, offsets.size - 1)]

    fun subSequence(
        start: Int,
        end: Int,
    ): AnnotatedString = text.subSequence(start, end)
}

/**
 * Cuts the text where an error, the passage to rewrite or what's past the limit starts or ends, and
 * numbers each error after its last piece. Offsets are UTF-16 code units into the saved text, as the
 * grade's `start` and `ignoredFrom`.
 */
private fun markText(
    grade: WritingGrade,
    text: String,
    errorStyle: SpanStyle,
    stepStyle: SpanStyle,
    ignoredStyle: SpanStyle,
    numberStyle: SpanStyle,
): MarkedText {
    val stepQuote = grade.nextStep?.quote?.takeIf { it.isNotEmpty() }
    val stepRange = stepQuote?.let { quote -> text.indexOf(quote).takeIf { it >= 0 }?.let { it until it + quote.length } }
    val ignoredFrom = grade.ignoredFrom?.let { wordStart(text, it.coerceIn(0, text.length)) } ?: text.length
    val errors = grade.errors.map { it.start.toInt().coerceIn(0, text.length) until minOf(text.length, it.start.toInt() + it.quote.length) }
    val cuts =
        (
            listOf(0, text.length, ignoredFrom) + errors.flatMap { listOf(it.first, it.last + 1) } +
                listOfNotNull(stepRange?.first, stepRange?.let { it.last + 1 })
        ).filter { it in 0..text.length }
            .distinct()
            .sorted()
    val offsets = IntArray(text.length + 1)

    val annotated =
        buildAnnotatedString {
            cuts.zipWithNext().forEach { (start, end) ->
                val error = errors.indexOfFirst { start in it }
                val styles =
                    listOfNotNull(
                        errorStyle.takeIf { error >= 0 },
                        stepStyle.takeIf { stepRange != null && start in stepRange },
                        ignoredStyle.takeIf { start >= ignoredFrom },
                    )
                for (offset in start until end) offsets[offset] = length + (offset - start)
                if (styles.isEmpty()) {
                    append(text, start, end)
                } else {
                    withStyle(styles.reduce { a, b -> a.merge(b) }) { append(text, start, end) }
                }
                if (error >= 0 && end == errors[error].last + 1) withStyle(numberStyle) { append("${error + 1}") }
            }
            offsets[text.length] = length
        }
    return MarkedText(annotated, offsets)
}

/** A line limit falls inside a word as often as not; the word it splits is shown as past it, whole. */
private fun wordStart(
    text: String,
    offset: Int,
): Int {
    var start = offset
    while (start > 0 && !text[start - 1].isWhitespace()) start--
    return start
}

private const val LEVEL_CELLS = 4
private const val PERCENT = 100.0
private const val ERROR_TINT = 0.1f
