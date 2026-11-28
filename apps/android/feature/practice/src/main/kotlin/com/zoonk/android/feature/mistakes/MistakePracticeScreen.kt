package com.zoonk.android.feature.mistakes

import androidx.activity.compose.BackHandler
import androidx.annotation.StringRes
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.createSavedStateHandle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.ceremonies.MomentAfterCeremony
import com.zoonk.android.feature.certificates.naming
import com.zoonk.android.feature.feedback.rememberSaveFailureReport
import com.zoonk.android.feature.player.SessionEndActions
import com.zoonk.android.feature.player.leaveTaskFor
import com.zoonk.android.feature.practice.AnswerActions
import com.zoonk.android.feature.practice.Draft
import com.zoonk.android.feature.practice.RunAskButton
import com.zoonk.android.feature.practice.RunFinished
import com.zoonk.android.feature.practice.RunFrame
import com.zoonk.android.feature.practice.RunLoadFailed
import com.zoonk.android.feature.practice.RunLoading
import com.zoonk.android.feature.practice.RunPhase
import com.zoonk.android.feature.practice.RunQuestion
import com.zoonk.android.feature.practice.RunSegments
import com.zoonk.android.feature.practice.answerAction
import com.zoonk.android.feature.practice.answerFor
import com.zoonk.android.feature.practice.rememberDraft
import com.zoonk.android.feature.practice.runAccount
import com.zoonk.android.feature.practice.runReportTarget
import com.zoonk.android.feature.session.DayMoment
import com.zoonk.android.feature.session.missionMomentFacts
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.TaskNotFound
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.ButtonIcon
import com.zoonk.android.ui.components.MomentReadouts
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.TaskActions
import kotlinx.coroutines.launch
import java.util.UUID

@Composable
fun MistakePracticeScreen(
    route: AppRoute.MistakePractice,
    app: AppContainer,
    navigator: AppNavigator,
) {
    val summary by app.learnerSummary.summary.collectShown()
    val learner = summary.value
    if (learner == null) {
        RunLoading(navigator::closeTask)
        return
    }
    val key =
        PracticeKey(
            // Core takes a mock run's goal from its sitting, so it works after the learner switched goals.
            goalId = learner.activeGoalId.takeIf { route.mockId == null },
            skillId = route.skillId?.toUuid(),
            blockId = route.blockId?.toUuid(),
            mockId = route.mockId?.toUuid(),
        )
    val viewModel =
        viewModel(key = "mistake-practice:${route.skillId}:${route.blockId}:${route.mockId}:${runAccount(app)}") {
            MistakePracticeViewModel(
                key,
                app.mistakes,
                app.todayChoices,
                app.sessions,
                saved = createSavedStateHandle(),
                sessionId = route.sessionId?.toUuid().takeIf { key.blockId != null },
                steps = app.studyOpener,
            )
        }
    val state by viewModel.state.collectAsStateWithLifecycle()
    val closed by viewModel.closed.collectAsStateWithLifecycle()

    val move by viewModel.sessionMove.collectAsStateWithLifecycle()

    LaunchedEffect(closed) { if (closed) navigator.closeTask() }
    LaunchedEffect(move.leaving) { move.leaving?.let(navigator::leaveTaskFor) }

    when (val shown = state) {
        null -> PracticeRead(viewModel, navigator)
        else -> PracticeRun(shown, viewModel, app, navigator)
    }
}

