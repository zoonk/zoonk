package com.zoonk.android.feature.mock.runner

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.LifecycleStartEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.mock.mockShapeLabel
import com.zoonk.android.feature.mock.rememberNow
import com.zoonk.android.feature.questions.formatClock
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.components.StatusMessage
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDuration
import com.zoonk.android.ui.scaffold.TaskScaffold
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.MockExam
import com.zoonk.api.models.MockExamCurrent
import kotlinx.coroutines.launch
import kotlin.time.Duration.Companion.seconds

/** Main's `/mock/{blockId}`: a mock in exam-room conditions, from its first section to its result. */
@Composable
fun MockScreen(
    route: AppRoute.Mock,
    app: AppContainer,
    navigator: AppNavigator,
    store: MockRunStore = app.mockRuns,
) {
    val resource = store.mock[route.blockId]
    val state by resource.collectShown()
    val scope = rememberCoroutineScope()
    val loaded = state.value

    when {
        loaded == null -> {
            TaskScaffold(onClose = { navigator.closeTask() }) { padding ->
                Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                    val current = state
                    when {
                        current is LoadState.Failed && current.error != ApiError.NotFound -> {
                            LoadFailedMessage(
                                onRetry = { scope.launch { resource.refresh() } },
                            )
                        }

                        current is LoadState.Failed || current is LoadState.Empty -> {
                            MockNotFound(navigator)
                        }

                        else -> {
                            CircularProgressIndicator()
                        }
                    }
                }
            }
        }

        // Before it starts, a mock is its challenge's intro: when it is, its size, Start.
        loaded.status == MockExam.Status.READY -> {
            LaunchedEffect(loaded.planItemId) {
                navigator.closeTask()
                loaded.planItemId?.let { navigator.open(AppRoute.Challenge(it.toString(), route.sessionId)) }
            }
        }

        else -> {
            key(app.sessions.current?.localId) {
                val viewModel =
                    viewModel(key = "mock-${route.blockId}-${app.sessions.current?.localId}") {
                        MockRunnerViewModel(store, app.sessions, route.blockId, loaded)
                    }
                LaunchedEffect(loaded) { viewModel.show(loaded) }
                LifecycleStartEffect(viewModel) {
                    viewModel.onStart()
                    onStopOrDispose {}
                }
                MockRunScreen(viewModel, route, navigator, MockAudio(app.speech, app.listeningPlays, app.sessions.current))
            }
        }
    }
}

@Composable
private fun MockNotFound(navigator: AppNavigator) {
    StatusMessage(
        icon = R.drawable.ic_search_off,
        title = stringResource(R.string.mock_not_found_title),
        description = stringResource(R.string.mock_not_found_description),
    ) {
        Button(
            onClick = {
                navigator.closeTask()
                navigator.showRoot(AppTab.Today)
            },
        ) { Text(stringResource(R.string.mock_go_to_today)) }
    }
}

@Composable
private fun MockRunScreen(
    viewModel: MockRunnerViewModel,
    route: AppRoute.Mock,
    navigator: AppNavigator,
    audio: MockAudio,
) {
    val run by viewModel.state.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()
    val leave: () -> Unit = {
        scope.launch {
            viewModel.leave()
            navigator.closeTask()
        }
    }
    val view = run.view
    val current = view.current

    BackHandler(onBack = leave)

    when {
        view.status == MockExam.Status.EXPIRED -> MockExpired(view, route, navigator)
        view.status == MockExam.Status.FINISHED -> MockFinished(run, navigator)
        view.breakUntil != null && current == null -> MockBreak(viewModel, run, view.breakUntil!!, leave)
        current != null && run.timeUp -> MockTimeUp(viewModel, run, leave)
        current?.kind == MockExamCurrent.Kind.SPEAKING -> MockSpeaking(viewModel, run, current, navigator, leave)
        current != null -> MockRunnerView(viewModel, run, current, audio, leave)
        else -> MockHandedIn(viewModel, run, leave)
    }
}

