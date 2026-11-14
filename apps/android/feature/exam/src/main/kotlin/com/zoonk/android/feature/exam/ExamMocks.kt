package com.zoonk.android.feature.exam

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.mock.MockListRow
import com.zoonk.android.feature.mock.MockSummaryRow
import com.zoonk.android.feature.mock.factsUnderLines
import com.zoonk.android.feature.mock.mockMeasure
import com.zoonk.android.feature.mock.mockSubject
import com.zoonk.android.feature.mock.mockTitle
import com.zoonk.android.feature.mock.rememberNow
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.MarkStatus
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.components.StatusMark
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDuration
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.api.models.ExamView
import com.zoonk.api.models.ExamViewNextMock
import com.zoonk.api.models.ExamViewRunningMocksInner
import kotlinx.datetime.toJavaLocalDate
import java.time.LocalDate
import kotlin.math.ceil
import kotlin.time.Duration.Companion.seconds
import kotlin.time.Instant

/** [entry] is the small "Take a mock exam" under the list, on the days the page has no main action. */
internal fun ExamView.showsMocks(entry: Boolean): Boolean = runningMocks.isNotEmpty() || nextMock != null || mocks.isNotEmpty() || entry

/** Main's `ExamMocks`: the mock exams running, the plan's next one and those taken, newest first. */
@Composable
internal fun ExamMocksSection(
    exam: ExamView,
    entry: (@Composable () -> Unit)?,
    navigator: AppNavigator,
) {
    val running = exam.runningMocks.isNotEmpty()
    val next = exam.nextMock

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionHeader(stringResource(R.string.exam_mocks_title))

        val clocks = exam.runningMocks.map { runningMockClock(it.deadline) }
        val nextDate = next?.date?.let { examDayDate(it.toJavaLocalDate(), LocalDate.now(), currentLocale()) }

        BoxWithConstraints {
            val stacked = factsUnderLines(clocks + listOfNotNull(nextDate) + exam.mocks.map { mockMeasure(it) }, maxWidth)
            // The row the learner is on stands on its fill, with no hairline touching it.
            val rows =
                buildList<Pair<Boolean, @Composable () -> Unit>> {
                    exam.runningMocks.forEachIndexed { index, mock ->
                        val open = { navigator.open(AppRoute.Mock(mock.id.toString())) }
                        add((index == 0) to { RunningMockRow(mock, clocks[index], current = index == 0, stacked, onOpen = open) })
                    }
                    if (next != null) {
                        add(!running to { NextMockRow(next, nextDate, current = !running, stacked, navigator) })
                    }
                    exam.mocks.forEach { mock ->
                        val open = mock.blockId?.let { { navigator.open(AppRoute.Mock(it.toString())) } }
                        add(false to { MockSummaryRow(mock, onOpen = open, stacked = stacked) })
                    }
                }
            Column {
                rows.forEachIndexed { index, (current, row) ->
                    if (index > 0 && !current && !rows[index - 1].first) HorizontalDivider()
                    row()
                }
            }
        }

        entry?.invoke()
    }
}

@Composable
private fun NextMockRow(
    next: ExamViewNextMock,
    date: String?,
    current: Boolean,
    stacked: Boolean,
    navigator: AppNavigator,
) {
    MockListRow(
        headline = { Text(stringResource(R.string.exam_next_mock)) },
        supporting = pluralStringResource(R.plurals.exam_questions, next.questions.toInt(), next.questions.toInt()),
        trailing = date,
        leading = { StatusMark(if (current) MarkStatus.Next else MarkStatus.Todo) },
        onClick = { navigator.open(AppRoute.Challenge(next.planItemId.toString())) },
        stacked = stacked,
        current = current,
    )
}

@Composable
private fun RunningMockRow(
    mock: ExamViewRunningMocksInner,
    clock: String,
    current: Boolean,
    stacked: Boolean,
    onOpen: () -> Unit,
) {
    val locale = currentLocale()
    val subject = mockSubject(mock.shape)
    val answered =
        stringResource(
            R.string.exam_mock_answered,
            formatNumber(mock.answered.toDouble(), locale),
            formatNumber(mock.questions.toDouble(), locale),
        )

    MockListRow(
        headline = { Text(mockTitle(mock.number)) },
        supporting = if (subject.isEmpty()) answered else stringResource(R.string.mock_row_detail, subject, answered),
        trailing = clock,
        leading = { StatusMark(if (current) MarkStatus.Next else MarkStatus.Todo) },
        onClick = onOpen,
        stacked = stacked,
        current = current,
    )
}

@Composable
private fun runningMockClock(deadline: Instant?): String {
    if (deadline == null) return stringResource(R.string.exam_mock_handed_in)
    val now by rememberNow(CLOCK_TICK)
    val minutes = ceil((deadline - now).inWholeSeconds.coerceAtLeast(0) / SECONDS_PER_MINUTE).toLong()
    return if (minutes == 0L) {
        stringResource(R.string.exam_mock_time_up)
    } else {
        stringResource(R.string.exam_mock_time_left, formatDuration(minutes * SECONDS_PER_MINUTE.toLong(), currentLocale()))
    }
}

private val CLOCK_TICK = 15.seconds
private const val SECONDS_PER_MINUTE = 60.0
