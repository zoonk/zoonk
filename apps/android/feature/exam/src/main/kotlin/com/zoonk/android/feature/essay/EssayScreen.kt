package com.zoonk.android.feature.essay

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.AnalyticsEvent
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.LiveGenerationSource
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.SessionState
import com.zoonk.android.data.TrackShown
import com.zoonk.android.data.collectShown
import com.zoonk.android.feature.feedback.rememberSaveFailureReport
import com.zoonk.android.feature.player.leaveTaskFor
import com.zoonk.android.feature.practice.RunColumn
import com.zoonk.android.feature.practice.RunLoadFailed
import com.zoonk.android.feature.practice.RunLoading
import com.zoonk.android.feature.practice.RunPage
import com.zoonk.android.feature.practice.SaveErrorText
import com.zoonk.android.feature.questions.QuestionTitle
import com.zoonk.android.feature.subscription.GateWords
import com.zoonk.android.feature.writing.WritingTaskName
import com.zoonk.android.feature.writing.writingTaskTitle
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.navigation.TaskNotFound
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.ButtonIcon
import com.zoonk.android.ui.components.IndeterminateWait
import com.zoonk.android.ui.components.KindMark
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.LearnKind
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LimitSubject
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.LocalStepHeading
import com.zoonk.android.ui.components.ModalBottomSheet
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.OutlinedTextField
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.components.TaskActionBar
import com.zoonk.android.ui.components.TaskActions
import com.zoonk.android.ui.components.TextButton
import com.zoonk.android.ui.components.bleed
import com.zoonk.android.ui.components.limitWords
import com.zoonk.android.ui.components.rememberMoveFocus
import com.zoonk.android.ui.components.taskColumn
import com.zoonk.android.ui.components.taskSideAction
import com.zoonk.android.ui.components.writingAreaColors
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.scaffold.TaskAside
import com.zoonk.android.ui.scaffold.TaskScaffold
import com.zoonk.android.ui.scaffold.pageTitle
import com.zoonk.android.ui.scaffold.taskAsideBeside
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.models.Essay
import com.zoonk.api.models.WritingPromptOutput
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.util.UUID
import kotlin.time.Duration.Companion.seconds

@Composable
fun EssayScreen(
    route: AppRoute.Essay,
    app: AppContainer,
    navigator: AppNavigator,
) {
    val session by app.sessions.state.collectAsStateWithLifecycle()
    val signedIn = (session as? SessionState.SignedIn)?.session
    val close = navigator::closeTask
    val blockId = remember(route.blockId) { runCatching { UUID.fromString(route.blockId) }.getOrNull() }
    val before = remember(route.writing) { WritingBefore.of(route.writing) }

    if (blockId == null) {
        TaskNotFound(navigator)
        return
    }
    if (signedIn == null) {
        RunLoading(close)
        return
    }

    val scope = androidx.compose.runtime.rememberCoroutineScope()
    val loaded by app.essays.essays[blockId].collectShown()
    when (val read = loaded) {
        is LoadState.Loaded -> {
            EssayLoaded(read.value, signedIn, app, navigator)
        }

        is LoadState.Failed -> {
            when {
                // A written question appears once its start admits it; until then the start's answer shows.
                read.error == ApiError.NotFound && before != null -> {
                    val refused =
                        route.taskDescription?.let { description ->
                            val name =
                                route.taskNumber?.let { number ->
                                    route.taskTotal?.let { WritingTaskName(route.taskLines, number, it, route.taskDistinctLines) }
                                }
                            RefusedTask(description, route.taskMinutes ?: 0, route.taskLines, route.drill, name)
                        }
                    WritingStart(blockId, before, route.drill, refused, signedIn, app, navigator)
                }

                read.error == ApiError.NotFound -> {
                    TaskNotFound(navigator)
                }

                else -> {
                    RunLoadFailed(close, onRetry = { scope.launch { app.essays.essays[blockId].refresh() } })
                }
            }
        }

        else -> {
            RunLoading(close)
        }
    }
}

