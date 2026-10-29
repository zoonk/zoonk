package com.zoonk.android.feature.mock.runner

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.VerticalDivider
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.LifecycleStartEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.Resource
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
import com.zoonk.android.ui.scaffold.PageWithSupportingPane
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
    val account = app.sessions.current?.localId
    key(account) {
        val opening = viewModel(key = "mock-open-${route.blockId}-$account") { MockOpening(store.open(route.blockId)) }
        val state by opening.mock.collectShown()
        val scope = rememberCoroutineScope()
        val loaded = state.value

        when {
            loaded == null -> {
                TaskScaffold(onClose = { navigator.closeTask() }) { padding ->
                    Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                        val current = state
                        when {
                            current is LoadState.Failed && current.error != ApiError.NotFound -> {
                                LoadFailedMessage(onRetry = { scope.launch { opening.mock.refresh() } })
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
            loaded.view.status == MockExam.Status.READY -> {
                LaunchedEffect(loaded.view.planItemId) {
                    navigator.closeTask()
                    loaded.view.planItemId?.let { navigator.open(AppRoute.Challenge(it.toString(), route.sessionId)) }
                }
            }

            else -> {
                val viewModel =
                    viewModel(key = "mock-${route.blockId}-$account") {
                        MockRunnerViewModel(store, app.sessions, route.blockId, loaded, reread = opening.mock::refresh)
                    }
                LaunchedEffect(loaded) { viewModel.show(loaded.view) }
                LifecycleStartEffect(viewModel) {
                    viewModel.onStart()
                    onStopOrDispose { viewModel.onStop() }
                }
                MockRunScreen(viewModel, route, navigator, MockAudio(app.speech, app.listeningPlays, app.sessions.current))
            }
        }
    }
}

/** One opening of a mock: its read lives as long as the screen, so leaving and opening it again reads it again. */
internal class MockOpening(
    val mock: Resource<OpenedMock>,
) : ViewModel()

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
    var leaving by remember { mutableStateOf(false) }
    // Pressed again while answers go out, it still closes only the mock.
    val leave: () -> Unit = {
        if (!leaving) {
            leaving = true
            scope.launch {
                viewModel.leave()
                navigator.closeTask()
            }
        }
    }
    val view = run.view
    val current = view.current

    BackHandler(onBack = leave)

    when {
        view.status == MockExam.Status.EXPIRED -> MockExpired(viewModel, run, route, navigator, leave)
        view.status == MockExam.Status.FINISHED -> MockFinished(run, navigator)
        view.breakUntil != null && current == null -> MockBreak(viewModel, run, view.breakUntil!!, leave)
        current != null && run.timeUp -> MockTimeUp(viewModel, run, leave)
        current?.kind == MockExamCurrent.Kind.SPEAKING -> MockSpeaking(viewModel, run, current, navigator, leave)
        current != null -> MockRunnerView(viewModel, run, current, audio, leave)
        else -> MockHandedIn(viewModel, run, leave)
    }
}

/**
 * A step's frame: the task's close, one centered column, its actions pinned below with what's
 * saving. [title] is the top bar's (a clock); an [aside] shows beside the column where there's
 * room, and not at all where there isn't, as main's step asides.
 */
@Composable
internal fun MockStepFrame(
    viewModel: MockRunnerViewModel,
    run: MockRun,
    onClose: () -> Unit,
    actions: @Composable () -> Unit,
    title: @Composable () -> Unit = {},
    aside: (@Composable ColumnScope.() -> Unit)? = null,
    asideTitle: String = "",
    content: @Composable () -> Unit,
) {
    TaskScaffold(
        onClose = onClose,
        title = title,
        bottomBar = {
            MockActionBar {
                MockStepStatus(viewModel, run)
                actions()
            }
        },
    ) { padding ->
        if (aside == null) {
            StepColumn(Modifier.padding(padding), content)
        } else {
            PageWithSupportingPane(
                modifier = Modifier.padding(padding),
                supportingPane = { StepAside(asideTitle, aside) },
            ) { StepColumn(Modifier, content) }
        }
    }
}

@Composable
private fun StepColumn(
    modifier: Modifier,
    content: @Composable () -> Unit,
) {
    Box(modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
        Column(
            Modifier
                .widthIn(max = COLUMN_WIDTH)
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(STEP_PADDING),
            verticalArrangement = Arrangement.spacedBy(24.dp),
        ) { content() }
    }
}

@Composable
private fun StepAside(
    title: String,
    content: @Composable ColumnScope.() -> Unit,
) {
    Row {
        VerticalDivider()
        Column(
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(STEP_PADDING)
                .semantics { paneTitle = title },
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(title, Modifier.semantics { heading() }, style = MaterialTheme.typography.titleMedium)
            content()
        }
    }
}

/** Main's step header: an icon set apart, then what says where the learner is, close together. */
@Composable
internal fun StepHeader(
    icon: Int? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
        icon?.let { Icon(painterResource(it), contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant) }
        Column(verticalArrangement = Arrangement.spacedBy(6.dp), content = content)
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
            Row(live, verticalAlignment = Alignment.CenterVertically) {
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

/** A step's main action. Busy, it keeps its ink and shows a wheel, as main's does. */
@Composable
internal fun MockMainButton(
    text: String,
    busy: Boolean,
    enabled: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors =
        if (busy) {
            ButtonDefaults.buttonColors(
                disabledContainerColor = MaterialTheme.colorScheme.primary,
                disabledContentColor = MaterialTheme.colorScheme.onPrimary,
            )
        } else {
            ButtonDefaults.buttonColors()
        }

    Button(onClick = onClick, enabled = enabled && !busy, modifier = modifier.heightIn(min = 48.dp), colors = colors) {
        if (busy) {
            CircularProgressIndicator(
                Modifier.padding(end = 8.dp).size(18.dp),
                strokeWidth = 2.dp,
                color = LocalContentColor.current,
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
                modifier = Modifier.fillMaxWidth(),
            )
        },
    ) {
        StepHeader(R.drawable.ic_timer_off) {
            MockEyebrow(run.view)
            StepTitle(stringResource(R.string.mock_time_up))
            if (saveStatus == DraftSaveStatus.Saved) StepDetail(stringResource(R.string.mock_answers_saved))
        }
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
                modifier = Modifier.fillMaxWidth(),
            )
        },
    ) { StepHeader { StepTitle(stringResource(R.string.mock_handed_in_title)) } }
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
                modifier = Modifier.fillMaxWidth(),
            )
        },
        aside = if (run.view.sections.size > 1) ({ SheetSections(run, titled = false) }) else null,
        asideTitle = stringResource(R.string.mock_sections),
    ) {
        StepHeader {
            StepTitle(stringResource(R.string.mock_break))
            Text(
                formatClock(remaining),
                Modifier.padding(top = 6.dp).semantics { contentDescription = "$label ${formatClock(remaining)}" },
                style = MaterialTheme.typography.displayMedium.withTabularFigures(),
            )
            StepDetail(stringResource(R.string.mock_break_detail))
        }
        if (next != null) {
            Column {
                HorizontalDivider()
                Row(
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 56.dp)
                        .padding(vertical = 8.dp)
                        .semantics(mergeDescendants = true) {},
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text(
                            next.name?.let { stringResource(R.string.mock_next_named, it) } ?: stringResource(R.string.mock_next_section),
                            style = MaterialTheme.typography.titleSmall,
                        )
                        next.tools?.let {
                            Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                    Text(
                        formatDuration(next.minutes * SECONDS_PER_MINUTE, currentLocale()),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.labelMedium.withTabularFigures(),
                    )
                }
                HorizontalDivider()
            }
        }
    }
}

@Composable
private fun MockExpired(
    viewModel: MockRunnerViewModel,
    run: MockRun,
    route: AppRoute.Mock,
    navigator: AppNavigator,
    onClose: () -> Unit,
) {
    MockStepFrame(
        viewModel,
        run,
        onClose,
        actions = {
            Button(
                onClick = {
                    navigator.closeTask()
                    navigator.open(run.view.planItemId?.let { AppRoute.Challenge(it.toString(), route.sessionId) } ?: AppRoute.MockChooser)
                },
                modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
            ) { Text(stringResource(R.string.mock_take_new)) }
        },
    ) {
        StepHeader(R.drawable.ic_timer_off) {
            MockEyebrow(run.view)
            StepTitle(stringResource(R.string.mock_expired_title))
            StepDetail(stringResource(R.string.mock_expired_detail))
        }
    }
}

internal val COLUMN_WIDTH = 640.dp
internal val STEP_PADDING = PaddingValues(horizontal = 16.dp, vertical = 24.dp)
private const val SECONDS_PER_MINUTE = 60L
