package com.zoonk.android.feature.mistakes

import androidx.activity.compose.BackHandler
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
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
import com.zoonk.android.feature.practice.SaveErrorText
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
import com.zoonk.android.ui.components.MomentScore
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
            MistakePracticeViewModel(key, app.mistakes, app.todayChoices, app.sessions, saved = createSavedStateHandle())
        }
    val state by viewModel.state.collectAsStateWithLifecycle()
    val closed by viewModel.closed.collectAsStateWithLifecycle()

    LaunchedEffect(closed) { if (closed) navigator.closeTask() }

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
        val bar: @Composable () -> Unit = { DoneBar(state, viewModel, saveReport::open) }
        if (state.read.tasks.isEmpty()) {
            NothingToPractice(viewModel::leave, bar)
        } else {
            PracticeDone(state, app, onClose = viewModel::leave, bar = bar) { navigator.open(AppRoute.Subscription) }
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
    app: AppContainer,
    onClose: () -> Unit,
    bar: @Composable () -> Unit,
    onSeePlus: () -> Unit,
) {
    val summary = state.end?.summary
    val fixed = state.fixedIds.size

    MomentAfterCeremony(app, summary?.ceremony, summary?.certificates.orEmpty().map { it.naming }, onSeePlus) { buddy ->
        RunFinished(
            title = stringResource(if (state.unsaved) R.string.mistakes_practice_not_saved else R.string.practice_done_title),
            action = stringResource(R.string.mistakes_practice_done),
            saving = state.finishing,
            onClose = onClose,
            actions = bar,
        ) {
            MomentReadouts(
                brainPower = summary?.brainPower ?: 0,
                score = summary?.let { MomentScore(it.total.toInt(), it.correct.toInt()) },
                facts = listOfNotNull(fixed.takeIf { it > 0 }?.let { pluralStringResource(R.plurals.mistakes_practice_fixed, it, it) }),
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

/**
 * "Practice again" while this batch left a mistake open or the scope has more, else Done. A day
 * block's run waits for its completion, which marks its row on Today, and offers "Try again" when
 * it didn't get through; the rest are counted as they go.
 */
@Composable
private fun DoneBar(
    state: PracticeState,
    viewModel: MistakePracticeViewModel,
    onReport: () -> Unit,
) {
    val again = viewModel.practicesAgain && state.offersAgain

    when {
        state.unsaved -> {
            if (!state.finishing) {
                // An emptied block has no answers to keep, so the line says only that it didn't go through.
                val message =
                    stringResource(if (state.answerIds.isEmpty()) R.string.mistakes_practice_not_through else R.string.practice_save_error)
                SaveErrorText(state.finishFailures, onReport = onReport, firstFailureMessage = message)
            }
        }

        again && state.again == AgainLoad.Failed -> {
            SaveErrorText(
                1,
                onReport = onReport,
                firstFailureMessage = stringResource(R.string.mistakes_more_failed),
            )
        }
    }
    TaskActions { width ->
        when {
            state.unsaved -> {
                Button(busy = state.finishing, onClick = viewModel::retryFinish, modifier = width) {
                    Text(stringResource(R.string.practice_try_again))
                }
            }

            again -> {
                Button(busy = state.again == AgainLoad.Loading, onClick = viewModel::practiceAgain, modifier = width) {
                    Text(stringResource(R.string.mistakes_practice_again))
                }
            }

            else -> {
                Button(busy = state.finishing, onClick = viewModel::leave, modifier = width) {
                    Text(stringResource(R.string.mistakes_practice_done))
                }
            }
        }
    }
}

@Composable
internal fun NothingToPractice(
    onClose: () -> Unit,
    bar: (@Composable () -> Unit)? = null,
) {
    RunFinished(
        title = stringResource(R.string.mistakes_nothing_title),
        action = stringResource(R.string.navigation_back),
        saving = false,
        onClose = onClose,
        actions = bar,
    ) {}
}

private fun String.toUuid(): UUID? = runCatching { UUID.fromString(this) }.getOrNull()
