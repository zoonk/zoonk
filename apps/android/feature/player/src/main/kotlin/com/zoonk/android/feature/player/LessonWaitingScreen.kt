package com.zoonk.android.feature.player

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
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
import com.zoonk.android.data.AnalyticsEvent
import com.zoonk.android.data.GenerationFailure
import com.zoonk.android.data.GenerationKind
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.TrackVisibleWait
import com.zoonk.android.data.stepLabel
import com.zoonk.android.feature.player.engine.LessonRefusal
import com.zoonk.android.feature.player.model.LessonOutline
import com.zoonk.android.feature.player.steps.count
import com.zoonk.android.feature.warmup.WaitContent
import com.zoonk.android.feature.warmup.WaitQuizAction
import com.zoonk.android.feature.warmup.WarmUpStore
import com.zoonk.android.feature.warmup.rememberReadyHold
import com.zoonk.android.feature.warmup.rememberWaitQuiz
import com.zoonk.android.feature.warmup.watchTouches
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.GenerationWait
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LimitNotice
import com.zoonk.android.ui.components.LimitPeriod
import com.zoonk.android.ui.components.LimitSubject
import com.zoonk.android.ui.components.LimitTier
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.api.models.ReadyAlternative
import kotlinx.coroutines.delay
import kotlin.time.Duration.Companion.seconds

/** The lesson read can lag the run's end by a moment, so it's read again until it shows. */
private val OPEN_RETRY = 2.seconds

private enum class WaitMoment { NotReady, GettingReady, Ready, Stopped }

/**
 * A lesson not ready yet (main's `LessonWaiting`): "Get it ready", then the wait, which goes on if
 * the learner leaves, and a lesson or review that is ready now to do meanwhile.
 */
@Composable
fun LessonWaitingScreen(
    outline: LessonOutline,
    viewModel: LessonWritingViewModel,
    warmUps: WarmUpStore,
    exits: LessonPlayerExits,
    readLesson: suspend () -> Unit,
    goalId: String? = null,
) {
    val writing by viewModel.writing.collectAsStateWithLifecycle()
    val run by viewModel.run.collectAsStateWithLifecycle()
    val alternative by viewModel.alternative.collectAsStateWithLifecycle()
    val warmUpId by viewModel.warmUpId.collectAsStateWithLifecycle()
    val kind by viewModel.kind.collectAsStateWithLifecycle()
    val current = writing
    val waits = current == LessonWriting.Writing || current == LessonWriting.Ready
    val ready = current == LessonWriting.Ready || (current == LessonWriting.Writing && run.status == GenerationRun.Status.Ready)
    val hold = rememberReadyHold(ready)
    val quiz = rememberWaitQuiz(warmUpId, warmUps)
    if (waits) TrackVisibleWait("lessonWait", "lesson", goalId)
    val opens = hold.over
    LaunchedEffect(opens) {
        while (opens) {
            readLesson()
            delay(OPEN_RETRY)
        }
    }

    val shown = if (current == LessonWriting.Ready) GenerationRun(status = GenerationRun.Status.Ready) else run
    val showsStart = current == LessonWriting.NotStarted || current == LessonWriting.Starting
    val moment =
        when {
            showsStart -> WaitMoment.NotReady
            hold.holding -> WaitMoment.Ready
            current == LessonWriting.Failed -> WaitMoment.Stopped
            waits && shown.status == GenerationRun.Status.Failed && shown.failure != GenerationFailure.Connection -> WaitMoment.Stopped
            waits -> WaitMoment.GettingReady
            else -> null
        }
    val retry = if (current == LessonWriting.Failed) viewModel::start else viewModel::retry
    val refused =
        (current as? LessonWriting.Refused)?.refusal?.takeIf {
            it == LessonRefusal.NotFound || it == LessonRefusal.Failed || it == LessonRefusal.NotInApp
        }

    LessonFrame(
        title = outline.title,
        onClose = { if (quiz.showingProgress && quiz.hasQuiz) quiz.back() else exits.close() },
        modifier = if (waits) Modifier.watchTouches(hold) else Modifier,
        bottomBar =
            when {
                showsStart -> {
                    {
                        Button(
                            busy = current == LessonWriting.Starting,
                            onClick = viewModel::start,
                            modifier = Modifier.fillMaxWidth(),
                            enabled = current == LessonWriting.NotStarted,
                        ) { Text(stringResource(R.string.player_get_it_ready)) }
                    }
                }

                moment == WaitMoment.Stopped -> {
                    { Button(onClick = retry, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.player_try_again)) } }
                }

                hold.holding -> {
                    {
                        Button(
                            onClick = hold::moveOn,
                            modifier = Modifier.fillMaxWidth(),
                        ) { Text(stringResource(R.string.player_start_this_lesson)) }
                    }
                }

                waits && quiz.hasQuiz && (quiz.showingProgress || quiz.hasNext) -> {
                    { WaitQuizAction(quiz, hold) }
                }

                refused != null -> {
                    lessonAccessBar(refused, viewModel::start, exits)
                }

                else -> {
                    null
                }
            },
    ) {
        LessonColumnBeforeFold {
            if (moment != null) {
                WaitNote(moment)
            } else {
                Text(outline.description, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyLarge)
            }

            when (current) {
                null -> {
                    CircularProgressIndicator()
                }

                LessonWriting.Writing, LessonWriting.Ready -> {
                    if (moment != WaitMoment.Stopped) {
                        quiz.open()
                        val share =
                            com.zoonk.android.ui.components
                                .rememberGenerationProgress(kind, shown)
                        val sentence =
                            when {
                                hold.holding -> R.string.player_lesson_ready
                                kind == GenerationKind.Challenge -> R.string.player_getting_challenge_ready
                                else -> R.string.player_getting_lesson_ready
                            }
                        val step = kind.stepLabel(if (hold.holding) GenerationRun(status = GenerationRun.Status.Ready) else shown)
                        WaitContent(
                            quiz,
                            hold,
                            AnalyticsEvent.WarmUpSurface.LessonWait,
                            kind,
                            shown,
                            stringResource(step ?: sentence),
                            goalId = goalId,
                            progressShare = share,
                            onRetry = viewModel::retry,
                        ) {
                            LessonWritingProgress(kind, shown, viewModel::retry, note = null, progressShare = share)
                        }
                    }
                }

                LessonWriting.SetAside, is LessonWriting.Refused -> {
                    if (refused != null) {
                        LessonAccessScreen(refused, viewModel::start)
                    } else {
                        LessonNotWrittenNotice(current, viewModel::start, exits::open)
                    }
                }

                else -> {}
            }

            if (!hold.holding) alternative?.let { ReadyNow(it, exits) }
        }
    }
}

