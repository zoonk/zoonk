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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import com.zoonk.android.R
import com.zoonk.android.feature.writing.MinimumLegend
import com.zoonk.android.feature.writing.PointsReadout
import com.zoonk.android.feature.writing.RangeMeter
import com.zoonk.android.feature.writing.deductionRange
import com.zoonk.android.feature.writing.formatPoints
import com.zoonk.android.feature.writing.minimumShare
import com.zoonk.android.feature.writing.pointsRange
import com.zoonk.android.ui.components.ButtonSize
import com.zoonk.android.ui.components.Eyebrow
import com.zoonk.android.ui.components.MeterPart
import com.zoonk.android.ui.components.MeterParts
import com.zoonk.android.ui.components.ModalBottomSheet
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.components.rememberExpandedBottomSheetState
import com.zoonk.android.ui.components.stepHeading
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.factsLine
import com.zoonk.android.ui.format.formatPercent
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.android.ui.theme.zoonkType
import com.zoonk.api.models.WritingPromptOutput
import com.zoonk.api.models.WritingRangeOutput
import com.zoonk.api.models.WritingResultOutputOneOf1
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
    note: (@Composable () -> Unit)? = null,
) {
    val step = remember(grade, text) { grade.nextStep(text) }
    Column(verticalArrangement = Arrangement.spacedBy(40.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(24.dp)) {
            // A heading, not a chip: one chip sits over a title, and the next step has its own.
            if (eyebrow != null || note != null) {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    eyebrow?.let { SectionHeader(it) }
                    note?.invoke()
                }
            }
            grade.points?.let { PointsHeader(it, grade, prompt, text) }
            WritingProgress(grade)
            WritingNextStep(step, prompt.lines?.toInt(), headingFirst = grade.points == null)
        }
        WritingCriteria(grade, prompt)
        WritingMarkedText(grade, (step as? NextStep.Criterion)?.quote, prompt.lines?.toInt(), text)
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
    val part = prompt.partMinimum
    val partMax = part?.max
    val percent = part?.minimum?.unit?.value == "percent"
    val share = part?.let { minimumShare(percent, it.minimum.value, it.max) }
    val partPoints = if (percent) partMax?.let { share?.times(it) } else part?.minimum?.value
    val sameScale = partMax == points.max
    val decimals = points.decimals

    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Eyebrow(stringResource(R.string.essay_your_answer))
            Column(
                Modifier.semantics(mergeDescendants = true) { heading() }.stepHeading(),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                PointsReadout(points.total.low, points.total.high, points.max, decimals = decimals)
                Text(
                    stringResource(R.string.essay_estimated_score),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            RangeMeter(points.total.low, points.total.high, points.max, minimumShare = share.takeIf { sameScale })
            val locale = currentLocale()
            val label =
                when {
                    !sameScale && partPoints != null -> {
                        val minimum = formatPoints(partPoints, locale)
                        if (partMax == null) {
                            stringResource(R.string.essay_part_minimum_points, minimum)
                        } else {
                            stringResource(R.string.essay_part_minimum_total, minimum, formatPoints(partMax, locale))
                        }
                    }

                    share != null -> {
                        stringResource(R.string.essay_part_minimum, formatPercent(share, locale))
                    }

                    else -> {
                        null
                    }
                }
            if (label != null) {
                if (sameScale) {
                    MinimumLegend(label)
                } else {
                    Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
                }
            }
        }
        val zero = points.zeroReason
        if (zero != null) {
            Text(zero, style = MaterialTheme.typography.bodyLarge)
        } else {
            Column {
                PartRow(
                    stringResource(R.string.essay_content),
                    detail = null,
                    value = pointsRange(points.content.low, points.content.high, decimals),
                )
                HorizontalDivider()
                PartRow(
                    stringResource(R.string.essay_language_errors),
                    detail =
                        factsLine(
                            pluralStringResource(R.plurals.essay_errors, errorCount, errorCount),
                            prompt.lines?.let { limit ->
                                pluralStringResource(R.plurals.essay_lines_used, limit.toInt(), lines, limit.toInt())
                            }
                                ?: pluralStringResource(R.plurals.essay_about_lines, lines, lines),
                        ),
                    // The scale's decimals don't reach the deduction, which reads in tenths: "−0.3 to −0.6".
                    value = deductionRange(points.deduction.low, points.deduction.high),
                )
            }
        }
    }
}

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
        Text(value, style = MaterialTheme.zoonkType.data)
    }
}

