package com.zoonk.android.feature.essay

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.input.InputTransformation
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
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
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardCapitalization
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
import com.zoonk.android.data.GenerationRun
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
import com.zoonk.android.feature.session.WritingRow
import com.zoonk.android.feature.subscription.GateWords
import com.zoonk.android.feature.today.TodayRead
import com.zoonk.android.feature.writing.WritingTaskName
import com.zoonk.android.feature.writing.gradingReturnsLine
import com.zoonk.android.feature.writing.toName
import com.zoonk.android.feature.writing.writingTaskTitle
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.navigation.TaskNotFound
import com.zoonk.android.ui.components.AlertDialog
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
import com.zoonk.android.ui.components.fitTo
import com.zoonk.android.ui.components.focusMoveTarget
import com.zoonk.android.ui.components.limitWords
import com.zoonk.android.ui.components.rememberExpandedBottomSheetState
import com.zoonk.android.ui.components.rememberMoveFocus
import com.zoonk.android.ui.components.taskColumn
import com.zoonk.android.ui.components.writingAreaColors
import com.zoonk.android.ui.components.writingAreaFocusRing
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.scaffold.TaskAside
import com.zoonk.android.ui.scaffold.TaskScaffold
import com.zoonk.android.ui.scaffold.pageTitle
import com.zoonk.android.ui.scaffold.taskAsideBeside
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.android.ui.theme.zoonkType
import com.zoonk.api.models.Essay
import com.zoonk.api.models.StudyBlock
import com.zoonk.api.models.WritingPromptOutput
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.time.LocalDate
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
                    WritingDayStart(blockId, signedIn, app, navigator)
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
private fun WritingDayStart(
    blockId: UUID,
    signedIn: AuthenticatedSession,
    app: AppContainer,
    navigator: AppNavigator,
) {
    val resource = app.today.today
    val day by resource.collectShown()
    val scope = androidx.compose.runtime.rememberCoroutineScope()
    val close = navigator::closeTask
    when (val read = day) {
        is LoadState.Loaded -> {
            val step = (read.value as? TodayRead.Day)?.day?.steps?.firstOrNull { it.id == blockId && it.kind == StudyBlock.Kind.PRODUCE }
            when {
                step == null -> {
                    WritingRemoved(stringResource(R.string.essay_written_answer), onClose = close)
                }

                step.writing == WritingRow.Tomorrow -> {
                    WritingRefused(
                        task = writingTaskTitle(step.drill, step.writingTask, step.title) to step.estimatedMinutes.toInt(),
                        busy = false,
                        onContinue = close,
                        onClose = close,
                        returnsOn = step.writingReturnsOn,
                    )
                }

                else -> {
                    val task = RefusedTask(step.title.orEmpty(), step.estimatedMinutes.toInt(), drill = step.drill, name = step.writingTask)
                    WritingStart(blockId, null, step.drill, task, signedIn, app, navigator)
                }
            }
        }

        is LoadState.Failed -> {
            RunLoadFailed(close, onRetry = { scope.launch { resource.refresh() } })
        }

        else -> {
            RunLoading(close)
        }
    }
}

@Composable
private fun WritingStart(
    blockId: UUID,
    before: WritingBefore?,
    drill: Boolean,
    task: RefusedTask?,
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
        WritingStartState.Available -> {
            WritingAvailable(header, drill, task, asking, viewModel::requestStart, navigator::closeTask)
        }

        is WritingStartState.LimitReached -> {
            WritingRefused(
                task =
                    (shown.task ?: task)?.let {
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
            WritingRemoved(header, onClose = navigator::closeTask)
        }

        is WritingStartState.Writing -> {
            val exercise = shown.drill
            if (run.status == GenerationRun.Status.Failed) {
                WritingFailed(
                    stringResource(if (exercise) R.string.essay_writing_practice else R.string.essay_written_answer),
                    exercise,
                    busy = false,
                    onRetry = viewModel::retryRun,
                    onClose = navigator::closeTask,
                )
                return
            }
            TrackShown(AnalyticsEvent.WritingPromptWaitViewed(shown.generationId, AnalyticsEvent.WritingSurface.Practice))
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
                        titleModifier = Modifier.pageTitle(),
                    )
                }
            }
        }

        WritingStartState.Failed -> {
            WritingFailed(header, drill, busy = asking, onRetry = viewModel::requestStart, onClose = navigator::closeTask)
        }

        WritingStartState.SignUpRequired -> {
            WritingSignUp(header, onCreateAccount = { navigator.open(AppRoute.Login) }, onClose = navigator::closeTask)
        }
    }
}

