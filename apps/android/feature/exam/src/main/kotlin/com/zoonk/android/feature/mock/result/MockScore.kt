package com.zoonk.android.feature.mock.result

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.intl.LocaleList
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.mock.mockTitle
import com.zoonk.android.ui.components.Eyebrow
import com.zoonk.android.ui.components.MeterPart
import com.zoonk.android.ui.components.MeterParts
import com.zoonk.android.ui.components.Readout
import com.zoonk.android.ui.components.stepHeading
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.format.languageName
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.MockExam
import com.zoonk.api.models.MockResult
import kotlin.math.roundToInt

/**
 * Main's score step: how it went in one number and one sentence, the day's moment, then what supports
 * the number ([summary], where no aside holds it) and the questions to review.
 */
@Composable
internal fun ScoreStep(
    view: MockExam,
    result: MockResult,
    dayMoment: @Composable () -> Unit,
    summary: (@Composable () -> Unit)?,
    review: (@Composable () -> Unit)?,
) {
    val missed = missedMinimum(result.points)
    val verdict = verdict(view, result).takeIf { missed == null }

    Column(verticalArrangement = Arrangement.spacedBy(24.dp)) {
        ScoreHeader(view, result, missed)
        verdict?.let { Text(it, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium) }
        // A miss's headline isn't followed by a celebration; the day's summary still shows the belt.
        if (missed == null) dayMoment()
    }
    summary?.invoke()
    review?.invoke()
}

/** Main's `MockResultDetails`: every table and caveat behind the score, for the learner who asks. */
@Composable
internal fun ScoreDetails(
    view: MockExam,
    result: MockResult,
    about: List<String>,
) {
    Column(verticalArrangement = Arrangement.spacedBy(32.dp)) {
        result.points?.takeIf { hasTestRows(it) }?.let { PointsByTest(it) }
        PassMarks(view)
        if (hasInsights(result)) Insights(result)
        if (about.isNotEmpty() || view.sizeSource.pastEdition != null) {
            ResultSection(stringResource(R.string.mock_result_about_title)) { MockAbout(view, about) }
        }
    }
}

internal fun hasDetails(
    view: MockExam,
    result: MockResult,
    about: List<String>,
): Boolean =
    hasTestRows(result.points) ||
        view.passMarks != null ||
        hasInsights(result) ||
        about.isNotEmpty() ||
        view.sizeSource.pastEdition != null

/** One sentence on what the number means for the learner's next days, or nothing: the subjects core names. */
@Composable
private fun verdict(
    view: MockExam,
    result: MockResult,
): String? {
    if (reachedEveryMinimum(result.points)) return stringResource(R.string.mock_result_every_minimum)
    val best = view.verdict?.strongest
    val worst = view.verdict?.weakest
    return when {
        best != null && worst != null -> stringResource(R.string.mock_result_strongest, best, worst)
        best != null -> stringResource(R.string.mock_result_strongest_only, best)
        worst != null -> stringResource(R.string.mock_result_work_on, worst)
        else -> null
    }
}

/** A [range] reads as one number, so its dash keeps the numbers' size; a raw score's [lead] is its number, the rest its unit. */
private data class Score(
    val label: String,
    val value: String,
    val range: Boolean = false,
    val lead: String? = null,
)

@Composable
private fun score(
    view: MockExam,
    result: MockResult,
): Score {
    val locale = currentLocale()
    val points = result.points
    val irt = result.irt
    val net = result.net
    val exam = view.examName

    return when {
        points != null -> {
            val earned = formatNumber(points.earned, locale)
            Score(
                stringResource(R.string.mock_result_points),
                stringResource(R.string.mock_result_points_of, earned, formatNumber(points.asked, locale)),
                lead = earned,
            )
        }

        irt != null -> {
            Score(
                exam?.let { stringResource(R.string.mock_result_estimated_exam_score, it) }
                    ?: stringResource(R.string.mock_result_estimated_score),
                scoreRange(irt.low, irt.high),
                range = true,
            )
        }

        net != null -> {
            Score(stringResource(R.string.mock_result_net_score, net.max.toInt()), formatNumber(net.net, locale))
        }

        else -> {
            // Part of a point on some questions makes the count points, as the exam page's row says.
            Score(
                stringResource(if (result.correct % 1.0 == 0.0) R.string.mock_result_right_answers else R.string.mock_result_points),
                rightOf(result.correct, result.total),
                lead = formatNumber(result.correct, locale),
            )
        }
    }
}

@Composable
internal fun scoreRange(
    low: Double,
    high: Double,
): String {
    val locale = currentLocale()
    return stringResource(R.string.mock_result_range, formatNumber(low, locale), formatNumber(high, locale))
}

/** A range ("610–680") in a readout's numbers, its dash as large as they are. */
@Composable
internal fun ScoreRange(text: String) {
    Text(
        text,
        style =
            MaterialTheme.typography.displayMedium
                .withTabularFigures()
                .copy(fontWeight = FontWeight.SemiBold),
    )
}

/** "41.5 of 60": partial credit reads to the hundredth. */
@Composable
internal fun rightOf(
    correct: Double,
    total: Long,
): String = stringResource(R.string.mock_result_of, formatNumber(correct, currentLocale()), total.toInt())

