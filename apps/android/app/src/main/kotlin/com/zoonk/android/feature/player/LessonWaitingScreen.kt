package com.zoonk.android.feature.player

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.zoonk.android.R
import com.zoonk.android.feature.player.model.LessonOutline
import com.zoonk.android.feature.player.steps.count
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.MarkStatus
import com.zoonk.android.ui.components.StatusMark
import com.zoonk.api.models.ReadyAlternative
import kotlinx.coroutines.delay
import kotlin.time.Duration.Companion.seconds

private val ALTERNATIVE_AFTER = 15.seconds

/** A lesson not written yet (main's `LessonWaiting`): its outline, "Start this lesson", then its writing. */
@Composable
fun LessonWaitingScreen(
    outline: LessonOutline,
    viewModel: LessonWritingViewModel,
    exits: LessonPlayerExits,
) {
    val writing by viewModel.writing.collectAsStateWithLifecycle()
    val alternative by viewModel.alternative.collectAsStateWithLifecycle()
    var late by remember { mutableStateOf(false) }
    val current = writing

    LaunchedEffect(Unit) { viewModel.open() }
    LaunchedEffect(current is LessonWriting.Writing) {
        if (current is LessonWriting.Writing) {
            delay(ALTERNATIVE_AFTER)
            late = true
        }
    }

    val showsStart = current == LessonWriting.NotStarted || current == LessonWriting.Starting

    LessonFrame(
        title = outline.title,
        onClose = exits::close,
        bottomBar =
            if (showsStart) {
                {
                    Button(onClick = viewModel::start, enabled = current == LessonWriting.NotStarted, modifier = Modifier.fillMaxWidth()) {
                        Text(
                            stringResource(
                                if (current ==
                                    LessonWriting.Starting
                                ) {
                                    R.string.player_starting
                                } else {
                                    R.string.player_start_this_lesson
                                },
                            ),
                        )
                    }
                }
            } else {
                null
            },
    ) {
        LessonColumn(Modifier.padding(vertical = 24.dp)) {
            Text(outline.description, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyLarge)

            when (current) {
                null -> {
                    CircularProgressIndicator()
                }

                LessonWriting.NotStarted, LessonWriting.Starting -> {
                    Notice(stringResource(R.string.player_not_written_title), stringResource(R.string.player_not_written_description))
                }

                is LessonWriting.Writing -> {
                    WritingPhasesView(current.phases)
                    Text(
                        stringResource(R.string.player_writing_note),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                    if (late) alternative?.let { Alternative(it, instead = false, exits) }
                }

                LessonWriting.Failed -> {
                    Notice(stringResource(R.string.player_writing_failed_title), stringResource(R.string.player_writing_failed_description))
                    FilledTonalButton(onClick = viewModel::start) { Text(stringResource(R.string.player_try_again)) }
                    alternative?.let { Alternative(it, instead = false, exits) }
                }

                LessonWriting.SetAside -> {
                    Notice(stringResource(R.string.player_set_aside_title), stringResource(R.string.player_set_aside_description))
                    alternative?.let { Alternative(it, instead = true, exits) }
                }

                is LessonWriting.Refused -> {
                    LessonAccessScreen(current.refusal, onRetry = viewModel::start, exits = exits)
                    alternative?.let { Alternative(it, instead = true, exits) }
                }
            }
        }
    }
}

@Composable
private fun Notice(
    title: String,
    description: String,
) {
    Column(Modifier.semantics { liveRegion = LiveRegionMode.Polite }, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(title, style = MaterialTheme.typography.titleMedium)
        Text(description, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
private fun WritingPhasesView(phases: WritingPhases) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            stringResource(R.string.player_writing_lesson),
            modifier = Modifier.semantics { heading() },
            style = MaterialTheme.typography.titleMedium,
        )
        Phase(stringResource(R.string.player_phase_plan), phases.plan)
        Phase(stringResource(R.string.player_phase_write), phases.write)
    }
}

@Composable
private fun Phase(
    label: String,
    state: PhaseState,
) {
    val said =
        stringResource(
            when (state) {
                PhaseState.Pending -> R.string.player_phase_pending
                PhaseState.Active -> R.string.player_phase_active
                PhaseState.Done -> R.string.player_phase_done
            },
        )

    Row(
        modifier = Modifier.clearAndSetSemantics { contentDescription = "$label, $said" },
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        when (state) {
            PhaseState.Active -> CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
            PhaseState.Done -> StatusMark(MarkStatus.Done)
            PhaseState.Pending -> StatusMark(MarkStatus.Todo)
        }
        Text(
            label,
            color = if (state == PhaseState.Pending) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
            style = MaterialTheme.typography.bodyLarge,
        )
    }
}

@Composable
private fun Alternative(
    alternative: ReadyAlternative,
    instead: Boolean,
    exits: LessonPlayerExits,
) {
    val (label, open) =
        when (alternative) {
            is ReadyAlternative.ReadyAlternativeOneOfValue -> {
                alternative.value.title to { exits.replace(AppRoute.Lesson(alternative.value.lessonId.toString())) }
            }

            is ReadyAlternative.ReadyAlternativeOneOf1Value -> {
                val skills = alternative.value.dueSkills.toInt()
                pluralStringResource(R.plurals.player_review_ideas, skills, count(skills)) to { exits.replace(AppRoute.Today) }
            }
        }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            stringResource(if (instead) R.string.player_ready_instead else R.string.player_ready_while_waiting),
            modifier = Modifier.semantics { heading() },
            style = MaterialTheme.typography.labelLarge,
        )
        Surface(color = MaterialTheme.colorScheme.surfaceContainerHigh, shape = MaterialTheme.shapes.medium) {
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .heightIn(
                            min = 48.dp,
                        ).clickable(onClick = open)
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(label, modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodyLarge)
                Icon(
                    painterResource(R.drawable.ic_chevron_right),
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}
