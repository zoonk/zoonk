package com.zoonk.android.feature.exam

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
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
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Bottom) {
            Text(stringResource(R.string.exam_mocks_title), Modifier.semantics { heading() }, style = MaterialTheme.typography.titleMedium)
            if (exam.mocks.isNotEmpty()) {
                Text(
                    pluralStringResource(R.plurals.exam_mocks_taken, exam.mocks.size, exam.mocks.size),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.labelMedium.withTabularFigures(),
                )
            }
        }

        Column {
            exam.runningMocks.forEachIndexed { index, mock ->
                if (index > 0) HorizontalDivider()
                RunningMockRow(mock, current = index == 0) { navigator.open(AppRoute.Mock(mock.id.toString())) }
            }
            if (next != null) {
                if (running) HorizontalDivider()
                ListItem(
                    headlineContent = {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                            Text(mockDaySize(fullLength = next.fullLength))
                            if (exam.mocksRequirePlus) PlusMark()
                        }
                    },
                    modifier = Modifier.clickable { navigator.open(AppRoute.Challenge(next.planItemId.toString())) }.currentRow(!running),
                    supportingContent = {
                        Text(
                            pluralStringResource(R.plurals.exam_questions, next.questions.toInt(), next.questions.toInt()),
                        )
                    },
                    leadingContent = { StatusMark(if (running) MarkStatus.Todo else MarkStatus.Next) },
                    trailingContent = next.date?.let { { Trailing(examDayDate(it.toJavaLocalDate(), LocalDate.now(), currentLocale())) } },
                    colors = ListItemDefaults.colors(containerColor = Color.Transparent),
                )
            }
            exam.mocks.forEachIndexed { index, mock ->
                if (running || next != null || index > 0) HorizontalDivider()
                MockSummaryRow(mock, onOpen = mock.blockId?.let { { navigator.open(AppRoute.Mock(it.toString())) } })
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

    ListItem(
        headlineContent = { Text(mockTitle(mock.number)) },
        modifier = Modifier.clickable(onClick = onOpen).currentRow(current),
        supportingContent = { Text(if (shape.isEmpty()) answered else stringResource(R.string.mock_row_detail, shape, answered)) },
        leadingContent = { StatusMark(if (current) MarkStatus.Next else MarkStatus.Todo) },
        trailingContent = { RunningMockClock(mock.deadline) },
        colors = ListItemDefaults.colors(containerColor = Color.Transparent),
    )
}

@Composable
private fun RunningMockClock(deadline: Instant?) {
    if (deadline == null) {
        Trailing(stringResource(R.string.exam_mock_handed_in))
        return
    }
    val now by rememberNow(CLOCK_TICK)
    val minutes = ceil((deadline - now).inWholeSeconds.coerceAtLeast(0) / SECONDS_PER_MINUTE).toInt()

    if (minutes == 0) {
        Trailing(stringResource(R.string.exam_mock_time_up))
    } else {
        Trailing(stringResource(R.string.exam_mock_time_left, formatDuration(minutes * 60L, currentLocale())))
    }
}

@Composable
private fun Trailing(text: String) {
    Text(text, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelMedium.withTabularFigures())
}

/** Main's current row: the one the learner is on stands on the muted fill. */
@Composable
private fun Modifier.currentRow(current: Boolean): Modifier =
    if (current) background(MaterialTheme.colorScheme.surfaceContainerHigh, MaterialTheme.shapes.medium) else this

private val CLOCK_TICK = 15.seconds
private const val SECONDS_PER_MINUTE = 60.0
