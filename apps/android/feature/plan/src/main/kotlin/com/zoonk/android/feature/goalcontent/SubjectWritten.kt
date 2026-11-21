package com.zoonk.android.feature.goalcontent

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.writing.PointsReadout
import com.zoonk.android.feature.writing.PointsValue
import com.zoonk.android.feature.writing.RangeMeter
import com.zoonk.android.feature.writing.formatPoints
import com.zoonk.android.feature.writing.minimumShare
import com.zoonk.android.feature.writing.pointsRange
import com.zoonk.android.feature.writing.toName
import com.zoonk.android.feature.writing.writingTaskName
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.factsLine
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.format.formatPercent
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonkType
import com.zoonk.api.models.SyllabusSubject
import com.zoonk.api.models.WrittenPartPoints
import com.zoonk.api.models.WrittenPartPointsMinimum
import com.zoonk.api.models.WrittenPractice
import com.zoonk.api.models.WrittenPracticeSubjectsInner
import com.zoonk.api.models.WrittenPracticeSubjectsInnerAnswersInner
import kotlinx.datetime.toJavaLocalDate
import java.util.UUID

/** The written part a subject's page is about: the subject whose areas name it. */
internal fun writtenSubject(
    practice: WrittenPractice?,
    subject: SyllabusSubject,
): WrittenPracticeSubjectsInner? = practice?.subjects?.firstOrNull { written -> subject.areas.any { it == written.points.name } }

/** A written part's page: where the learner stands in points, how the answers move, and each answer. */
internal fun LazyListScope.subjectWritten(
    written: WrittenPracticeSubjectsInner,
    openAnswer: (UUID) -> Unit,
    /** Where the learner stands leads the list, unless the aside beside it shows it. */
    standing: Boolean = true,
) {
    if (standing) item(key = "written-points", contentType = "written-points") { WrittenStanding(written) }

    val trend = written.trend.takeLast(TREND_SAMPLES)
    if (trend.isNotEmpty()) {
        sectionTitle(
            key = "written-trend-title",
            title = { stringResource(R.string.goalcontent_written_progress) },
            detail = { pluralStringResource(R.plurals.goalcontent_written_last_answers, trend.size, trend.size) },
        )
        item(key = "written-trend", contentType = "written-trend") { WrittenTrend(written) }
    }

    if (written.answers.isNotEmpty()) {
        sectionTitle(
            key = "written-answers-title",
            title = { stringResource(R.string.goalcontent_written_answers) },
            detail = { written.answers.size.toString() },
        )
        item(key = "written-answers", contentType = "written-answers") {
            val locale = currentLocale()
            Column {
                written.answers.forEachIndexed { index, answer ->
                    if (index > 0) HorizontalDivider(Modifier.padding(horizontal = PAGE_PADDING))
                    val lines = answer.lines?.toInt()
                    val estimated = answer.estimatedLines?.toInt()
                    val versions = answer.versions.toInt()
                    val criteria = answer.criteria?.takeIf { answer.range == null }
                    ListRow(
                        headline = { Text(answer.title) },
                        onClick = { openAnswer(answer.attemptId) },
                        supporting = {
                            // A levels answer's result is its own line: as a trailing value it would squeeze the title on a phone.
                            criteria?.let {
                                Text(stringResource(R.string.essay_criteria_complete, it.complete.toInt(), it.total.toInt()))
                            }
                            Text(
                                factsLine(
                                    stringResource(R.string.essay_short_exercise).takeIf {
                                        answer.unit == WrittenPracticeSubjectsInnerAnswersInner.Unit.DRILL
                                    },
                                    when {
                                        estimated != null && lines != null -> stringResource(R.string.essay_lines_used, estimated, lines)
                                        estimated != null -> pluralStringResource(R.plurals.essay_about_lines, estimated, estimated)
                                        else -> lines?.let { pluralStringResource(R.plurals.goalcontent_written_lines, it, it) }
                                    },
                                    if (versions >
                                        1
                                    ) {
                                        pluralStringResource(R.plurals.goalcontent_written_versions, versions, versions)
                                    } else {
                                        null
                                    },
                                    formatDate(answer.date.toJavaLocalDate(), locale),
                                ),
                            )
                        },
                        meta =
                            answer.range?.let {
                                {
                                    Text(
                                        pointsRange(it.low, it.high, answer.decimals?.toInt()),
                                        style = MaterialTheme.zoonkType.data,
                                    )
                                }
                            },
                    )
                }
            }
        }
    }
}

/**
 * Whether the part can be estimated in points. A server from before `scale` says so by having
 * measured something in points; otherwise answers are graded by level.
 */
private fun WrittenPracticeSubjectsInner.inPoints(): Boolean =
    scale?.let { it == WrittenPracticeSubjectsInner.Scale.POINTS } ?: (points.range != null || answers.any { it.range != null })