@Composable
private fun WritingStart(
    blockId: UUID,
    before: WritingBefore,
    drill: Boolean,
    refused: RefusedTask?,
    signedIn: AuthenticatedSession,
    app: AppContainer,
    navigator: AppNavigator,
) {
    val viewModel =
        viewModel(key = "writing-start:$blockId:${signedIn.localId}") {
            WritingStartViewModel(blockId, before, drill, app.essays, LiveGenerationSource(app.api, signedIn))
        }
    val state by viewModel.state.collectAsStateWithLifecycle()
    val asking by viewModel.asking.collectAsStateWithLifecycle()
    val run by viewModel.run.collectAsStateWithLifecycle()
    val header = stringResource(if (drill) R.string.essay_writing_practice else R.string.essay_written_answer)

    when (val shown = state) {
        is WritingStartState.LimitReached -> {
            val task = shown.task ?: refused
            WritingRefused(
                task =
                    task?.let {
                        writingTaskTitle(drill = it.drill, task = it.name, fallback = it.description, lines = it.lines) to it.minutes
                    },
                busy = false,
                onContinue = navigator::closeTask,
                onClose = navigator::closeTask,
            )
        }

        WritingStartState.Ready -> {
            RunLoading(navigator::closeTask)
        }

        WritingStartState.Removed -> {
            WritingRemoved(header, onToday = { navigator.showRoot(AppTab.Today) }, onClose = navigator::closeTask)
        }

        is WritingStartState.Writing -> {
            TrackShown(AnalyticsEvent.WritingPromptWaitViewed(shown.generationId, AnalyticsEvent.WritingSurface.Practice))
            val exercise = shown.drill
            TaskScaffold(
                onClose = navigator::closeTask,
                title = { BarTitle(stringResource(if (exercise) R.string.essay_writing_practice else R.string.essay_written_answer)) },
            ) { padding ->
                RunColumn(Modifier.padding(padding)) {
                    // One model call writes the question: the wait says what's coming, with no steps it doesn't have.
                    IndeterminateWait(
                        title = stringResource(if (exercise) R.string.essay_writing_exercise else R.string.essay_writing_question),
                        description =
                            stringResource(
                                if (exercise) R.string.essay_writing_exercise_detail else R.string.essay_writing_question_detail,
                            ),
                        failedTitle = stringResource(if (exercise) R.string.essay_exercise_failed else R.string.essay_question_failed),
                        run = run,
                        onRetry = viewModel::retryRun,
                        titleModifier = Modifier.pageTitle(),
                    )
                }
            }
        }

        WritingStartState.Failed -> {
            RunPage(
                onClose = navigator::closeTask,
                title = { BarTitle(header) },
                bottomBar = {
                    TaskActionBar {
                        TaskActions { width ->
                            Button(
                                onClick = viewModel::retry,
                                modifier = width,
                                busy = asking,
                            ) { Text(stringResource(R.string.essay_try_again)) }
                        }
                    }
                },
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(
                        stringResource(if (drill) R.string.essay_exercise_failed else R.string.essay_question_failed),
                        Modifier.pageTitle(),
                        style = MaterialTheme.typography.headlineSmall,
                    )
                    Text(
                        stringResource(R.string.essay_nothing_lost),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodyLarge,
                    )
                }
            }
        }
    }
}

/** A notice read again dropped this task: nothing was admitted or graded, and Today goes on without it. */
@Composable
internal fun WritingRemoved(
    header: String,
    onToday: () -> Unit,
    onClose: () -> Unit,
) {
    RunPage(
        onClose = onClose,
        title = { BarTitle(header) },
        bottomBar = {
            TaskActionBar {
                TaskActions { width ->
                    Button(onClick = onToday, modifier = width) { Text(stringResource(R.string.essay_back_to_today)) }
                }
            }
        },
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(stringResource(R.string.essay_removed), Modifier.pageTitle(), style = MaterialTheme.typography.headlineSmall)
            Text(
                stringResource(R.string.essay_removed_detail),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyLarge,
            )
        }
    }
}