/** Until the run starts; then it keeps its questions while answers refresh the practice. */
@Composable
private fun PracticeRead(
    viewModel: MistakePracticeViewModel,
    navigator: AppNavigator,
) {
    val onClose = navigator::closeTask
    val loaded by viewModel.practice.collectShown()
    val fresh by viewModel.practice.freshState.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()

    BackHandler(onBack = onClose)

    when (val read = loaded) {
        is LoadState.Loaded -> {
            LaunchedEffect(read.value, fresh) { viewModel.begin(read.value) }
            if (fresh is LoadState.Failed) {
                RunLoadFailed(onClose, onRetry = { scope.launch { viewModel.practice.refresh() } })
            } else {
                RunLoading(onClose)
            }
        }

        LoadState.Empty -> {
            if (viewModel.practicesAgain) {
                NothingToPractice(onClose)
            } else {
                LaunchedEffect(Unit) { viewModel.beginEmpty() }
                RunLoading(onClose)
            }
        }

        is LoadState.Failed -> {
            if (read.error == ApiError.NotFound) {
                TaskNotFound(navigator)
            } else {
                RunLoadFailed(onClose, onRetry = { scope.launch { viewModel.practice.refresh() } })
            }
        }

        else -> {
            RunLoading(onClose)
        }
    }
}

@Composable
internal fun PracticeRun(
    state: PracticeState,
    viewModel: MistakePracticeViewModel,
    app: AppContainer,
    navigator: AppNavigator,
) {
    val saveReport = rememberSaveFailureReport(app, "mistake-practice")
    val run = state.run
    val ending = run.phase == RunPhase.Finishing
    val endsRun = state.answerIds.isNotEmpty() && !ending
    BackHandler(onBack = viewModel::leave)

    if (ending) {
        if (state.read.tasks.isEmpty()) {
            AlreadyFixed(state, viewModel)
        } else {
            PracticeDone(state, viewModel, app) { navigator.open(AppRoute.Subscription) }
        }
        return
    }

    val questions = state.read.questions
    val task = state.read.tasks.getOrNull(run.index)
    val question = (task as? MistakePracticeTask.Bank)?.question
    if (task is MistakePracticeTask.Lesson) {
        key(run.index) {
            MistakeLessonQuestion(state, task, viewModel, app, navigator)
        }
        return
    }
    var saved by rememberDraft()
    val draft = saved.answerFor(run.index, question)

    RunFrame(
        title = stringResource(R.string.mistakes_practice_title),
        question = question,
        place = run.index,
        app = app,
        onClose = viewModel::leave,
        mainAction = answerAction(questions, question, run, draft, viewModel),
        report = runReportTarget("mistake-practice", question, run),
        progress = { MistakeSegments(state) },
        actions = {
            question?.let {
                AnswerActions(
                    questions,
                    it,
                    run,
                    draft,
                    viewModel,
                    ask = { RunAskButton(it, run, blockId = null, app, navigator) },
                    onReportSaveFailure = saveReport::open,
                    notSureOnEvery = true,
                )
            }
        },
        closeLabel = if (endsRun) stringResource(R.string.mistakes_practice_end) else null,
    ) { part, inlineSet, _ ->
        question?.let {
            key(run.index) {
                RunQuestion(
                    questions = questions,
                    run =
                        run.copy(
                            index =
                                state.read.tasks
                                    .take(run.index)
                                    .count { task -> task is MistakePracticeTask.Bank },
                        ),
                    question = it,
                    controls = viewModel,
                    words = state.read.words,
                    navigator = navigator,
                    part = part,
                    inlineSet = inlineSet,
                    draft = draft,
                    onDraft = { answer -> saved = Draft(run.index, it.itemId, answer) },
                )
            }
        }
    }
}