@Composable
private fun WaitNote(moment: WaitMoment) {
    val title =
        when (moment) {
            WaitMoment.NotReady -> R.string.player_not_written_title
            WaitMoment.GettingReady -> R.string.player_getting_lesson_ready
            WaitMoment.Ready -> R.string.player_lesson_ready
            WaitMoment.Stopped -> R.string.player_wait_stopped
        }
    Column(Modifier.semantics { liveRegion = LiveRegionMode.Polite }, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(stringResource(title), modifier = Modifier.semantics { heading() }, style = MaterialTheme.typography.headlineSmall)
        if (moment == WaitMoment.NotReady || moment == WaitMoment.GettingReady) {
            Text(
                stringResource(R.string.player_writing_note),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyLarge,
            )
        }
    }
}

/** A lesson's run while it's written, and what that takes, on the lesson page and the session's next stop. */
@Composable
fun LessonWritingProgress(
    kind: GenerationKind,
    run: GenerationRun,
    onRetry: (() -> Unit)?,
    note: String?,
    progressShare: Float? = null,
) {
    GenerationWait(kind, run, onRetry, share = progressShare)
    if (note != null && run.status != GenerationRun.Status.Failed) {
        Text(
            note,
            modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
    }
}

/**
 * Main's `LessonNotWrittenNotice`: a lesson its checks set aside, the shared limit notice with a
 * slow-down's Try again; other refusals show nothing here.
 */
@Composable
fun LessonNotWrittenNotice(
    writing: LessonWriting,
    onRetry: () -> Unit,
    onOpen: (AppRoute) -> Unit,
) {
    val limit =
        when (val refusal = (writing as? LessonWriting.Refused)?.refusal) {
            is LessonRefusal.Limited -> refusal.limit
            LessonRefusal.PlusRequired -> Limit.Reached(LimitTier.Free, LimitPeriod.Rolling30Days)
            else -> null
        }
    when {
        limit != null -> {
            LimitNotice(
                limit = limit,
                subject = LimitSubject.Lessons,
                onCreateAccount = { onOpen(AppRoute.Login) },
                onSubscribe = { onOpen(AppRoute.Subscription) },
            )
            if (limit is Limit.SlowDown) OutlinedButton(onClick = onRetry) { Text(stringResource(R.string.player_try_again)) }
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
private fun ReadyNow(
    alternative: ReadyAlternative,
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
            stringResource(R.string.player_ready_now),
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
