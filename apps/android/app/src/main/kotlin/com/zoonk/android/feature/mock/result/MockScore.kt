package com.zoonk.android.feature.mock.result

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.intl.LocaleList
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.mock.chooser.MockNotes
import com.zoonk.android.feature.mock.mockTitle
import com.zoonk.android.ui.components.Readout
import com.zoonk.android.ui.components.StatTile
import com.zoonk.android.ui.components.StatTiles
import com.zoonk.android.ui.components.StatTone
import com.zoonk.android.ui.components.color
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.ExamDocument
import com.zoonk.api.models.MockExam
import com.zoonk.api.models.MockResult
import com.zoonk.api.models.MockScoreNotes
import java.util.Locale
import kotlin.math.roundToInt

@Composable
internal fun ScoreStep(
    view: MockExam,
    result: MockResult,
    review: @Composable () -> Unit,
) {
    ScoreHeader(view, result)
    AnswerTiles(result)
    PassMarks(view)
    NoteLines(scoreNoteLines(view.scoreNotes))
    MockDayMoment(view.ceremony, view.missionMoment, view.reached)
    if (hasBreakdown(result)) Breakdown(result)
    if (hasInsights(result)) Insights(result)
    review()
    MockNotes(
        document = view.examDocument,
        source = view.sizeSource,
        questions = view.questions,
        minutes = view.minutes,
        leftOut = view.leftOut,
        short = shortLine(view),
        namesWrittenInFull = true,
    )
}

/** A [range] reads as one number, so its dash keeps the numbers' size. */
private data class Score(
    val label: String,
    val value: String,
    val range: Boolean = false,
)

@Composable
private fun score(result: MockResult): Score {
    val locale = currentLocale()
    val irt = result.irt
    val net = result.net

    return when {
        irt != null -> Score(stringResource(R.string.mock_result_estimated_score), scoreRange(irt.low, irt.high), range = true)
        net != null -> Score(stringResource(R.string.mock_result_net_score, net.max.toInt()), formatNumber(net.net, locale))
        else -> Score(stringResource(R.string.mock_result_right_answers), rightOf(result.correct, result.total))
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
) {
    val score = score(result)
    val areas =
        if (result.areas.size > MAX_NAMED_AREAS) {
            pluralStringResource(R.plurals.mock_result_subjects, result.areas.size, result.areas.size)
        } else {
            result.areas.joinToString(", ") { it.name }
        }
    val detail = listOf(score.label, view.examName.orEmpty(), areas).filter { it.isNotEmpty() }.joinToString(" · ")

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Column(Modifier.semantics(mergeDescendants = true) { heading() }, verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                stringResource(R.string.mock_result_done, mockTitle(view.number)),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.titleMedium,
            )
            if (score.range) ScoreRange(score.value) else Readout(score.value, style = MaterialTheme.typography.displayMedium)
        }
        Text(detail, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
        Delta(result)
    }
}

/** The change since the last mock, for scores on the exam's scale or net of penalties. */
@Composable
private fun Delta(result: MockResult) {
    val current = result.irt?.score ?: result.net?.net ?: return
    val previous = result.previous ?: return
    val change = (current - previous).roundToInt()
    if (change == 0) return
    val number = formatNumber(change.toDouble(), currentLocale())

    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(
            painterResource(if (change > 0) R.drawable.ic_trending_up else R.drawable.ic_trending_down),
            contentDescription = null,
            modifier = Modifier.size(16.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(
            if (change > 0) stringResource(R.string.mock_result_up, number) else stringResource(R.string.mock_result_down, number),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.labelLarge.withTabularFigures(),
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
    val counts = answerCounts(result)
    val blankNote = result.net == null && result.blank > 0
    if (counts == null && !blankNote) return
    val locale = currentLocale()

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        counts?.let {
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
            // Each tile keeps its label whole, at any font size: fewer to a row where they'd squeeze.
            BoxWithConstraints {
                val tileWidth = with(LocalDensity.current) { MIN_TILE_WIDTH.toPx() * fontScale }
                val fit = (constraints.maxWidth / tileWidth).toInt()
                StatTiles(columns = fit.coerceIn(1, tiles.size), tiles = tiles)
            }
        }
        if (blankNote) {
            NoteLines(
                listOf(
                    stringResource(if (result.irt != null) R.string.mock_result_blank_exam_day else R.string.mock_result_blank_this_score),
                ),
            )
        }
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

    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        HorizontalDivider()
        Text(
            stringResource(
                if (view.examDocument ==
                    ExamDocument.GUIDE
                ) {
                    R.string.mock_result_to_pass_guide
                } else {
                    R.string.mock_result_to_pass_notice
                },
            ),
            Modifier.semantics { heading() },
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.Medium,
        )
        marks.texts.forEach {
            Text(
                AnnotatedString(it, SpanStyle(localeList = LocaleList(marks.language))),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
        if (marks.language != locale.language) {
            val language = Locale.forLanguageTag(marks.language).getDisplayLanguage(locale).ifEmpty { marks.language }
            Text(
                stringResource(R.string.mock_result_pass_marks_language, language),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
    }
}

@Composable
private fun scoreNoteLines(notes: MockScoreNotes): List<String> {
    val locale = currentLocale()
    val scale = notes.scale
    val unconverted = scale != null && scale.score == null

    return listOfNotNull(
        scale?.let {
            val min = formatNumber(it.min, locale)
            val max = formatNumber(it.max, locale)
            val name = it.name
            val shown = it.score?.let { score -> formatNumber(score, locale) }
            when {
                shown == null && name != null -> stringResource(R.string.mock_result_scale_named, name, min, max)
                shown == null -> stringResource(R.string.mock_result_scale, min, max)
                name != null -> stringResource(R.string.mock_result_scale_score_named, shown, name, min, max)
                else -> stringResource(R.string.mock_result_scale_score, shown, min, max)
            }
        },
        scale?.passScore?.let { stringResource(R.string.mock_result_pass_score, formatNumber(it, locale)) },
        notes.noticeScoring?.let { stringResource(R.string.mock_result_notice_scoring, it) },
        stringResource(R.string.mock_result_relative).takeIf { notes.relative },
        stringResource(R.string.mock_result_shows_right).takeIf { notes.noticeScoring != null || notes.relative || unconverted },
    )
}

@Composable
private fun shortLine(view: MockExam): String? {
    val examQuestions = view.examQuestions?.takeIf { it > view.questions } ?: return null
    val questions = view.questions.toInt()
    return pluralStringResource(R.plurals.mock_short, questions, questions, examQuestions.toInt())
}

@Composable
internal fun NoteLines(lines: List<String>) {
    if (lines.isEmpty()) return
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        lines.forEach { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall) }
    }
}

private const val MAX_NAMED_AREAS = 3
private val MIN_TILE_WIDTH = 104.dp