@Composable
private fun EssayLoaded(
    essay: Essay,
    signedIn: AuthenticatedSession,
    app: AppContainer,
    navigator: AppNavigator,
) {
    val viewModel =
        viewModel(key = "essay:${essay.blockId}:${signedIn.localId}") {
            EssayViewModel(essay.blockId, essay.sessionId, app.essays, app.essays.keptText(signedIn, essay.blockId), app.studyOpener)
        }
    val ui by viewModel.ui.collectAsStateWithLifecycle()
    val move by viewModel.move.collectAsStateWithLifecycle()

    LaunchedEffect(essay) { viewModel.arrive(essay) }
    LaunchedEffect(move.leaving) { move.leaving?.let(navigator::leaveTaskFor) }
    LifecycleEventEffect(Lifecycle.Event.ON_STOP) { viewModel.onStop() }

    val saveReport = rememberSaveFailureReport(app, "essay")
    val finishing = ui.finishing || move.busy
    val finishFailures = maxOf(ui.finishFailures, if (move.failed != null) 1 else 0)
    val latest = ui.latest

    when {
        ui.results == null -> {
            RunLoading(navigator::closeTask)
        }

        ui.closed && latest == null -> {
            SkippedEssay(essay, navigator)
        }

        ui.mode == WritingMode.Refused -> {
            WritingRefused(
                task =
                    writingTaskTitle(
                        drill = essay.writing.unit == WritingPromptOutput.Unit.DRILL,
                        task = null,
                        fallback = essay.writing.title,
                        lines = essay.writing.lines?.toInt(),
                    ) to essay.pacing.minutes.toInt(),
                busy = finishing,
                onContinue = viewModel::finish,
                onClose = navigator::closeTask,
            )
        }

        (ui.mode == WritingMode.Result || ui.closed) && latest != null -> {
            WritingResultScreen(essay, ui, latest, finishing, finishFailures, viewModel, navigator, saveReport::open)
        }

        ui.mode == WritingMode.Write -> {
            WriteScreen(essay, ui, viewModel, navigator)
        }

        else -> {
            WritingQuestionScreen(essay, ui, viewModel, navigator)
        }
    }
}

@Composable
private fun BarTitle(title: String) {
    Text(title, maxLines = 2, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center, style = MaterialTheme.typography.titleSmall)
}

@Composable
internal fun WritingQuestionScreen(
    essay: Essay,
    ui: EssayUi,
    viewModel: EssayViewModel,
    navigator: AppNavigator,
) {
    TaskScaffold(
        onClose = navigator::closeTask,
        title = { BarTitle(writingLabel(essay.writing)) },
        bottomBar = {
            TaskActionBar {
                TaskActions { width ->
                    Button(onClick = viewModel::startWriting, modifier = width, enabled = !ui.closed) {
                        Text(stringResource(if (ui.text.isNotBlank()) R.string.essay_continue else R.string.essay_write))
                    }
                }
            }
        },
    ) { padding ->
        RunColumn(Modifier.padding(padding)) {
            WritingQuestionPage(essay.writing, essay.pacing, essay.context, essay.question)
        }
    }
}

