package com.zoonk.android.feature.player

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.zoonk.android.R
import com.zoonk.android.data.GenerationFailure
import com.zoonk.android.data.GenerationKind
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.feature.player.engine.LessonRefusal
import com.zoonk.android.feature.player.model.LessonOutline
import com.zoonk.android.feature.player.steps.count
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.GenerationWait
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LimitNotice
import com.zoonk.android.ui.components.LimitSubject
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.api.models.ReadyAlternative
import kotlinx.coroutines.delay
import kotlin.time.Duration.Companion.seconds

private val ALTERNATIVE_AFTER = 15.seconds

/** The lesson read can lag the run's end by a moment, so it's read again until it shows. */
private val OPEN_RETRY = 2.seconds

/** A lesson not written yet (main's `LessonWaiting`): its outline, "Start this lesson", then its writing. */
@Composable
fun LessonWaitingScreen(
    outline: LessonOutline,
    viewModel: LessonWritingViewModel,
    exits: LessonPlayerExits,
    readLesson: suspend () -> Unit,
) {
    val writing by viewModel.writing.collectAsStateWithLifecycle()
    val run by viewModel.run.collectAsStateWithLifecycle()
    val alternative by viewModel.alternative.collectAsStateWithLifecycle()
    var late by remember { mutableStateOf(false) }
    val current = writing
    val waits = current == LessonWriting.Writing || current == LessonWriting.Ready
    val ready = current == LessonWriting.Ready || (current == LessonWriting.Writing && run.status == GenerationRun.Status.Ready)

    LaunchedEffect(waits) {
        if (waits) {
            delay(ALTERNATIVE_AFTER)
            late = true
        }
    }
    LaunchedEffect(ready) {
        if (ready) {
            viewModel.recordWait()
            while (true) {
                readLesson()
                delay(OPEN_RETRY)
            }
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

                LessonWriting.Writing, LessonWriting.Ready -> {
                    val shown = if (current == LessonWriting.Ready) GenerationRun(status = GenerationRun.Status.Ready) else run
                    val failed = shown.status == GenerationRun.Status.Failed
                    GenerationWait(GenerationKind.Lesson, shown, onRetry = viewModel::retry)
                    if (!failed) {
                        Text(
                            stringResource(R.string.player_writing_note),
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            style = MaterialTheme.typography.bodyMedium,
                        )
                    }
                    if (late || failed) alternative?.let { Alternative(it, instead = false, exits) }
                }

                LessonWriting.Failed -> {
                    GenerationWait(
                        GenerationKind.Lesson,
                        GenerationRun(status = GenerationRun.Status.Failed, failure = GenerationFailure.NotStarted),
                        onRetry = viewModel::start,
                    )
                    alternative?.let { Alternative(it, instead = false, exits) }
                }

                LessonWriting.SetAside -> {
                    LessonNotWrittenNotice(current, viewModel::start, exits::open)
                    alternative?.let { Alternative(it, instead = true, exits) }
                }

                is LessonWriting.Refused -> {
                    when (current.refusal) {
                        is LessonRefusal.Limited, LessonRefusal.PlusRequired -> {
                            LessonNotWrittenNotice(current, viewModel::start, exits::open)
                        }

                        LessonRefusal.NotFound, LessonRefusal.Failed, LessonRefusal.NotInApp -> {
                            LessonAccessScreen(current.refusal, viewModel::start, exits)
                        }
                    }
                    alternative?.let { Alternative(it, instead = true, exits) }
                }
            }
        }
    }
}

/**
 * Main's `LessonNotWrittenNotice`: a lesson its checks set aside, the shared limit notice with a
 * slow-down's Try again, or Plus's free week being over; other refusals show nothing here.
 */
@Composable
fun LessonNotWrittenNotice(
    writing: LessonWriting,
    onRetry: () -> Unit,
    onOpen: (AppRoute) -> Unit,
) {
    when (val refusal = (writing as? LessonWriting.Refused)?.refusal) {
        is LessonRefusal.Limited -> {
            LimitNotice(
                limit = refusal.limit,
                subject = LimitSubject.Lessons,
                onCreateAccount = { onOpen(AppRoute.Login) },
                onSeePlus = { onOpen(AppRoute.Subscription) },
            )
            if (refusal.limit is Limit.SlowDown) OutlinedButton(onClick = onRetry) { Text(stringResource(R.string.player_try_again)) }
        }

        LessonRefusal.PlusRequired -> {
            Notice(
                stringResource(R.string.subscription_free_week_over_title),
                stringResource(R.string.subscription_free_week_over_description),
            )
            OutlinedButton(onClick = { onOpen(AppRoute.Subscription) }) { Text(stringResource(R.string.player_see_plus)) }
        }

        else -> {
            if (writing == LessonWriting.SetAside) {
                Notice(stringResource(R.string.player_set_aside_title), stringResource(R.string.player_set_aside_description))
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
        Text(title, style = MaterialTheme.typography.titleSmall)
        Text(description, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
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
