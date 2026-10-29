package com.zoonk.android.feature.exam

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.mock.MockListRow
import com.zoonk.android.feature.mock.MockSummaryRow
import com.zoonk.android.feature.mock.mockDaySize
import com.zoonk.android.feature.mock.mockShapeLabel
import com.zoonk.android.feature.mock.mockTitle
import com.zoonk.android.feature.mock.rememberNow
import com.zoonk.android.feature.subscription.PlusMark
import com.zoonk.android.feature.subscription.PlusNotice
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.MarkStatus
import com.zoonk.android.ui.components.StatusMark
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDuration
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.ExamView
import com.zoonk.api.models.ExamViewNextMock
import com.zoonk.api.models.ExamViewRunningMocksInner
import kotlinx.datetime.toJavaLocalDate
import java.time.LocalDate
import kotlin.math.ceil
import kotlin.time.Duration.Companion.seconds
import kotlin.time.Instant

/** A Free learner sees mocks marked Plus wherever the plan or the page offers one. */
private fun ExamView.mocksLocked(mockOffered: Boolean): Boolean = mocksRequirePlus && (nextMock != null || mockOffered)

internal fun ExamView.showsMocks(mockOffered: Boolean): Boolean =
    runningMocks.isNotEmpty() || nextMock != null || mocks.isNotEmpty() || mocksLocked(mockOffered)

/** Main's `ExamMocks`: the mocks running, the plan's next one and those taken, newest first. */
@Composable
internal fun ExamMocksSection(
    exam: ExamView,
    mockOffered: Boolean,
    navigator: AppNavigator,
) {
    val running = exam.runningMocks.isNotEmpty()
    val next = exam.nextMock
    val locked = exam.mocksLocked(mockOffered)

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        ExamSectionHeader(
            stringResource(R.string.exam_mocks_title),
            exam.mocks.size
                .takeIf { it > 0 }
                ?.let { pluralStringResource(R.plurals.exam_mocks_taken, it, it) },
        )

        // The row the learner is on stands on its fill, with no hairline touching it.
        val rows =
            buildList<Pair<Boolean, @Composable () -> Unit>> {
                exam.runningMocks.forEachIndexed { index, mock ->
                    val open = { navigator.open(AppRoute.Mock(mock.id.toString())) }
                    add((index == 0) to { RunningMockRow(mock, current = index == 0, onOpen = open) })
                }
                if (next != null) {
                    add(!running to { NextMockRow(exam, next, current = !running, navigator) })
                }
                exam.mocks.forEach { mock ->
                    val open = mock.blockId?.let { { navigator.open(AppRoute.Mock(it.toString())) } }
                    add(false to { MockSummaryRow(mock, onOpen = open) })
                }
            }
        Column {
            rows.forEachIndexed { index, (current, row) ->
                if (index > 0 && !current && !rows[index - 1].first) HorizontalDivider()
                row()
            }
        }

        if (locked) {
            PlusNotice(
                onSeePlus = { navigator.open(AppRoute.Subscription) },
                description = stringResource(R.string.exam_mocks_plus),
            )
        }
    }
}

@Composable
private fun NextMockRow(
    exam: ExamView,
    next: ExamViewNextMock,
    current: Boolean,
    navigator: AppNavigator,
) {
    MockListRow(
        headline = {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(mockDaySize(fullLength = next.fullLength))
                if (exam.mocksRequirePlus) PlusMark()
            }
        },
        supporting = pluralStringResource(R.plurals.exam_questions, next.questions.toInt(), next.questions.toInt()),
        trailing = next.date?.let { examDayDate(it.toJavaLocalDate(), LocalDate.now(), currentLocale()) },
        leading = { StatusMark(if (current) MarkStatus.Next else MarkStatus.Todo) },
        onClick = { navigator.open(AppRoute.Challenge(next.planItemId.toString())) },
        modifier = Modifier.currentRow(current),
    )
}

@Composable
private fun RunningMockRow(
    mock: ExamViewRunningMocksInner,
    current: Boolean,
    onOpen: () -> Unit,
) {
    val locale = currentLocale()
    val shape = mockShapeLabel(mock.purpose == ExamViewRunningMocksInner.Purpose.PLACEMENT, mock.shape)
    val answered =
        stringResource(
            R.string.exam_mock_answered,
            formatNumber(mock.answered.toDouble(), locale),
            formatNumber(mock.questions.toDouble(), locale),
        )

    MockListRow(
        headline = { Text(mockTitle(mock.number)) },
        supporting = if (shape.isEmpty()) answered else stringResource(R.string.mock_row_detail, shape, answered),
        trailing = runningMockClock(mock.deadline),
        leading = { StatusMark(if (current) MarkStatus.Next else MarkStatus.Todo) },
        onClick = onOpen,
        modifier = Modifier.currentRow(current),
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

/** Main's current row: its fill reaches a little past the column, and TalkBack says it's the one the learner is on. */
@Composable
private fun Modifier.currentRow(current: Boolean): Modifier {
    if (!current) return this
    val fill = MaterialTheme.colorScheme.surfaceContainerHigh
    val label = stringResource(R.string.exam_current)
    return semantics { stateDescription = label }.drawBehind {
        val bleed = ROW_BLEED.toPx()
        drawRoundRect(
            fill,
            topLeft = Offset(-bleed, 0f),
            size = Size(size.width + bleed * 2, size.height),
            cornerRadius = CornerRadius(ROW_RADIUS.toPx()),
        )
    }
}

private val CLOCK_TICK = 15.seconds
private val ROW_BLEED = 12.dp
private val ROW_RADIUS = 12.dp
private const val SECONDS_PER_MINUTE = 60.0