/** The field fills the screen; the question is one tap away on a phone and beside it where there's room. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun WriteScreen(
    essay: Essay,
    ui: EssayUi,
    viewModel: EssayViewModel,
    navigator: AppNavigator,
) {
    var questionOpen by rememberSaveable { mutableStateOf(false) }
    val field = remember { FocusRequester() }
    val moveFocus = rememberMoveFocus()
    val rewrite = ui.results.orEmpty().isNotEmpty()
    val fieldLabel = stringResource(if (rewrite) R.string.essay_rewrite_label else R.string.essay_your_answer)
    // The learner's cursor outlives the layouts that move the field.
    var value by rememberSaveable(stateSaver = TextFieldValue.Saver) { mutableStateOf(TextFieldValue(ui.text)) }

    LaunchedEffect(Unit) { if (ui.switched) moveFocus(field) }

    TaskScaffold(
        onClose = navigator::closeTask,
        title = { BarTitle(writingLabel(essay.writing)) },
        actions = {
            if (!taskAsideBeside()) {
                TextButton(onClick = { questionOpen = true }) { Text(stringResource(R.string.essay_question)) }
            }
        },
        aside =
            TaskAside(title = essay.writing.title) {
                WritingQuestionBody(essay.context, essay.question)
                WritingCriteriaSection(essay.writing)
            },
        bottomBar = {
            TaskActionBar {
                StatusLine(ui.send)
                TaskActions { width ->
                    if (ui.send == WritingSend.SignUpRequired) {
                        // Sending again would only meet the gate, so its way on is the bar's one action.
                        Button(onClick = { navigator.open(AppRoute.Login) }, modifier = width) {
                            Text(stringResource(R.string.limit_create_account))
                        }
                        return@TaskActions
                    }
                    Button(
                        busy = ui.send == WritingSend.Pending,
                        onClick = viewModel::send,
                        modifier = width,
                        enabled = ui.canSend,
                    ) {
                        Text(stringResource(if (rewrite) R.string.essay_grade_rewrite else R.string.essay_grade_answer))
                    }
                }
            }
        },
    ) { padding ->
        val beside = taskAsideBeside()
        LaunchedEffect(beside) { if (beside) questionOpen = false }

        Column(
            Modifier.padding(padding).fillMaxSize().padding(vertical = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Column(Modifier.taskColumn().weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = value.copy(text = ui.text),
                    onValueChange = {
                        value = it
                        if (it.text != ui.text) viewModel.write(it.text)
                    },
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .weight(1f)
                            .heightIn(min = FIELD_MIN_HEIGHT)
                            .focusRequester(field)
                            .semantics { contentDescription = fieldLabel },
                    readOnly = ui.send == WritingSend.Pending,
                    textStyle = MaterialTheme.typography.bodyLarge,
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
                    colors = writingAreaColors(),
                )
                WritingLineCount(ui.text, essay.writing)
            }
        }
    }

    if (questionOpen) {
        ModalBottomSheet(
            onDismissRequest = { questionOpen = false },
            sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        ) {
            SheetColumn {
                Text(essay.writing.title, Modifier.semantics { heading() }, style = MaterialTheme.typography.titleLarge)
                WritingQuestionBody(essay.context, essay.question)
                WritingCriteriaSection(essay.writing)
            }
        }
    }
}

/** "about 23 of 30 lines": the count stays in view under the field, and what's past the limit says so. */
@Composable
internal fun WritingLineCount(
    text: String,
    writing: WritingPromptOutput,
    modifier: Modifier = Modifier,
) {
    val limit = writing.lines?.toInt()
    val style = MaterialTheme.typography.labelMedium.withTabularFigures()
    if (limit == null) {
        val words =
            com.zoonk.android.feature.player.language
                .countWords(text)
        Text(
            androidx.compose.ui.res
                .pluralStringResource(R.plurals.essay_words, words, words),
            modifier,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = style,
        )
        return
    }
    val used =
        remember(text, writing.charactersPerLine, limit) { countWritingLines(text, writing.charactersPerLine.toInt(), limit).estimated }
    val over = used > limit
    Text(
        if (text.isBlank()) {
            stringResource(R.string.essay_lines_empty, limit)
        } else if (over) {
            stringResource(
                R.string.essay_lines_over,
                used,
                limit,
                used - limit,
            )
        } else {
            stringResource(R.string.essay_lines_used, used, limit)
        },
        modifier.semantics { liveRegion = LiveRegionMode.Polite },
        color = if (over) MaterialTheme.zoonk.warningText else MaterialTheme.colorScheme.onSurfaceVariant,
        style = style,
    )
}