@Composable
internal fun WritingAvailable(
    header: String,
    drill: Boolean,
    task: RefusedTask?,
    busy: Boolean,
    onWrite: () -> Unit,
    onClose: () -> Unit,
) {
    RunPage(
        onClose = onClose,
        title = { BarTitle(header) },
        bottomBar = {
            TaskActionBar {
                TaskActions { width ->
                    Button(onClick = onWrite, modifier = width, busy = busy) { Text(stringResource(R.string.essay_write)) }
                }
            }
        },
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(
                writingTaskTitle(drill, task?.name, task?.description?.ifBlank { null }),
                Modifier.pageTitle(),
                style = MaterialTheme.typography.headlineSmall,
            )
            task?.minutes?.takeIf { it > 0 }?.let {
                Text(
                    stringResource(R.string.essay_start_about_time, formatMinutes(it, currentLocale())),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyLarge,
                )
            }
        }
    }
}

/** A guest's question would cost a model call: an account funds it, so its way on is creating one. */
@Composable
internal fun WritingSignUp(
    header: String,
    onCreateAccount: () -> Unit,
    onClose: () -> Unit,
) {
    // The same page a failed question gets, as the web's: the title says what's needed, the bar's one action gives it.
    RunPage(
        onClose = onClose,
        title = { BarTitle(header) },
        bottomBar = {
            TaskActionBar {
                TaskActions { width ->
                    Button(onClick = onCreateAccount, modifier = width) { Text(stringResource(R.string.limit_create_account)) }
                }
            }
        },
    ) {
        Text(stringResource(R.string.limit_sign_up_required), Modifier.pageTitle(), style = MaterialTheme.typography.headlineSmall)
    }
}