/** A step's frame: the task's close, one centered column, its actions pinned below with what's saving. */
@Composable
internal fun MockStepFrame(
    viewModel: MockRunnerViewModel,
    run: MockRun,
    onClose: () -> Unit,
    actions: @Composable () -> Unit,
    content: @Composable () -> Unit,
) {
    TaskScaffold(
        onClose = onClose,
        bottomBar = {
            MockActionBar {
                MockStepStatus(viewModel, run)
                actions()
            }
        },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.TopCenter) {
            Column(
                Modifier
                    .widthIn(max = COLUMN_WIDTH)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(STEP_PADDING),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) { content() }
        }
    }
}

/** Main's `MockStepStatus`: whether answers are saving, and a step that didn't go through or is slow. */
@Composable
internal fun MockStepStatus(
    viewModel: MockRunnerViewModel,
    run: MockRun,
) {
    val saveStatus by viewModel.saveStatus.collectAsStateWithLifecycle()
    val live = Modifier.semantics { liveRegion = LiveRegionMode.Polite }

    when (saveStatus) {
        DraftSaveStatus.Retrying -> {
            androidx.compose.foundation.layout.Row(live, verticalAlignment = Alignment.CenterVertically) {
                Text(
                    stringResource(R.string.mock_not_saved_retrying),
                    Modifier.weight(1f),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
                TextButton(onClick = viewModel::retrySaves) { Text(stringResource(R.string.mock_retry)) }
            }
        }

        DraftSaveStatus.Refused -> {
            Text(
                stringResource(R.string.mock_last_not_saved),
                Modifier.semantics {
                    liveRegion = LiveRegionMode.Assertive
                },
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodyMedium,
            )
        }

        DraftSaveStatus.Saved, DraftSaveStatus.Saving -> {}
    }

    when {
        run.error -> {
            Text(
                stringResource(if (saveStatus == DraftSaveStatus.Saved) R.string.mock_step_failed_saved else R.string.mock_step_failed),
                Modifier.semantics { liveRegion = LiveRegionMode.Assertive },
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodyMedium,
            )
        }

        run.slow -> {
            Text(
                stringResource(R.string.mock_step_slow),
                live,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
    }
}

/** A step's pinned actions keep to the task's column on wide windows, as main's footer does. */
@Composable
internal fun MockActionBar(content: @Composable ColumnScope.() -> Unit) {
    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
        Column(Modifier.widthIn(max = COLUMN_WIDTH).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp), content = content)
    }
}

/** The pinned main action of a step, with a wheel while it's busy. */
@Composable
internal fun MockMainButton(
    text: String,
    busy: Boolean,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    Button(onClick = onClick, enabled = enabled && !busy, modifier = Modifier.fillMaxWidth()) {
        if (busy) {
            CircularProgressIndicator(
                Modifier.padding(end = 8.dp).size(18.dp),
                strokeWidth = 2.dp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Text(text)
    }
}

/** "Mock exam · Mathematics". */
@Composable
internal fun MockEyebrow(view: MockExam) {
    val shape = mockShapeLabel(view.purpose == MockExam.Purpose.PLACEMENT, view.shape)
    Text(
        if (shape.isEmpty()) stringResource(R.string.mock_label) else stringResource(R.string.mock_label_shape, shape),
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        style = MaterialTheme.typography.labelLarge,
    )
}

@Composable
internal fun StepTitle(text: String) {
    Text(text, Modifier.semantics { heading() }, style = MaterialTheme.typography.headlineSmall)
}

@Composable
internal fun StepDetail(text: String) {
    Text(text, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyLarge)
}

/** A clock never starts grading: time closes the answers, and the learner hands them in. */
@Composable
private fun MockTimeUp(
    viewModel: MockRunnerViewModel,
    run: MockRun,
    onClose: () -> Unit,
) {
    val saveStatus by viewModel.saveStatus.collectAsStateWithLifecycle()
    val isLast =
        run.view.current
            ?.section
            ?.toInt() == run.view.sections.lastIndex
    val handingIn = run.busy == MockStep.Submit

    MockStepFrame(
        viewModel,
        run,
        onClose,
        actions = {
            MockMainButton(
                text =
                    when {
                        handingIn -> stringResource(R.string.mock_handing_in)
                        isLast -> stringResource(R.string.mock_see_how)
                        else -> stringResource(R.string.mock_continue_section)
                    },
                busy = handingIn,
                enabled = !run.pending,
                onClick = viewModel::submitSection,
            )
        },
    ) {
        Icon(painterResource(R.drawable.ic_timer_off), contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
        MockEyebrow(run.view)
        StepTitle(stringResource(R.string.mock_time_up))
        if (saveStatus == DraftSaveStatus.Saved) StepDetail(stringResource(R.string.mock_answers_saved))
    }
}

/** Handed in but not graded yet, as when grading didn't go through. */
@Composable
private fun MockHandedIn(
    viewModel: MockRunnerViewModel,
    run: MockRun,
    onClose: () -> Unit,
) {
    val finishing = run.busy == MockStep.Finish
    MockStepFrame(
        viewModel,
        run,
        onClose,
        actions = {
            MockMainButton(
                text = stringResource(if (finishing) R.string.mock_grading else R.string.mock_see_how),
                busy = finishing,
                enabled = !run.pending,
                onClick = viewModel::finish,
            )
        },
    ) { StepTitle(stringResource(R.string.mock_handed_in_title)) }
}

/** When the break ends, its clock already started the next section on the server; this shows it. */
@Composable
private fun MockBreak(
    viewModel: MockRunnerViewModel,
    run: MockRun,
    until: kotlin.time.Instant,
    onClose: () -> Unit,
) {
    val now by rememberNow(1.seconds)
    val remaining = (until - now).inWholeMilliseconds.coerceAtLeast(0)
    val next = run.currentSection
    val label = stringResource(R.string.mock_break_time_left)

    LaunchedEffect(remaining == 0L) { if (remaining == 0L) viewModel.endBreak() }

    MockStepFrame(
        viewModel,
        run,
        onClose,
        actions = {
            MockMainButton(
                stringResource(R.string.mock_start_next),
                busy = run.busy == MockStep.EndBreak,
                enabled = !run.pending,
                onClick = viewModel::endBreak,
            )
        },
    ) {
        StepTitle(stringResource(R.string.mock_break))
        Text(
            formatClock(remaining),
            Modifier.semantics { contentDescription = "$label ${formatClock(remaining)}" },
            style = MaterialTheme.typography.displayMedium.withTabularFigures(),
        )
        StepDetail(stringResource(R.string.mock_break_detail))
        if (next != null) {
            HorizontalDivider()
            androidx.compose.foundation.layout.Row(
                Modifier.fillMaxWidth().padding(vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(
                        next.name?.let {
                            stringResource(R.string.mock_next_named, it)
                        } ?: stringResource(R.string.mock_next_section),
                        fontWeight = FontWeight.Medium,
                    )
                    next.tools?.let {
                        Text(
                            it,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            style = MaterialTheme.typography.bodyMedium,
                        )
                    }
                }
                Text(
                    formatDuration(next.minutes * SECONDS_PER_MINUTE, currentLocale()),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.labelMedium.withTabularFigures(),
                )
            }
            HorizontalDivider()
            if (run.view.sections.size > 1) SheetSections(run)
        }
    }
}

@Composable
private fun MockExpired(
    view: MockExam,
    route: AppRoute.Mock,
    navigator: AppNavigator,
) {
    TaskScaffold(
        onClose = { navigator.closeTask() },
        bottomBar = {
            MockActionBar {
                Button(
                    onClick = {
                        navigator.closeTask()
                        navigator.open(view.planItemId?.let { AppRoute.Challenge(it.toString(), route.sessionId) } ?: AppRoute.MockChooser)
                    },
                    modifier = Modifier.fillMaxWidth(),
                ) { Text(stringResource(R.string.mock_take_new)) }
            }
        },
    ) { padding ->
        Column(
            Modifier.fillMaxSize().padding(padding).padding(STEP_PADDING),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Icon(painterResource(R.drawable.ic_timer_off), contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
            MockEyebrow(view)
            StepTitle(stringResource(R.string.mock_expired_title))
            StepDetail(stringResource(R.string.mock_expired_detail))
        }
    }
}

internal val COLUMN_WIDTH = 640.dp
internal val STEP_PADDING = PaddingValues(horizontal = 16.dp, vertical = 24.dp)
private const val SECONDS_PER_MINUTE = 60L
