package com.zoonk.android.feature.focustest

import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Button
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.createSavedStateHandle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.GenerationFailure
import com.zoonk.android.data.GenerationKind
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.LiveGenerationSource
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.SessionState
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.ceremonies.MomentAfterCeremony
import com.zoonk.android.feature.practice.ActionColumn
import com.zoonk.android.feature.practice.BusyButton
import com.zoonk.android.feature.practice.ChoiceQuestionsRun
import com.zoonk.android.feature.practice.RunIntro
import com.zoonk.android.feature.practice.RunLoadFailed
import com.zoonk.android.feature.practice.RunLoading
import com.zoonk.android.feature.practice.RunPage
import com.zoonk.android.feature.practice.UndoAction
import com.zoonk.android.feature.practice.UndoState
import com.zoonk.android.feature.practice.UpcomingQuestions
import com.zoonk.android.feature.session.DayMoment
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.ui.components.CelebrationScope
import com.zoonk.android.ui.components.GenerationWait
import com.zoonk.android.ui.components.LimitNotice
import com.zoonk.android.ui.components.LimitSubject
import com.zoonk.android.ui.components.MeterPart
import com.zoonk.android.ui.components.MeterParts
import com.zoonk.android.ui.components.StepDots
import com.zoonk.android.ui.components.StepPagerActions
import com.zoonk.android.ui.components.TaskActionBar
import com.zoonk.android.ui.components.TaskActions
import com.zoonk.android.ui.components.rememberMoveFocus
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatList
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.scaffold.TaskScaffold
import com.zoonk.android.ui.theme.withTabularFigures
import kotlinx.coroutines.launch
import java.util.UUID
import kotlin.math.roundToInt

/** `/focus-test`: where the plan of the goal (the one in the switcher without one) goes deeper. */
@Composable
fun FocusTestScreen(
    route: AppRoute.FocusTest,
    app: AppContainer,
    navigator: AppNavigator,
) {
    val session by app.sessions.state.collectAsStateWithLifecycle()
    val signedIn = (session as? SessionState.SignedIn)?.session
    val summary by app.learnerSummary.summary.collectShown()
    val scope = rememberCoroutineScope()
    val close = navigator::closeTask
    val goalId =
        remember(route.goalId) { route.goalId?.let { runCatching { UUID.fromString(it) }.getOrNull() } } ?: summary.value?.activeGoalId

    if (signedIn == null || (goalId == null && summary !is LoadState.Loaded)) {
        if (summary is LoadState.Failed) {
            RunLoadFailed(close, onRetry = { scope.launch { app.learnerSummary.summary.refresh() } })
        } else {
            RunLoading(close)
        }
        return
    }
    if (goalId == null) {
        LaunchedEffect(Unit) { navigator.showRoot(AppTab.Today) }
        RunLoading(close)
        return
    }

    val viewModel =
        viewModel(key = "focus-test:$goalId:${signedIn.localId}") {
            FocusTestViewModel(
                goalId,
                app.focusTests,
                app.plans,
                LiveGenerationSource(app.api, signedIn),
                app.focusTests.answersDraft(signedIn, goalId),
                createSavedStateHandle(),
            )
        }
    val ui by viewModel.ui.collectAsStateWithLifecycle()
    val loaded by viewModel.test.collectShown()
    LifecycleEventEffect(Lifecycle.Event.ON_STOP) { viewModel.onStop() }

    ui.outcome?.let {
        FocusTestResult(it, ui, viewModel, app, navigator)
        return
    }

    when (val read = loaded) {
        is LoadState.Loaded -> {
            LaunchedEffect(read.value) { viewModel.arrive(read.value) }
            when {
                ui.started && ui.questions.isNotEmpty() -> FocusTestQuestions(read.value, ui, viewModel, app, close)
                ui.started && ui.writing -> FocusTestWriting(viewModel, close)
                else -> FocusTestIntro(read.value, ui, viewModel, navigator)
            }
        }

        is LoadState.Failed -> {
            if (read.error == ApiError.NotFound) {
                LaunchedEffect(Unit) { navigator.showRoot(AppTab.Plan) }
                RunLoading(close)
            } else {
                RunLoadFailed(close, onRetry = { scope.launch { viewModel.test.refresh() } })
            }
        }

        else -> {
            RunLoading(close)
        }
    }
}