/** What a rewrite changed, by criterion: only after a second version, and never a zeroed one's, which no criterion explains. */
@Composable
private fun WritingProgress(grade: WritingGrade) {
    if (grade.zeroed) return
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

/**
 * The one thing to work on, the same card for every rubric's result; it's the step's heading when
 * no total leads. Every criterion complete and every line read: no chip says there's a next step.
 */
@Composable
private fun WritingNextStep(
    step: NextStep,
    lines: Int?,
    headingFirst: Boolean,
) {
    val heading = if (headingFirst) Modifier.stepHeading() else Modifier
    val (title, text) =
        when (step) {
            NextStep.Done -> {
                stringResource(R.string.essay_nothing_left) to stringResource(R.string.essay_full_marks)
            }

            NextStep.Limit -> {
                if (lines != null) {
                    pluralStringResource(R.plurals.essay_limit_title, lines, lines) to stringResource(R.string.essay_limit_text, lines)
                } else {
                    stringResource(R.string.essay_limit_title_any) to stringResource(R.string.essay_limit_text_any)
                }
            }

            NextStep.Short -> {
                stringResource(R.string.essay_short_title) to stringResource(R.string.essay_short_text)
            }

            is NextStep.Zero -> {
                zeroStep(step.zeroKind) ?: (
                    stringResource(R.string.essay_zero_title) to step.text.ifEmpty { stringResource(R.string.essay_zero_text) }
                )
            }

            is NextStep.Criterion -> {
                (step.title ?: stringResource(R.string.essay_what_to_rewrite)) to step.text
            }
        }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (step != NextStep.Done) Eyebrow(stringResource(R.string.essay_next_step))
            Text(title, heading.semantics { heading() }, style = MaterialTheme.typography.headlineSmall)
        }
        if (step == NextStep.Done) {
            Text(text, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyLarge)
            return
        }
        (step as? NextStep.Criterion)?.quote?.let { QuotedLine(it, MaterialTheme.zoonk.warning) }
        Text(text, style = MaterialTheme.typography.bodyLarge)
        (step as? NextStep.Criterion)?.example?.let {
            Text(
                stringResource(R.string.essay_for_example, it),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
    }
}

/** A zeroed answer's next step, by the rule it broke: the notice's rule shows above it, so this says what to do. */
@Composable
private fun zeroStep(kind: WritingResultOutputOneOf1.ZeroKind?): Pair<String, String>? =
    when (kind) {
        WritingResultOutputOneOf1.ZeroKind.BLANK -> {
            stringResource(R.string.essay_zero_blank_title) to stringResource(R.string.essay_zero_blank_text)
        }

        WritingResultOutputOneOf1.ZeroKind.OFF_TOPIC -> {
            stringResource(R.string.essay_zero_title) to stringResource(R.string.essay_zero_off_topic_text)
        }

        WritingResultOutputOneOf1.ZeroKind.WRONG_FORM -> {
            stringResource(R.string.essay_zero_wrong_form_title) to stringResource(R.string.essay_zero_wrong_form_text)
        }

        WritingResultOutputOneOf1.ZeroKind.TOO_FEW_LINES -> {
            stringResource(R.string.essay_zero_too_few_lines_title) to stringResource(R.string.essay_zero_too_few_lines_text)
        }

        WritingResultOutputOneOf1.ZeroKind.COPIED_SUPPORT -> {
            stringResource(R.string.essay_zero_copied_support_title) to stringResource(R.string.essay_zero_copied_support_text)
        }

        WritingResultOutputOneOf1.ZeroKind.IDENTIFICATION -> {
            stringResource(R.string.essay_zero_identification_title) to stringResource(R.string.essay_zero_identification_text)
        }

        null -> {
            null
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

/** A criterion's points: what's sure in full, what the range leaves open in light. */
@Composable
private fun RowMeter(
    range: WritingRangeOutput,
    max: Double,
) {
    val ink = MaterialTheme.colorScheme.onSurface
    val low = if (max > 0) (range.low / max).toFloat().coerceIn(0f, 1f) else 0f
    val high = if (max > 0) (range.high / max).toFloat().coerceIn(low, 1f) else 0f
    MeterParts(
        listOfNotNull(
            MeterPart(MeterPart.Fill.Solid(ink), low).takeIf { low > 0f },
            MeterPart(MeterPart.Fill.Solid(ink.copy(alpha = OPEN_ALPHA)), high - low).takeIf { high > low },
            MeterPart(MeterPart.Fill.Track, 1f - high).takeIf { high < 1f },
        ),
        Modifier.width(64.dp),
    )
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
                        val decimals = row.decimals?.toInt() ?: grade.points.decimals
                        val range = row.range ?: WritingRangeOutput(high = row.earned, low = row.earned)
                        RowMeter(range, row.max)
                        Text(
                            stringResource(
                                R.string.essay_score_of,
                                pointsRange(range.low, range.high, decimals),
                                formatPoints(row.max, locale, decimals),
                            ),
                            Modifier.sizeIn(minWidth = 64.dp),
                            textAlign = TextAlign.End,
                            style = MaterialTheme.zoonkType.data,
                        )
                    } else {
                        LevelCells(criterion.level)
                        Text(
                            level,
                            Modifier.sizeIn(minWidth = 64.dp),
                            textAlign = TextAlign.End,
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
            sheetState = rememberExpandedBottomSheetState(),
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

/** The learner's text as sent, each language error marked and numbered, and what graders wouldn't read set apart. */
@Composable
private fun WritingMarkedText(
    grade: WritingGrade,
    stepQuote: String?,
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
        remember(grade, stepQuote, text, errorStyle, stepStyle, ignoredStyle) {
            markText(grade, stepQuote, text, errorStyle, stepStyle, ignoredStyle, numberStyle)
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
    stepQuote: String?,
    text: String,
    errorStyle: SpanStyle,
    stepStyle: SpanStyle,
    ignoredStyle: SpanStyle,
    numberStyle: SpanStyle,
): MarkedText {
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

/**
 * A line limit falls inside a word as often as not; the word it splits is shown as past it, whole.
 * A limit on the space after a word leaves that word where the grader read it.
 */
internal fun wordStart(
    text: String,
    offset: Int,
): Int {
    if (offset >= text.length || text[offset].isWhitespace()) return offset
    var start = offset
    while (start > 0 && !text[start - 1].isWhitespace()) start--
    return start
}

private const val LEVEL_CELLS = 4
private const val ERROR_TINT = 0.1f
private const val OPEN_ALPHA = 0.3f
