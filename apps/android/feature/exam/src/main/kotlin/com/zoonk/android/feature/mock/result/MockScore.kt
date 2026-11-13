package com.zoonk.android.feature.mock.result

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
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
import com.zoonk.android.ui.components.Readout
import com.zoonk.android.ui.components.StatTile
import com.zoonk.android.ui.components.StatTiles
import com.zoonk.android.ui.components.StatTone
import com.zoonk.android.ui.components.color
import com.zoonk.android.ui.components.stepHeading
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.format.languageName
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.MockExam
import com.zoonk.api.models.MockResult
import com.zoonk.api.models.MockResultAreasInner
import kotlin.math.roundToInt

/**
 * Main's score step: how it went in one number and one sentence, the day's moment, the subjects,
 * and the two small ways on: [details] and, where the review isn't inline, [answers].
 */
@Composable
internal fun ScoreStep(
    view: MockExam,
    result: MockResult,
    dayMoment: @Composable () -> Unit,
    breakdown: @Composable () -> Unit,
    details: (@Composable () -> Unit)?,
    answers: (@Composable () -> Unit)?,
    review: (@Composable () -> Unit)?,
) {
    val missed = missedMinimum(result.points)
    val verdict = verdict(result).takeIf { missed == null }

    Column(verticalArrangement = Arrangement.spacedBy(24.dp)) {
        ScoreHeader(view, result, missed)
        verdict?.let { Text(it, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium) }
        // A miss's headline isn't followed by a celebration; the day's summary still shows the belt.
        if (missed == null) dayMoment()
    }
    breakdown()
    if (details != null || answers != null) {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            details?.invoke()
            answers?.invoke()
        }
    }
    review?.invoke()
}

/** Main's `MockResultDetails`: every count, table and caveat behind the score, for the learner who asks. */
@Composable
internal fun ScoreDetails(
    view: MockExam,
    result: MockResult,
    about: List<String>,
) {
    Column(verticalArrangement = Arrangement.spacedBy(32.dp)) {
        if (answerCounts(result) != null) {
            ResultSection(stringResource(R.string.mock_result_answers)) { AnswerTiles(result) }
        }
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
    answerCounts(result) != null ||
        hasTestRows(result.points) ||
        view.passMarks != null ||
        hasInsights(result) ||
        about.isNotEmpty() ||
        view.sizeSource.pastEdition != null

private fun areaMeasure(area: MockResultAreasInner): Double = area.score?.score ?: if (area.total > 0) area.correct / area.total else 0.0

/** One sentence on what the number means for the learner's next days, or nothing. */
@Composable
private fun verdict(result: MockResult): String? {
    if (reachedEveryMinimum(result.points)) return stringResource(R.string.mock_result_every_minimum)
    val ranked = result.areas.sortedByDescending(::areaMeasure)
    val best = ranked.firstOrNull() ?: return null
    val worst = ranked.last()
    if (areaMeasure(best) == areaMeasure(worst)) return null
    return stringResource(R.string.mock_result_strongest, best.name, worst.name)
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
            Score(
                stringResource(R.string.mock_result_right_answers),
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
            Text(mockTitle(view.number), color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.titleMedium)
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

@Composable
private fun AnswerTiles(result: MockResult) {
    val counts = answerCounts(result) ?: return
    val blankNote = result.net == null && result.blank > 0
    val locale = currentLocale()

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        counts.let {
            val tiles =
                listOfNotNull<@Composable (Modifier) -> Unit>(
                    { modifier ->
                        AnswerTile(
                            R.string.mock_result_right,
                            formatNumber(it.right, locale),
                            R.drawable.ic_check,
                            StatTone.Success.color,
                            modifier,
                        )
                    },
                    { modifier ->
                        AnswerTile(
                            R.string.mock_result_wrong,
                            formatNumber(it.wrong, locale),
                            R.drawable.ic_close,
                            MaterialTheme.colorScheme.error,
                            modifier,
                        )
                    },
                    if (it.partial > 0) {
                        { modifier ->
                            AnswerTile(
                                R.string.mock_result_partly_right,
                                formatNumber(it.partial.toDouble(), locale),
                                R.drawable.ic_radio_button_partial,
                                StatTone.Neutral.color,
                                modifier,
                            )
                        }
                    } else {
                        null
                    },
                    { modifier ->
                        AnswerTile(
                            R.string.mock_result_blank,
                            formatNumber(it.blank.toDouble(), locale),
                            R.drawable.ic_remove,
                            StatTone.Neutral.color,
                            modifier,
                        )
                    },
                )
            StatTiles(columns = tiles.size, tiles = tiles)
        }
        if (blankNote) NoteLines(listOf(stringResource(R.string.mock_result_blank_wrong)))
    }
}

@Composable
private fun AnswerTile(
    label: Int,
    value: String,
    icon: Int,
    tint: Color,
    modifier: Modifier,
) {
    StatTile(
        label = stringResource(label),
        value = value,
        modifier = modifier,
        icon = { iconModifier -> Icon(painterResource(icon), contentDescription = null, modifier = iconModifier, tint = tint) },
    )
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