@Composable
internal fun FocusTestIntro(
    read: FocusTestRead,
    ui: FocusTestUi,
    viewModel: FocusTestViewModel,
    navigator: AppNavigator,
) {
    if (ui.startFailed) {
        FocusTestWaitScreen(GenerationRun(GenerationRun.Status.Failed, GenerationFailure.NotStarted), {
            viewModel.start(read)
        }, navigator::closeTask)
        return
    }
    val minutes = maxOf(1, (read.total * SECONDS_PER_QUESTION / SECONDS_PER_MINUTE.toFloat()).roundToInt())
    val refused = ui.refused

    TaskScaffold(
        onClose = navigator::closeTask,
        bottomBar = {
            TaskActionBar {
                if (refused != null) {
                    LimitNotice(
                        refused,
                        LimitSubject.Help,
                        onCreateAccount = { navigator.open(AppRoute.Login) },
                        onSeePlus = { navigator.open(AppRoute.Subscription) },
                    )
                } else {
                    TaskActions { width ->
                        BusyButton(
                            stringResource(if (ui.starting) R.string.focustest_starting else R.string.focustest_start),
                            busy = ui.starting,
                            enabled = true,
                            modifier = width,
                        ) { viewModel.start(read) }
                    }
                }
            }
        },
    ) { padding ->
        RunPage(Modifier.padding(padding)) {
            RunIntro(
                stringResource(R.string.focustest_intro_title),
                stringResource(R.string.focustest_intro_detail),
                facts =
                    listOf(
                        pluralStringResource(R.plurals.focustest_subjects, read.areas.size, read.areas.size),
                        pluralStringResource(R.plurals.focustest_questions, read.total, read.total),
                        stringResource(R.string.focustest_about, formatMinutes(minutes, currentLocale())),
                    ),
            )
        }
    }
}

@Composable
private fun FocusTestWriting(
    viewModel: FocusTestViewModel,
    onClose: () -> Unit,
) {
    val run by viewModel.run.collectAsStateWithLifecycle()
    FocusTestWaitScreen(run, viewModel::retryWriting.takeIf { viewModel.canRestart }, onClose)
}

@Composable
private fun FocusTestWaitScreen(
    run: GenerationRun,
    onRetry: (() -> Unit)?,
    onClose: () -> Unit,
) {
    TaskScaffold(onClose = onClose) { padding ->
        RunPage(Modifier.padding(padding)) {
            GenerationWait(GenerationKind.FocusTestQuestions, run, onRetry) {
                RunIntro(stringResource(R.string.focustest_writing_title), stringResource(R.string.focustest_writing_detail))
            }
        }
    }
}

@Composable
internal fun FocusTestQuestions(
    read: FocusTestRead,
    ui: FocusTestUi,
    viewModel: FocusTestViewModel,
    app: AppContainer,
    onClose: () -> Unit,
) {
    val run by viewModel.run.collectAsStateWithLifecycle()
    val ended = run.status == GenerationRun.Status.Ready || run.status == GenerationRun.Status.Failed
    val upcoming = UpcomingQuestions(read.total, ended).takeIf { ui.writing && ui.questions.size < read.total }

    ChoiceQuestionsRun(
        title = stringResource(R.string.focustest_title),
        questions = ui.questions,
        answered = ui.answers.size,
        words = read.words,
        app = app,
        screen = "focus-test",
        pending = ui.sending,
        failed = ui.sendFailed,
        onAnswer = viewModel::answer,
        onSend = viewModel::send,
        onClose = onClose,
        hint = { it.area },
        upcoming = upcoming,
        waiting = {
            GenerationWait(GenerationKind.FocusTestQuestions, run, viewModel::retryWriting.takeIf { viewModel.canRestart }) {
                if (run.status == GenerationRun.Status.Ready) {
                    RunIntro(stringResource(R.string.focustest_ended_title), stringResource(R.string.focustest_ended_detail))
                } else {
                    RunIntro(stringResource(R.string.focustest_waiting_title), stringResource(R.string.focustest_waiting_detail))
                }
            }
        },
    )
}