/** "Minimum to pass: 50 of 100", or its share of the points. */
@Composable
private fun minimumLine(points: WrittenPartPoints): String? {
    val minimum = points.minimum ?: return null
    val locale = currentLocale()
    val max = points.max
    return when {
        minimum.unit == WrittenPartPointsMinimum.Unit.PERCENT -> {
            stringResource(R.string.goalcontent_written_minimum_share, formatPercent(minimum.value / PERCENT, locale))
        }

        max != null -> {
            stringResource(R.string.goalcontent_written_minimum_of, formatPoints(minimum.value, locale), formatPoints(max, locale))
        }

        else -> {
            stringResource(R.string.goalcontent_written_minimum, formatPoints(minimum.value, locale))
        }
    }
}

/**
 * Where the learner stands on the written part: its estimated points, its own minimum and each
 * question's share of them; or, while no points estimate exists for it, how its answers are graded.
 */
@Composable
internal fun WrittenStanding(written: WrittenPracticeSubjectsInner) {
    val points = written.points
    val minimumLine = minimumLine(points)

    if (!written.inPoints()) {
        Column(
            Modifier.padding(horizontal = PAGE_PADDING).padding(top = 20.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                stringResource(R.string.goalcontent_written_levels),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
            minimumLine?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium) }
        }
        return
    }

    val max = points.max
    val range = points.range
    val decimals = (points.decimals ?: written.decimals)?.toInt()
    val share = points.minimum?.let { minimumShare(it.unit == WrittenPartPointsMinimum.Unit.PERCENT, it.value, max) }

    Column(
        Modifier.padding(horizontal = PAGE_PADDING).padding(top = 20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Column(Modifier.semantics(mergeDescendants = true) {}, verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                stringResource(R.string.goalcontent_written_estimated),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
            if (range != null && max != null) {
                PointsReadout(range.low, range.high, max, decimals = decimals)
            } else {
                Text(stringResource(R.string.essay_not_measured), style = MaterialTheme.typography.titleLarge)
            }
            max?.let { RangeMeter(range?.low, range?.high, it, minimumShare = share) }
            minimumLine?.let {
                Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
            }
        }
        Column {
            points.tasks.forEachIndexed { index, task ->
                if (index > 0) HorizontalDivider()
                Row(
                    Modifier.fillMaxWidth().padding(vertical = 12.dp).semantics(mergeDescendants = true) {},
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        writingTaskName(task.writingTask?.toName(), task.name),
                        Modifier.weight(1f),
                        style = MaterialTheme.typography.bodyMedium,
                    )
                    PointsValue(task.range?.low, task.range?.high, task.max, decimals = decimals)
                }
            }
        }
    }
}

@Composable
private fun WrittenTrend(written: WrittenPracticeSubjectsInner) {
    val samples = written.trend.takeLast(TREND_SAMPLES)
    val latest = samples.lastOrNull() ?: return
    val locale = currentLocale()
    val share = { value: Double? -> value?.let { formatPercent(it, locale) }.orEmpty() }

    Column(Modifier.padding(horizontal = PAGE_PADDING)) {
        val rows =
            listOf(
                Triple(stringResource(R.string.essay_content), samples.map { it.contentShare }, share(latest.contentShare)),
                Triple(
                    stringResource(R.string.goalcontent_written_presentation),
                    samples.map { it.presentationShare },
                    share(latest.presentationShare),
                ),
                Triple(
                    stringResource(R.string.essay_language_errors),
                    samples.map { it.errors.toDouble() },
                    pluralStringResource(R.plurals.essay_errors, latest.errors.toInt(), latest.errors.toInt()),
                ),
            ).filter { (_, values) -> values.any { it != null } }
        rows.forEachIndexed { index, (label, values, last) ->
            if (index > 0) HorizontalDivider()
            Row(
                Modifier.fillMaxWidth().padding(vertical = 12.dp).semantics(mergeDescendants = true) {},
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(label, Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
                TrendBars(values)
                Text(
                    last,
                    Modifier.sizeIn(minWidth = 64.dp),
                    textAlign = TextAlign.End,
                    style = MaterialTheme.typography.labelMedium.withTabularFigures(),
                )
            }
        }
    }
}

/** One small bar per answer, oldest first, the latest in full color. */
@Composable
private fun TrendBars(values: List<Double?>) {
    val peak = maxOf(1.0, values.maxOf { it ?: 0.0 })
    val green = MaterialTheme.colorScheme.tertiary
    val empty = MaterialTheme.colorScheme.surfaceContainerHighest

    Row(Modifier.height(BAR_HEIGHT), horizontalArrangement = Arrangement.spacedBy(2.dp), verticalAlignment = Alignment.Bottom) {
        values.forEachIndexed { index, value ->
            val color =
                when {
                    value == null -> empty
                    index == values.lastIndex -> green
                    else -> green.copy(alpha = OLDER_ALPHA)
                }
            Box(
                Modifier
                    .width(6.dp)
                    .height(BAR_HEIGHT * maxOf(MIN_BAR_SHARE, ((value ?: 0.0) / peak).toFloat()))
                    .clip(RoundedCornerShape(2.dp))
                    .background(color),
            )
        }
    }
}

private const val TREND_SAMPLES = 4
private const val PERCENT = 100.0
private const val MIN_BAR_SHARE = 0.2f
private const val OLDER_ALPHA = 0.4f
private val BAR_HEIGHT = 20.dp
