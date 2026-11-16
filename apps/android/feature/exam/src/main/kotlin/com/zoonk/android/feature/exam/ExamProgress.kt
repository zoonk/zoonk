package com.zoonk.android.feature.exam

import android.icu.text.ListFormatter
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.mock.mockDate
import com.zoonk.android.feature.mock.mockSubject
import com.zoonk.android.feature.mock.mockTitle
import com.zoonk.android.ui.components.Meter
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.components.StatTile
import com.zoonk.android.ui.components.StatTiles
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.factsLine
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.format.formatPercent
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.ExamMockProgress
import com.zoonk.api.models.ExamMockProgressSubjectsInner
import com.zoonk.api.models.ExamViewScoring
import com.zoonk.api.models.MockShape

/** Main's `ExamMockProgress`: how the mock exams went over time, shown once one is finished. */
@Composable
internal fun ExamMockProgressSection(
    progress: ExamMockProgress,
    method: ExamViewScoring.Method,
) {
    val latest = latestMock(progress, method)

    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            SectionHeader(stringResource(R.string.exam_progress_title))
            // With one mock exam, what the rows measure is the section's own line.
            if (latest != null && latest.change == null) {
                Text(latest.measure, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
            }
        }
        ProgressCard(progress, latest)
    }
}

@Composable
private fun ProgressCard(
    progress: ExamMockProgress,
    latest: LatestMock?,
) {
    val first = progress.mocks.firstOrNull()
    val last = progress.mocks.lastOrNull()
    val trends = progress.subjects.any { it.change != null }

    progressLine(progress, currentLocale())?.let {
        Text(it, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium)
    }

    if (latest?.change != null) LatestMockTile(latest)

    if (first != null && last != null && progress.mocks.size > 1) {
        val points =
            progress.mocks.map { mock ->
                ProgressPoint(
                    label = percent(mock.percent),
                    detail =
                        listOf(
                            mockTitle(mock.number),
                            mockDate(mock.finishedAt),
                            mockSubject(mock.shape),
                        ).filter(String::isNotEmpty).factsLine(),
                    value = mock.percent.toInt(),
                )
            }
        ProgressLineChart(
            points = points,
            label = stringResource(R.string.exam_progress_chart_label, percent(first.percent), percent(last.percent)),
            first = mockDate(first.finishedAt),
            latest = mockDate(last.finishedAt),
        )
    }

    if (progress.subjects.isNotEmpty()) {
        val bySubject = stringResource(R.string.exam_by_subject)
        Column(Modifier.semantics { contentDescription = bySubject }) {
            progress.subjects.forEachIndexed { index, trend ->
                if (index > 0) HorizontalDivider()
                SubjectRow(trend, trends)
            }
        }
    }
}

/** The latest full or half mock exam: its score, what it measures and its change since the first. */
private class LatestMock(
    val percent: Long,
    val measure: String,
    val change: Long?,
)

@Composable
private fun latestMock(
    progress: ExamMockProgress,
    method: ExamViewScoring.Method,
): LatestMock? {
    val first = progress.mocks.firstOrNull()
    val latest = progress.mocks.lastOrNull { it.shape?.kind != MockShape.Kind.AREA } ?: progress.mocks.lastOrNull() ?: return null
    val name = listOf(mockTitle(latest.number), mockSubject(latest.shape)).filter(String::isNotEmpty).factsLine()
    val measure =
        stringResource(if (method == ExamViewScoring.Method.NET) R.string.exam_net_score_in else R.string.exam_right_answers_in, name)
    return LatestMock(
        percent = latest.percent,
        measure = measure,
        change = if (first != null && progress.mocks.size > 1) latest.percent - first.percent else null,
    )
}

@Composable
private fun LatestMockTile(latest: LatestMock) {
    val change = latest.change ?: return

    StatTiles(
        columns = 1,
        tiles =
            listOf { modifier ->
                StatTile(
                    label = stringResource(R.string.exam_latest_mock),
                    value = percent(latest.percent),
                    modifier = modifier,
                    detail = latest.measure,
                    icon = { Icon(painterResource(R.drawable.ic_timer), contentDescription = null, modifier = it) },
                    footer = {
                        Text(
                            stringResource(R.string.exam_since_first, signedChange(change)),
                            color =
                                if (change >
                                    0
                                ) {
                                    MaterialTheme.colorScheme.onTertiaryContainer
                                } else {
                                    MaterialTheme.colorScheme.onSurfaceVariant
                                },
                            style = MaterialTheme.typography.bodySmall,
                        )
                    },
                )
            },
    )
}

@Composable
private fun SubjectRow(
    trend: ExamMockProgressSubjectsInner,
    trends: Boolean,
) {
    val latest = trend.percents.lastOrNull() ?: 0L
    val numbers = MaterialTheme.typography.labelMedium.withTabularFigures()

    Row(
        modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp).semantics(mergeDescendants = true) {},
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            trend.name,
            Modifier.weight(1f).padding(vertical = 10.dp),
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.Medium,
        )
        if (trends) {
            Sparkline(trend.percents.map(Long::toInt))
        } else {
            Meter(latest / PERCENT.toFloat(), Modifier.width(SUBJECT_METER_WIDTH))
        }
        Text(percent(latest), Modifier.widthIn(min = 40.dp), textAlign = TextAlign.End, style = numbers)
        if (trends) SubjectChange(trend.change)
    }
}

@Composable
private fun SubjectChange(change: Long?) {
    val text = change?.let { signedChange(it) } ?: NO_CHANGE
    val spoken = change?.let { stringResource(R.string.exam_since_first_mock, text) }

    Row(
        modifier = Modifier.widthIn(min = 48.dp).clearAndSetSemantics { spoken?.let { contentDescription = it } },
        horizontalArrangement = Arrangement.spacedBy(2.dp, Alignment.End),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (change != null && change != 0L) {
            Icon(
                painterResource(if (change < 0) R.drawable.ic_south_east else R.drawable.ic_north_east),
                contentDescription = null,
                modifier =
                    Modifier.size(
                        with(LocalDensity.current) {
                            MaterialTheme.typography.labelMedium.fontSize
                                .toDp()
                        },
                    ),
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Text(
            text,
            color = if (change == null) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
            style = MaterialTheme.typography.labelMedium.withTabularFigures(),
            fontWeight = if (change == null) FontWeight.Normal else FontWeight.Medium,
        )
    }
}

/** What changed between mock exams, in one sentence, or nothing when no subject moved. */
@Composable
private fun progressLine(
    progress: ExamMockProgress,
    locale: java.util.Locale,
): String? {
    val list = { names: List<String> -> ListFormatter.getInstance(locale).format(names) }
    val improved = progress.improved
    val needsWork = progress.needsWork
    return when {
        improved.isNotEmpty() && needsWork.isNotEmpty() -> {
            stringResource(
                R.string.exam_progress_better_and_needs_work,
                list(improved),
                list(needsWork),
            )
        }

        improved.isNotEmpty() -> {
            stringResource(R.string.exam_progress_better, list(improved))
        }

        needsWork.isNotEmpty() -> {
            stringResource(R.string.exam_progress_needs_work, list(needsWork))
        }

        else -> {
            null
        }
    }
}

@Composable
private fun percent(value: Long): String = formatPercent(value / PERCENT, currentLocale())

@Composable
private fun signedChange(change: Long): String = formatNumber(change.toDouble(), currentLocale(), signed = true)

private const val PERCENT = 100.0
private const val NO_CHANGE = "–"
private val SUBJECT_METER_WIDTH = 80.dp