@Composable
internal fun FocusTestResult(
    outcome: FocusTestOutcome,
    ui: FocusTestUi,
    viewModel: FocusTestViewModel,
    app: AppContainer,
    navigator: AppNavigator,
) {
    val chosen = outcome.areas.filter { it.chosen }.map { it.label }
    var index by rememberSaveable { mutableIntStateOf(0) }
    var leftFirst by rememberSaveable { mutableStateOf(false) }
    val count = if (chosen.isEmpty()) 1 else 2
    val shown = index.coerceIn(0, count - 1)
    val canUndo = outcome.changeId != null && ui.undo != UndoState.Done
    val stepTitle = remember { FocusRequester() }
    val moveFocus = rememberMoveFocus()
    var announced by rememberSaveable { mutableIntStateOf(shown) }

    // Main's `focusStepTitle`: a new step takes TalkBack to its heading, never the first one.
    LaunchedEffect(shown) {
        if (shown != announced) {
            announced = shown
            moveFocus(stepTitle)
        }
    }

    MomentAfterCeremony(app, outcome.ceremony.takeIf { ui.celebrate }) { buddy ->
        TaskScaffold(
            onClose = navigator::closeTask,
            title = { StepDots(count, shown) },
            bottomBar = {
                TaskActionBar {
                    ActionColumn {
                        StepPagerActions(
                            count,
                            shown,
                            onIndexChange = {
                                if (shown == 0) leftFirst = true
                                index = it
                            },
                        ) { main ->
                            Button(
                                onClick = { navigator.showRoot(AppTab.Plan) },
                                modifier = main,
                            ) { Text(stringResource(R.string.focustest_see_plan)) }
                        }
                        if (canUndo && shown == count - 1) UndoAction(ui.undo, viewModel::undo)
                    }
                }
            },
        ) { padding ->
            RunPage(Modifier.padding(padding)) {
                if (shown == 0) {
                    CelebrationScope(play = ui.celebrate && !leftFirst) {
                        AreasStep(outcome, stepTitle)
                        DayMoment(
                            missions = null,
                            reached = outcome.reached,
                            ceremony = outcome.ceremony?.kind,
                            buddy = buddy.look,
                            buddyName = buddy.name,
                        )
                    }
                } else {
                    FocusStep(chosen, undone = ui.undo == UndoState.Done, stepTitle)
                }
            }
        }
    }
}

@Composable
private fun AreasStep(
    outcome: FocusTestOutcome,
    title: FocusRequester,
) {
    Column {
        Text(
            stringResource(R.string.focustest_how_you_did),
            modifier = Modifier.stepTitle(title).padding(bottom = 20.dp),
            style = MaterialTheme.typography.headlineSmall,
        )
        outcome.areas.forEachIndexed { index, area ->
            if (index > 0) HorizontalDivider()
            val right = area.answers.count { it }
            val score = pluralStringResource(R.plurals.focustest_area_right, right, right, area.answers.size)
            Row(
                Modifier.heightIn(min = 48.dp).padding(vertical = 12.dp).semantics(mergeDescendants = true) {},
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(area.label, modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodyLarge)
                Row(
                    Modifier.clearAndSetSemantics { contentDescription = score },
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    MeterParts(
                        area.answers.map {
                            MeterPart(MeterPart.Fill.Solid(if (it) MaterialTheme.colorScheme.tertiary else MaterialTheme.colorScheme.error))
                        },
                        modifier = Modifier.width(SEGMENTS_WIDTH),
                    )
                    Text(
                        "$right/${area.answers.size}",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.labelMedium.withTabularFigures(),
                    )
                }
            }
        }
    }
}

@Composable
private fun FocusStep(
    chosen: List<String>,
    undone: Boolean,
    title: FocusRequester,
) {
    if (undone) {
        Text(
            stringResource(R.string.focustest_undone),
            modifier = Modifier.stepTitle(title).semantics { liveRegion = LiveRegionMode.Polite },
            style = MaterialTheme.typography.headlineSmall,
        )
        return
    }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            stringResource(R.string.focustest_new_focus),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.labelLarge,
        )
        Text(formatList(chosen, currentLocale()), modifier = Modifier.stepTitle(title), style = MaterialTheme.typography.headlineSmall)
        Text(
            stringResource(if (chosen.size == 1) R.string.focustest_focus_detail_one else R.string.focustest_focus_detail_several),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyLarge,
        )
    }
}

private fun Modifier.stepTitle(focus: FocusRequester) = focusRequester(focus).focusable().semantics { heading() }

private const val SECONDS_PER_QUESTION = 30
private const val SECONDS_PER_MINUTE = 60
private val SEGMENTS_WIDTH = 64.dp