@Composable
private fun ScoreHeader(
    view: MockExam,
    result: MockResult,
    missed: MissedMinimum?,
) {
    val score = score(view, result)

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Column(Modifier.semantics(mergeDescendants = true) { heading() }.stepHeading(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Eyebrow(mockTitle(view.number))
            when {
                missed != null -> {
                    Text(
                        missed.title,
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.headlineMedium,
                    )
                }

                score.range -> {
                    ScoreRange(score.value)
                }

                score.lead != null -> {
                    RightOfReadout(score.value, score.lead)
                }

                else -> {
                    Readout(score.value, style = MaterialTheme.typography.displayMedium)
                }
            }
        }
        Text(missed?.line ?: score.label, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
        if (missed == null) Delta(result)
    }
}

/** "7 of 10": the right answers are the number, "of 10" its unit, as main's `BigQuantity` draws a quantity's words. */
@Composable
private fun RightOfReadout(
    text: String,
    lead: String,
) {
    val unit =
        SpanStyle(
            fontSize = MaterialTheme.typography.labelLarge.fontSize,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            fontWeight = FontWeight.Normal,
        )
    val start = text.indexOf(lead)

    Text(
        buildAnnotatedString {
            if (start < 0) {
                append(text)
            } else {
                withStyle(unit) { append(text.substring(0, start)) }
                append(lead)
                withStyle(unit) { append(text.substring(start + lead.length)) }
            }
        },
        style =
            MaterialTheme.typography.displayMedium
                .withTabularFigures()
                .copy(fontWeight = FontWeight.SemiBold),
    )
}

/**
 * The change since the last mock, for scores on the exam's scale or net of penalties: the header's
 * quietest line. `previous` measures net answers, never points, so a points headline has none.
 */
@Composable
private fun Delta(result: MockResult) {
    if (result.points != null) return
    val current = result.irt?.score ?: result.net?.net ?: return
    val previous = result.previous ?: return
    val change = (current - previous).roundToInt()
    if (change == 0) return
    val number = formatNumber(change.toDouble(), currentLocale())
    val style = MaterialTheme.typography.bodySmall.withTabularFigures()

    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(
            painterResource(
                if (change > 0) R.drawable.ic_trending_up else R.drawable.ic_trending_down,
            ),
            contentDescription = null,
            modifier = Modifier.size(with(LocalDensity.current) { style.lineHeight.toDp() }),
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(
            if (change > 0) stringResource(R.string.mock_result_up, number) else stringResource(R.string.mock_result_down, number),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = style,
        )
    }
}

private data class AnswerCounts(
    val right: Double,
    val wrong: Double,
    val partial: Long,
    val blank: Long,
)

/** Net scores count each kind of answer; an estimated score shows them too, since blanks count as wrong there. */
private fun answerCounts(result: MockResult): AnswerCounts? {
    result.net?.let { return AnswerCounts(it.right.toDouble(), it.wrong.toDouble(), it.partial, it.blank) }
    if (result.irt == null) return null
    return AnswerCounts(result.correct, result.total - result.correct - result.blank, 0, result.blank)
}

internal fun hasAnswerCounts(result: MockResult): Boolean = answerCounts(result) != null || (result.net == null && result.blank > 0)

/** Main's `MockResultAnswers`: how the answers went as one meter, each part named with its count under it. */
@Composable
internal fun AnswerMeter(result: MockResult) {
    val counts = answerCounts(result)
    val locale = currentLocale()
    val right = MaterialTheme.colorScheme.tertiary
    val wrong = MaterialTheme.colorScheme.error
    val quiet = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        counts?.let {
            val parts =
                listOfNotNull(
                    AnswerPart(R.string.mock_result_right, it.right, right),
                    AnswerPart(R.string.mock_result_wrong, it.wrong, wrong),
                    AnswerPart(R.string.mock_result_partly_right, it.partial.toDouble(), quiet).takeIf { part -> part.count > 0 },
                    AnswerPart(R.string.mock_result_blank, it.blank.toDouble(), null),
                )
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                MeterParts(
                    parts.filter { part -> part.count > 0 }.map { part ->
                        MeterPart(part.color?.let { color -> MeterPart.Fill.Solid(color) } ?: MeterPart.Fill.Track, part.count.toFloat())
                    },
                )
                FlowRow(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    parts.forEach { part -> AnswerLegendItem(part, formatNumber(part.count, locale), quiet) }
                }
            }
        }
        if (result.net == null && result.blank > 0) NoteLines(listOf(stringResource(R.string.mock_result_blank_wrong)))
    }
}

/** A blank answer has no [color]: its part is the meter's track and its dot a ring. */
private class AnswerPart(
    val label: Int,
    val count: Double,
    val color: Color?,
)

@Composable
private fun AnswerLegendItem(
    part: AnswerPart,
    value: String,
    ring: Color,
) {
    Row(
        Modifier.semantics(mergeDescendants = true) {},
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier.size(6.dp).then(
                part.color?.let { Modifier.background(it, CircleShape) } ?: Modifier.border(1.dp, ring, CircleShape),
            ),
        )
        Text(stringResource(part.label), color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelMedium)
        Text(value, style = MaterialTheme.typography.labelMedium.withTabularFigures())
    }
}

@Composable
private fun PassMarks(view: MockExam) {
    val marks = view.passMarks ?: return
    val locale = currentLocale()

    ResultSection(stringResource(R.string.mock_result_to_pass)) {
        marks.texts.forEach {
            Text(
                AnnotatedString(it, SpanStyle(localeList = LocaleList(marks.language))),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
        if (marks.language != locale.language) {
            val language = languageName(marks.language, locale)
            Text(
                stringResource(R.string.mock_result_pass_marks_language, language),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
    }
}

@Composable
internal fun NoteLines(lines: List<String>) {
    if (lines.isEmpty()) return
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        lines.forEach { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall) }
    }
}
