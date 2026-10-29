package com.zoonk.android.feature.mock.runner

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.HorizontalDivider
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
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.conversation.taskMinutes
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.DoneMark
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.MockExamCurrent
import com.zoonk.api.models.SpeakingSectionTasksInner

/**
 * Main's `MockSpeakingView`. Its cards are written when the learner starts the section, so a mock
 * handed in before it never pays for them; each task is a call that comes back here.
 */
@Composable
internal fun MockSpeaking(
    viewModel: MockRunnerViewModel,
    run: MockRun,
    current: MockExamCurrent,
    navigator: AppNavigator,
    onClose: () -> Unit,
) {
    val speaking = run.view.speaking
    val section = run.view.sections.getOrNull(current.section.toInt())
    val isLast = current.section.toInt() == run.view.sections.lastIndex
    val left = speaking?.tasks?.count { it.status != SpeakingSectionTasksInner.Status.COMPLETED } ?: 0
    var confirming by rememberSaveable { mutableStateOf(false) }

    MockStepFrame(
        viewModel,
        run,
        onClose,
        actions = {
            if (speaking == null) {
                val starting = run.busy == MockStep.StartSpeaking
                MockMainButton(
                    stringResource(if (starting) R.string.mock_speaking_writing else R.string.mock_speaking_start),
                    busy = starting,
                    enabled = !run.pending,
                    onClick = viewModel::startSpeaking,
                )
            } else {
                MockMainButton(
                    stringResource(if (isLast) R.string.mock_hand_in_mock else R.string.mock_hand_in_section),
                    busy = run.busy == MockStep.Submit,
                    enabled = !run.pending,
                    onClick = { confirming = true },
                )
            }
        },
    ) {
        SectionClock(current.deadline, large = true)
        StepTitle(section?.name ?: speaking?.paper ?: stringResource(R.string.mock_speaking))
        if (speaking == null) {
            StepDetail(stringResource(R.string.mock_speaking_intro))
        } else {
            StepDetail(
                if (left >
                    0
                ) {
                    pluralStringResource(R.plurals.mock_speaking_left, left, left)
                } else {
                    stringResource(R.string.mock_speaking_all_done)
                },
            )
            Column {
                speaking.tasks.forEachIndexed { index, task ->
                    if (index > 0) HorizontalDivider()
                    TaskRow(
                        index + 1,
                        task,
                    ) { navigator.open(AppRoute.Conversation(task.conversationId.toString(), mock = run.view.blockId.toString())) }
                }
            }
        }
    }

    if (confirming) {
        AlertDialog(
            onDismissRequest = { confirming = false },
            title = { Text(stringResource(if (isLast) R.string.mock_hand_in_mock_title else R.string.mock_hand_in_section_title)) },
            text = {
                Text(
                    if (left >
                        0
                    ) {
                        pluralStringResource(R.plurals.mock_speaking_hand_in_left, left, left)
                    } else {
                        stringResource(R.string.mock_speaking_hand_in_done)
                    },
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        confirming = false
                        viewModel.submitSection()
                    },
                ) { Text(stringResource(R.string.mock_hand_in)) }
            },
            dismissButton = { TextButton(onClick = { confirming = false }) { Text(stringResource(R.string.mock_keep_going)) } },
        )
    }
}

@Composable
private fun TaskRow(
    number: Int,
    task: SpeakingSectionTasksInner,
    onStart: () -> Unit,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .heightIn(min = 64.dp)
            .padding(vertical = 8.dp)
            .semantics(mergeDescendants = true) {},
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                stringResource(R.string.mock_speaking_task, number, taskMinutes(task.minutes.min, task.minutes.max)),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.labelMedium.withTabularFigures(),
            )
            Text(task.name, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
        }
        if (task.status == SpeakingSectionTasksInner.Status.COMPLETED) {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                DoneMark()
                Text(
                    stringResource(R.string.mock_speaking_done),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        } else {
            FilledTonalButton(onClick = onStart) { Text(stringResource(R.string.mock_speaking_start_task)) }
        }
    }
}
