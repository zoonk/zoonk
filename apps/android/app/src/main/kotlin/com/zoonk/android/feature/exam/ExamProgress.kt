package com.zoonk.android.feature.exam

import android.icu.text.ListFormatter
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
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
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.mock.mockDate
import com.zoonk.android.feature.mock.mockShapeLabel
import com.zoonk.android.feature.mock.mockTitle
import com.zoonk.android.feature.subscription.PlusMark
import com.zoonk.android.ui.components.Meter
import com.zoonk.android.ui.components.StatTile
import com.zoonk.android.ui.components.StatTiles
import com.zoonk.android.ui.components.StatTone
import com.zoonk.android.ui.components.color
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.format.formatPercent
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.ExamMockProgress
import com.zoonk.api.models.ExamMockProgressMocksInner
import com.zoonk.api.models.ExamMockProgressSubjectsInner
import com.zoonk.api.models.ExamView
import com.zoonk.api.models.ExamViewScoring
import com.zoonk.api.models.MockShape

/** Main's `ExamMockProgress`: how the mocks went over time, or a sample of it behind Plus. */
@Composable
internal fun ExamMockProgressSection(exam: ExamView) {
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        ExamSectionHeader(stringResource(R.string.exam_progress_title), detail = null)
        val progress = exam.progress
        if (progress != null) ProgressCard(progress, exam.scoring.method) else LockedProgress()
    }
}

@Composable
private fun ProgressCard(
    progress: ExamMockProgress,
    method: ExamViewScoring.Method,
) {
    val locale = currentLocale()
    val first = progress.mocks.firstOrNull()
    val latest = progress.mocks.lastOrNull()
    val trends = progress.subjects.any { it.change != null }

    ProgressTiles(progress, method)

    if (first != null && latest != null && progress.mocks.size > 1) {
        val points =
            progress.mocks.map { mock ->
                ProgressPoint(
                    label = percent(mock.percent),
                    detail =
                        listOf(
                            mockTitle(mock.number),
                            mockDate(mock.finishedAt),
                            mock.shapeLabel,
                        ).filter(String::isNotEmpty).joinToString(" · "),
                    value = mock.percent.toInt(),
                )
            }
        ProgressLineChart(
            points = points,
            label = stringResource(R.string.exam_progress_chart_label, percent(first.percent), percent(latest.percent)),
            first = mockDate(first.finishedAt),
            latest = mockDate(latest.finishedAt),
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

    Text(progressLine(progress, locale), color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
}

@Composable
private fun ProgressTiles(
    progress: ExamMockProgress,
    method: ExamViewScoring.Method,
) {
    val first = progress.mocks.firstOrNull()
    val latest = progress.mocks.lastOrNull { it.shape?.kind != MockShape.Kind.AREA } ?: progress.mocks.lastOrNull() ?: return
    val best = findBestArea(progress.subjects)
    val name =
        listOfNotNull(mockTitle(latest.number), latest.shapeLabel.takeIf { latest.shape?.kind == MockShape.Kind.AREA }).joinToString(" · ")
    val change = if (first != null && progress.mocks.size > 1) latest.percent - first.percent else null
    val since = change?.let { stringResource(R.string.exam_since_first, signedChange(it)) }

    // Two tiles side by side keep their labels whole only while each has room for them.
    BoxWithConstraints {
        StatTiles(
            columns = if (maxWidth.value / LocalDensity.current.fontScale < TWO_TILES_MIN_WIDTH) 1 else 2,
            tiles =
                listOfNotNull(
                    { modifier ->
                        StatTile(
                            label = stringResource(R.string.exam_latest_mock),
                            value = percent(latest.percent),
                            modifier = modifier,
                            detail =
                                stringResource(
                                    if (method ==
                                        ExamViewScoring.Method.NET
                                    ) {
                                        R.string.exam_net_score_in
                                    } else {
                                        R.string.exam_right_answers_in
                                    },
                                    name,
                                ),
                            icon = {
                                Icon(
                                    painterResource(R.drawable.ic_timer),
                                    contentDescription = null,
                                    modifier = it,
                                    tint = StatTone.Neutral.color,
                                )
                            },
                            footer =
                                since?.let {
                                    {
                                        Text(
                                            it,
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
                                    }
                                },
                        )
                    },
                    best?.let { area ->
                        { modifier: Modifier ->
                            StatTile(
                                label = stringResource(R.string.exam_best_area),
                                value = percent(area.percent.toLong()),
                                modifier = modifier,
                                detail = area.name,
                                tone = StatTone.Success,
                                icon = {
                                    Icon(
                                        painterResource(R.drawable.ic_trophy),
                                        contentDescription = null,
                                        modifier = it,
                                        tint = StatTone.Success.color,
                                    )
                                },
                            )
                        }
                    },
                ),
        )
    }
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

@Composable
private fun LockedProgress() {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Top) {
            Text(
                stringResource(R.string.exam_progress_locked),
                Modifier.weight(1f),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
            PlusMark()
        }
        SampleProgressChart(SAMPLE)
    }
}

@Composable
private fun progressLine(
    progress: ExamMockProgress,
    locale: java.util.Locale,
): String {
    val list = { names: List<String> -> ListFormatter.getInstance(locale).format(names) }
    val improved = progress.improved
    val needsWork = progress.needsWork
    return when {
        progress.mocks.size < 2 -> {
            stringResource(R.string.exam_progress_take_another)
        }

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

        progress.subjects.any { it.change != null } -> {
            stringResource(R.string.exam_progress_no_change)
        }

        else -> {
            stringResource(R.string.exam_progress_trends_later)
        }
    }
}

private val ExamMockProgressMocksInner.shapeLabel: String
    @Composable get() = mockShapeLabel(purpose == ExamMockProgressMocksInner.Purpose.PLACEMENT, shape)

@Composable
private fun percent(value: Long): String = formatPercent(value / PERCENT, currentLocale())

@Composable
private fun signedChange(change: Long): String = formatNumber(change.toDouble(), currentLocale(), signed = true)

internal data class BestArea(
    val name: String,
    val percent: Int,
)

/** None with one subject or a tie at the top: the page says nothing rather than pick one. */
internal fun findBestArea(subjects: List<ExamMockProgressSubjectsInner>): BestArea? {
    val latest = subjects.mapNotNull { subject -> subject.percents.lastOrNull()?.let { BestArea(subject.name, it.toInt()) } }
    val sorted = latest.sortedByDescending { it.percent }
    val best = sorted.getOrNull(0) ?: return null
    val next = sorted.getOrNull(1) ?: return null
    return best.takeIf { next.percent != best.percent }
}

private const val PERCENT = 100.0
private const val TWO_TILES_MIN_WIDTH = 300
private const val NO_CHANGE = "–"
private val SUBJECT_METER_WIDTH = 80.dp
private val SAMPLE = List(6) { 30 + it * 7 }