@Composable
private fun PracticeDone(
    state: PracticeState,
    viewModel: MistakePracticeViewModel,
    app: AppContainer,
    onSeePlus: () -> Unit,
) {
    val summary = state.end?.summary
    val fixed = state.fixedIds.size.takeIf { it > 0 }
    val move by viewModel.sessionMove.collectAsStateWithLifecycle()

    MomentAfterCeremony(app, summary?.ceremony, summary?.certificates.orEmpty().map { it.naming }, onSeePlus) { buddy ->
        RunFinished(
            title = stringResource(if (state.unsaved) R.string.mistakes_practice_not_saved else R.string.practice_done_title),
            action = stringResource(R.string.mistakes_practice_done),
            saving = state.finishing,
            onClose = viewModel::leave,
            error = unsavedLine(state, first = R.string.practice_save_error),
            actions = {
                when {
                    state.unsaved -> {
                        RetryFinish(state, viewModel)
                    }

                    viewModel.leadsOn -> {
                        SessionEndActions(
                            move,
                            completed = false,
                            canStop = true,
                            viewModel::stopSession,
                            viewModel::continueSession,
                        )
                    }

                    else -> {
                        DoneActions(state, viewModel)
                    }
                }
            },
        ) {
            MomentReadouts(
                brainPower = summary?.brainPower ?: 0,
                score = state.score,
                facts = listOfNotNull(fixed?.let { pluralStringResource(R.plurals.mistakes_practice_fixed, it, it) }),
            )
            DayMoment(
                missions = summary?.missionMoment?.missionMomentFacts(),
                reached = state.reached,
                ceremony = summary?.ceremony?.kind,
                buddy = buddy.look,
                buddyName = buddy.name,
            )
        }
    }
}

/** A day block whose mistakes were all fixed elsewhere: its completion is the only thing left to do. */
@Composable
private fun AlreadyFixed(
    state: PracticeState,
    viewModel: MistakePracticeViewModel,
) {
    RunFinished(
        title = stringResource(R.string.mistakes_practice_already_fixed),
        action = stringResource(R.string.mistakes_practice_done),
        saving = state.finishing,
        onClose = viewModel::leave,
        error = unsavedLine(state, first = R.string.mistakes_practice_not_marked),
        actions = {
            if (state.unsaved) {
                RetryFinish(state, viewModel)
            } else {
                val move by viewModel.sessionMove.collectAsStateWithLifecycle()
                // Done goes on as the block's Continue would: there was nothing to practice, so the day carries on.
                val onDone = if (viewModel.leadsOn) viewModel::continueSession else viewModel::leave
                TaskActions { width ->
                    Button(busy = state.finishing || move.busy, onClick = onDone, modifier = width) {
                        Text(stringResource(R.string.mistakes_practice_done))
                    }
                }
            }
        },
    ) {}
}

/** Under the title while a completion that didn't get through waits for "Try again". */
@Composable
private fun unsavedLine(
    state: PracticeState,
    @StringRes first: Int,
): String? =
    when {
        !state.unsaved || state.finishing -> null
        state.finishFailures > 1 -> stringResource(R.string.practice_save_error_repeat)
        else -> stringResource(first)
    }

@Composable
private fun RetryFinish(
    state: PracticeState,
    viewModel: MistakePracticeViewModel,
) {
    TaskActions { width ->
        Button(busy = state.finishing, onClick = viewModel::retryFinish, modifier = width) {
            Text(stringResource(R.string.practice_try_again))
        }
    }
}

/** Done goes back where the run came from; "Practice again" only while an earlier day's mistake is still open. */
@Composable
private fun DoneActions(
    state: PracticeState,
    viewModel: MistakePracticeViewModel,
) {
    if (state.offersAgain && state.again == AgainLoad.Failed) {
        Text(
            stringResource(R.string.practice_save_error),
            Modifier.semantics { liveRegion = LiveRegionMode.Polite },
            color = MaterialTheme.colorScheme.error,
            style = MaterialTheme.typography.bodyMedium,
        )
    }
    TaskActions { width ->
        if (viewModel.practicesAgain && state.offersAgain) {
            OutlinedButton(busy = state.again == AgainLoad.Loading, onClick = viewModel::practiceAgain) {
                Text(stringResource(R.string.mistakes_practice_again))
            }
        }
        Button(onClick = viewModel::leave, modifier = width, enabled = state.again != AgainLoad.Loading) {
            Text(stringResource(R.string.mistakes_practice_done))
        }
    }
}

@Composable
internal fun NothingToPractice(onClose: () -> Unit) {
    RunFinished(
        title = stringResource(R.string.mistakes_nothing_title),
        action = stringResource(R.string.navigation_back),
        saving = false,
        onClose = onClose,
    ) {}
}

private fun String.toUuid(): UUID? = runCatching { UUID.fromString(this) }.getOrNull()
