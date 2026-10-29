package com.zoonk.android.feature.mock.result

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.MockResult
import com.zoonk.api.models.MockResultAreasInner
import com.zoonk.api.models.MockResultTopicsInner
import com.zoonk.api.models.NetCalibration
import kotlin.math.floor
import kotlin.math.roundToInt

internal fun hasBreakdown(result: MockResult): Boolean = result.areas.size > 1 || result.topics.size > 1

/** Main's `MockResultBreakdown`: each area with its topics folded under it, or the topics of a one-area mock, worst first. */
@Composable
internal fun Breakdown(result: MockResult) {
    if (result.areas.size <= 1) {
        ResultSection(stringResource(R.string.mock_result_by_topic)) { TopicRows(result.topics) }
        return
    }

    ResultSection(stringResource(R.string.mock_result_by_area)) {
        Column {
            result.areas.forEachIndexed { index, area ->
                if (index > 0) HorizontalDivider()
                AreaRow(area, result.topics.filter { it.area == area.name })
            }
        }
    }
}

@Composable
internal fun ResultSection(
    title: String,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionHeader(title)
        content()
    }
}

@Composable
private fun AreaRow(
    area: MockResultAreasInner,
    topics: List<MockResultTopicsInner>,
) {
    val score = area.score?.let { scoreRange(it.low, it.high) } ?: rightOf(area.correct, area.total)
    var open by rememberSaveable(area.name) { mutableStateOf(false) }
    val state = stringResource(if (open) R.string.mock_result_expanded else R.string.mock_result_collapsed)
    val folds = topics.isNotEmpty()

    Column {
        Row(
            Modifier
                .fillMaxWidth()
                .then(
                    if (folds) {
                        Modifier.clickable(role = Role.Button) { open = !open }.semantics { stateDescription = state }
                    } else {
                        Modifier.semantics(mergeDescendants = true) {}
                    },
                ).heightIn(min = 48.dp)
                .padding(vertical = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(area.name, Modifier.weight(1f), style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium)
            Text(score, style = MaterialTheme.typography.labelLarge.withTabularFigures())
            if (folds) {
                Icon(
                    painterResource(R.drawable.ic_expand_more),
                    contentDescription = null,
                    modifier = if (open) Modifier.rotate(HALF_TURN) else Modifier,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
        if (open) Column(Modifier.padding(start = 16.dp, bottom = 8.dp)) { TopicRows(topics) }
    }
}

private val worstFirst =
    compareBy<MockResultTopicsInner> { it.correct.toDouble() / it.total }.thenByDescending { it.total }

@Composable
private fun TopicRows(topics: List<MockResultTopicsInner>) {
    val sorted = topics.sortedWith(worstFirst)
    val rest = sorted.drop(TOPICS_SHOWN)
    var more by rememberSaveable { mutableStateOf(false) }

    TopicList(sorted.take(TOPICS_SHOWN))
    if (rest.isNotEmpty()) {
        val state = stringResource(if (more) R.string.mock_result_expanded else R.string.mock_result_collapsed)
        TextButton(onClick = { more = !more }, modifier = Modifier.semantics { stateDescription = state }) {
            Text(pluralStringResource(R.plurals.mock_result_more_topics, rest.size, rest.size))
            Icon(
                painterResource(R.drawable.ic_expand_more),
                contentDescription = null,
                modifier = Modifier.padding(start = 4.dp).then(if (more) Modifier.rotate(HALF_TURN) else Modifier),
            )
        }
        if (more) TopicList(rest)
    }
}

@Composable
private fun TopicList(topics: List<MockResultTopicsInner>) {
    Column {
        topics.forEachIndexed { index, topic ->
            if (index > 0) HorizontalDivider()
            Row(
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 40.dp)
                    .padding(vertical = 8.dp)
                    .semantics(mergeDescendants = true) {},
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    topic.name,
                    Modifier.weight(1f),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
                Text(rightOf(topic.correct.toDouble(), topic.total), style = MaterialTheme.typography.labelMedium.withTabularFigures())
            }
        }
    }
}

private fun slowestArea(result: MockResult): Pair<MockResultAreasInner, Double>? =
    result.areas
        .mapNotNull { area -> area.targetSecondsPerQuestion?.let { area to area.secondsPerQuestion - it } }
        .maxByOrNull { it.second }
        ?.takeIf { it.second > 0 }

private enum class InsightKind { Timing, Consistency, Calibration }

internal fun hasInsights(result: MockResult): Boolean =
    slowestArea(result) != null ||
        result.unansweredAtTimeout > 0 ||
        result.coherence?.isCoherent == false ||
        (result.calibration?.unsure?.answered ?: 0) > 0

@Composable
internal fun Insights(result: MockResult) {
    ResultSection(stringResource(R.string.mock_result_insights)) {
        Column {
            val insights =
                listOfNotNull(
                    InsightKind.Timing.takeIf { slowestArea(result) != null || result.unansweredAtTimeout > 0 },
                    InsightKind.Consistency.takeIf { result.coherence?.isCoherent == false },
                    InsightKind.Calibration.takeIf { (result.calibration?.unsure?.answered ?: 0) > 0 },
                )
            insights.forEachIndexed { index, insight ->
                if (index > 0) HorizontalDivider()
                when (insight) {
                    InsightKind.Timing -> TimingInsight(result)
                    InsightKind.Consistency -> ConsistencyInsight(result)
                    InsightKind.Calibration -> CalibrationInsight(result)
                }
            }
        }
    }
}

@Composable
private fun Insight(
    icon: Int,
    title: String,
    lines: List<String>,
) {
    Row(
        Modifier.fillMaxWidth().padding(vertical = 12.dp).semantics(mergeDescendants = true) {},
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        val titleStyle = MaterialTheme.typography.titleSmall
        Icon(
            painterResource(icon),
            contentDescription = null,
            modifier = Modifier.size(with(LocalDensity.current) { titleStyle.lineHeight.toDp() }),
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(title, Modifier.semantics { heading() }, style = titleStyle)
            lines.forEach {
                Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
            }
        }
    }
}

@Composable
private fun TimingInsight(result: MockResult) {
    val locale = currentLocale()
    val slowest = slowestArea(result)?.first
    val left = result.unansweredAtTimeout.toInt()

    Insight(
        R.drawable.ic_timer,
        stringResource(R.string.mock_result_timing),
        listOfNotNull(
            slowest?.let {
                val seconds = it.secondsPerQuestion.roundToInt()
                pluralStringResource(
                    R.plurals.mock_result_timing_area,
                    seconds,
                    seconds,
                    it.name,
                    formatNumber((it.targetSecondsPerQuestion ?: 0.0).roundToInt().toDouble(), locale),
                )
            },
            left.takeIf { it > 0 }?.let { pluralStringResource(R.plurals.mock_result_left_at_timeout, it, it) },
        ),
    )
}

@Composable
private fun ConsistencyInsight(result: MockResult) {
    val coherence = result.coherence ?: return
    val easy = coherence.easyWrong.toInt()
    val hard = coherence.hardRight.toInt()

    Insight(
        R.drawable.ic_balance,
        stringResource(R.string.mock_result_consistency),
        listOf(
            stringResource(
                R.string.mock_result_consistency_detail,
                pluralStringResource(R.plurals.mock_result_easy_wrong, easy, easy),
                pluralStringResource(R.plurals.mock_result_hard_right, hard, hard),
            ),
        ),
    )
}

@Composable
private fun CalibrationInsight(result: MockResult) {
    val calibration = result.calibration ?: return
    val sure = calibration.sure
    val unsure = calibration.unsure
    val gain = calibration.blankingGain

    Insight(
        R.drawable.ic_balance,
        stringResource(R.string.mock_result_calibration),
        listOfNotNull(
            stringResource(
                R.string.mock_result_calibration_detail,
                pluralStringResource(R.plurals.mock_result_right_of, sure.right.toInt(), sure.right.toInt(), sure.answered.toInt()),
                pluralStringResource(R.plurals.mock_result_right_of, unsure.right.toInt(), unsure.right.toInt(), unsure.answered.toInt()),
            ),
            when (calibration.advice) {
                NetCalibration.Advice.BLANK_UNSURE -> {
                    pluralStringResource(R.plurals.mock_result_blank_gain, floor(gain).toInt(), formatNumber(gain, currentLocale()))
                }

                NetCalibration.Advice.KEEP_ANSWERING -> {
                    stringResource(R.string.mock_result_keep_answering)
                }

                null -> {
                    null
                }
            },
        ),
    )
}

private const val TOPICS_SHOWN = 5
private const val HALF_TURN = 180f