/** The question couldn't be written, whether its start or its run failed: nothing was lost, and Try again asks again. */
@Composable
internal fun WritingFailed(
    header: String,
    drill: Boolean,
    busy: Boolean,
    onRetry: () -> Unit,
    onClose: () -> Unit,
) {
    RunPage(
        onClose = onClose,
        title = { BarTitle(header) },
        bottomBar = {
            TaskActionBar {
                TaskActions { width ->
                    Button(onClick = onRetry, modifier = width, busy = busy) { Text(stringResource(R.string.essay_try_again)) }
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

/** A notice read again dropped this task: nothing was admitted or graded, and Today goes on without it. */
@Composable
internal fun WritingRemoved(
    header: String,
    onClose: () -> Unit,
) {
    RunPage(
        onClose = onClose,
        title = { BarTitle(header) },
        bottomBar = {
            TaskActionBar {
                TaskActions { width ->
                    Button(onClick = onClose, modifier = width) { Text(stringResource(R.string.essay_continue)) }
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
            EssayViewModel(
                essay.blockId,
                essay.sessionId,
                app.essays,
                app.essays.keptText(signedIn, essay.blockId),
                app.studyOpener,
                app.scope,
                app.networkAvailable,
                app.timeSource,
            )
        }
    val ui by viewModel.ui.collectAsStateWithLifecycle()
    val move by viewModel.move.collectAsStateWithLifecycle()

    LaunchedEffect(essay) { viewModel.arrive(essay) }
    LaunchedEffect(move.leaving) { move.leaving?.let(navigator::leaveTaskFor) }
    LifecycleEventEffect(Lifecycle.Event.ON_STOP) { viewModel.onStop() }

    // Asked wherever the answer shows, so a draft from another device never waits behind the question.
    ui.conflict?.let { DraftConflictDialog(onKeepThis = viewModel::keepThis, onUseOther = viewModel::useOther) }

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
                        task = essay.writingTask?.toName(),
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

    LaunchedEffect(Unit) { if (ui.switched) moveFocus(field) }

    // Leaving saves what's typed; one that can't reach the server says it stays on this device first.
    var leaving by rememberSaveable { mutableStateOf(false) }
    val close = { if (ui.saveFailed) leaving = true else navigator.closeTask() }
    BackHandler(enabled = ui.saveFailed) { leaving = true }
    if (leaving) {
        AlertDialog(
            onDismissRequest = { leaving = false },
            title = { Text(stringResource(R.string.essay_unsaved_title)) },
            text = { Text(stringResource(R.string.essay_unsaved_body)) },
            confirmButton = {
                TextButton(onClick = {
                    leaving = false
                    navigator.closeTask()
                }) { Text(stringResource(R.string.task_leave)) }
            },
            dismissButton = { TextButton(onClick = { leaving = false }) { Text(stringResource(R.string.essay_keep_writing)) } },
        )
    }

    TaskScaffold(
        onClose = close,
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
                StatusLine(ui.send, ui.saveFailed)
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
                    state = ui.field,
                    inputTransformation = InputTransformation.fitTo(MAX_WRITING_CHARACTERS),
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
                    focusRing = writingAreaFocusRing(),
                )
                WritingLineCount(ui.text, essay.writing)
            }
        }
    }

    if (questionOpen) {
        ModalBottomSheet(
            onDismissRequest = { questionOpen = false },
            sheetState = rememberExpandedBottomSheetState(),
        ) {
            SheetColumn {
                Text(essay.writing.title, Modifier.semantics { heading() }, style = MaterialTheme.typography.titleLarge)
                WritingQuestionBody(essay.context, essay.question)
                WritingCriteriaSection(essay.writing)
            }
        }
    }
}

/**
 * Another device saved this answer after it was typed here: nothing is overwritten on either side
 * until the learner picks, so the dialog only closes with a choice.
 */
@Composable
internal fun DraftConflictDialog(
    onKeepThis: () -> Unit,
    onUseOther: () -> Unit,
) {
    val keepFocus = remember { FocusRequester() }

    AlertDialog(
        onDismissRequest = {},
        title = { Text(stringResource(R.string.essay_conflict_title)) },
        text = { Text(stringResource(R.string.essay_conflict_body)) },
        confirmButton = {
            TextButton(onClick = onKeepThis, modifier = Modifier.focusMoveTarget(keepFocus)) {
                Text(stringResource(R.string.essay_conflict_keep))
            }
            LaunchedEffect(keepFocus) { keepFocus.requestFocus() }
        },
        dismissButton = {
            TextButton(
                onClick = onUseOther,
                colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error),
            ) {
                Text(stringResource(R.string.essay_conflict_use_other))
            }
        },
    )
}

/** "about 23 of 30 lines": the count stays in view under the field, and what's past the limit says so. */
@Composable
internal fun WritingLineCount(
    text: String,
    writing: WritingPromptOutput,
    modifier: Modifier = Modifier,
) {
    val limit = writing.lines?.toInt()
    val style = MaterialTheme.zoonkType.data
    if (limit == null) {
        val words =
            com.zoonk.android.feature.player.language
                .countWords(text)
        Text(
            pluralStringResource(R.plurals.essay_words, words, words),
            modifier,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = style,
        )
        return
    }
    val lines =
        remember(text, writing.charactersPerLine, writing.maxCharactersPerLine, limit) {
            countWritingLines(text, writing.charactersPerLine.toInt(), writing.maxCharactersPerLine.toInt(), limit)
        }
    val used = lines.estimated
    val over = used > limit
    Text(
        if (text.isBlank()) {
            pluralStringResource(R.plurals.essay_lines_empty, limit, limit)
        } else if (lines.ignoredFrom != null) {
            stringResource(R.string.essay_lines_end_unread, used, limit)
        } else if (over) {
            stringResource(R.string.essay_lines_may_not_fit, used, limit)
        } else {
            pluralStringResource(R.plurals.essay_lines_used, limit, used, limit)
        },
        modifier.semantics { liveRegion = LiveRegionMode.Polite },
        color = if (over) MaterialTheme.zoonk.warningText else MaterialTheme.colorScheme.onSurfaceVariant,
        style = style,
    )
}

@Composable
private fun StatusLine(
    send: WritingSend,
    saveFailed: Boolean,
) {
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
            saveFailed -> stringResource(R.string.essay_not_saved)
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
    // Changes the grade isn't for still have a rewrite to go to.
    val done = remember(grade, latest.text) { grade.nextStep(latest.text) == NextStep.Done } && ui.unsent == null

    LaunchedEffect(latest) { if (ui.switched) moveFocus(heading) }

    TaskScaffold(
        onClose = navigator::closeTask,
        title = { BarTitle(writingLabel(essay.writing)) },
        bottomBar = {
            TaskActionBar {
                if (ui.unsent != null && !ui.closed) {
                    Text(
                        stringResource(R.string.essay_graded_earlier_version),
                        Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
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
    returnsOn: LocalDate? = null,
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
                if (returnsOn?.isAfter(LocalDate.now().plusDays(1)) == true) {
                    gradingReturnsLine(returnsOn)
                } else {
                    stringResource(R.string.essay_more_tomorrow)
                },
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
                                        style = MaterialTheme.zoonkType.data,
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
            RunPage(onClose = navigator::closeTask, title = { BarTitle(answer.writing.title) }) {
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