@Composable
private fun StatusLine(send: WritingSend) {
    if (send == WritingSend.SignUpRequired) {
        val words = limitWords(Limit.SignUpRequired, LimitSubject.Help)
        GateWords(words.title, words.line, Modifier.semantics { liveRegion = LiveRegionMode.Polite })
        return
    }
    var slow by remember(send) { mutableStateOf(false) }
    LaunchedEffect(send) {
        if (send == WritingSend.Pending) {
            delay(SLOW_GRADING)
            slow = true
        }
    }
    val failed = send == WritingSend.Failed
    val line =
        when {
            failed -> stringResource(R.string.essay_send_failed)
            send == WritingSend.Pending -> stringResource(if (slow) R.string.essay_grading_slow else R.string.essay_grading)
            else -> return
        }
    Text(
        line,
        Modifier.semantics { liveRegion = if (failed) LiveRegionMode.Assertive else LiveRegionMode.Polite },
        color = if (failed) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
        style = MaterialTheme.typography.bodyMedium,
    )
}

@Composable
internal fun WritingResultScreen(
    essay: Essay,
    ui: EssayUi,
    latest: GradedAnswer,
    finishing: Boolean,
    finishFailures: Int,
    viewModel: EssayViewModel,
    navigator: AppNavigator,
    onReportSaveFailure: () -> Unit,
) {
    val heading = remember { FocusRequester() }
    val moveFocus = rememberMoveFocus()
    val grade = remember(latest.grade) { latest.grade.toGrade() }
    val done = remember(grade, latest.text) { grade.nextStep(latest.text) == NextStep.Done }

    LaunchedEffect(latest) { if (ui.switched) moveFocus(heading) }

    TaskScaffold(
        onClose = navigator::closeTask,
        title = { BarTitle(writingLabel(essay.writing)) },
        bottomBar = {
            TaskActionBar {
                if (ui.rewriteFailed && !ui.rewriting) {
                    Text(
                        stringResource(R.string.essay_finish_failed),
                        Modifier.semantics { liveRegion = LiveRegionMode.Assertive },
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
                if (finishFailures > 0 && !finishing) {
                    SaveErrorText(
                        failures = finishFailures,
                        firstFailureMessage = stringResource(R.string.essay_finish_failed),
                        liveRegion = LiveRegionMode.Assertive,
                        onReport = onReportSaveFailure,
                    )
                }
                TaskActions { width ->
                    if (ui.closed) {
                        Button(onClick = { navigator.showRoot(AppTab.Today) }, modifier = width) {
                            Text(stringResource(R.string.essay_back_to_today))
                        }
                    } else if (done) {
                        // Nothing left to work on: no rewrite to offer, so the bar's one action goes on.
                        Button(onClick = viewModel::finish, modifier = width, busy = finishing) {
                            Text(stringResource(R.string.essay_continue))
                        }
                    } else {
                        OutlinedButton(
                            busy = finishing,
                            onClick = viewModel::finish,
                            modifier = Modifier.taskSideAction(),
                            leadingIcon = { ButtonIcon(R.drawable.ic_skip_next) },
                        ) {
                            Text(stringResource(R.string.essay_skip_rewrite))
                        }
                        Button(onClick = viewModel::rewrite, modifier = width, busy = ui.rewriting, enabled = !ui.finished) {
                            Text(stringResource(R.string.essay_rewrite))
                        }
                    }
                }
            }
        },
    ) { padding ->
        CompositionLocalProvider(LocalStepHeading provides heading) {
            RunColumn(Modifier.padding(padding)) {
                WritingResultView(grade, essay.writing, latest.text)
            }
        }
    }
}

/**
 * Refused before writing: the day's extra grades are used, and the task waits for tomorrow, so
 * nothing written is ever lost to a limit. [task] is its title and minutes, when it's known.
 */
@Composable
internal fun WritingRefused(
    task: Pair<String, Int>?,
    busy: Boolean,
    onContinue: () -> Unit,
    onClose: () -> Unit,
) {
    RunPage(
        onClose = onClose,
        bottomBar = {
            TaskActionBar {
                TaskActions { width ->
                    Button(onClick = onContinue, modifier = width, busy = busy) { Text(stringResource(R.string.essay_continue)) }
                }
            }
        },
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Icon(
                painterResource(R.drawable.ic_schedule),
                contentDescription = null,
                modifier = Modifier.size(24.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(stringResource(R.string.essay_no_more_grading), Modifier.pageTitle(), style = MaterialTheme.typography.headlineSmall)
            Text(
                stringResource(R.string.essay_more_tomorrow),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyLarge,
            )
        }
        task?.let { (title, minutes) ->
            Column(Modifier.padding(top = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                SectionHeader(stringResource(R.string.essay_left_for_tomorrow))
                Column(Modifier.bleed(LIST_ITEM_INSET)) {
                    HorizontalDivider(Modifier.padding(horizontal = LIST_ITEM_INSET))
                    ListRow(
                        headline = { Text(title) },
                        leading = { KindMark(LearnKind.Essay) },
                        meta =
                            if (minutes > 0) {
                                {
                                    Text(
                                        formatMinutes(minutes, currentLocale()),
                                        style = MaterialTheme.typography.labelMedium.withTabularFigures(),
                                    )
                                }
                            } else {
                                null
                            },
                    )
                    HorizontalDivider(Modifier.padding(horizontal = LIST_ITEM_INSET))
                }
            }
        }
    }
}

@Composable
private fun SkippedEssay(
    essay: Essay,
    navigator: AppNavigator,
) {
    RunPage(
        onClose = navigator::closeTask,
        title = { BarTitle(writingLabel(essay.writing)) },
        bottomBar = {
            TaskActionBar {
                TaskActions { width ->
                    Button(onClick = { navigator.showRoot(AppTab.Today) }, modifier = width) {
                        Text(stringResource(R.string.essay_back_to_today))
                    }
                }
            }
        },
    ) {
        QuestionTitle(essay.writing.title)
        Text(
            stringResource(R.string.essay_skipped),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyLarge,
        )
    }
}

/** A past answer from the written part's page, read as its result was. */
@Composable
fun WritingAnswerScreen(
    route: AppRoute.WritingAnswer,
    app: AppContainer,
    navigator: AppNavigator,
) {
    val attemptId = remember(route.attemptId) { runCatching { UUID.fromString(route.attemptId) }.getOrNull() }
    if (attemptId == null) {
        TaskNotFound(navigator)
        return
    }
    val scope = androidx.compose.runtime.rememberCoroutineScope()
    val loaded by app.essays.attempts[attemptId].collectShown()
    when (val read = loaded) {
        is LoadState.Loaded -> {
            val answer = read.value
            val grade = remember(answer.grade) { answer.grade.toGrade() }
            RunPage(onClose = navigator::closeTask, title = { BarTitle(writingLabel(answer.writing)) }) {
                WritingResultView(grade, answer.writing, answer.text)
            }
        }

        is LoadState.Failed -> {
            if (read.error == ApiError.NotFound) {
                TaskNotFound(navigator)
            } else {
                RunLoadFailed(navigator::closeTask, onRetry = { scope.launch { app.essays.attempts[attemptId].refresh() } })
            }
        }

        else -> {
            RunLoading(navigator::closeTask)
        }
    }
}

private val FIELD_MIN_HEIGHT = 160.dp
private val SLOW_GRADING = 30.seconds
