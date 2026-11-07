package com.zoonk.android.feature.session

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
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
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.isTraversalGroup
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.repeatOnLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.AnalyticsEvent
import com.zoonk.android.data.GenerationFailure
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.LiveGenerationSource
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.ceremonies.CertificateCeremony
import com.zoonk.android.feature.ceremonies.SessionCeremony
import com.zoonk.android.feature.certificates.naming
import com.zoonk.android.feature.player.LessonNotWrittenNotice
import com.zoonk.android.feature.player.LessonWriting
import com.zoonk.android.feature.player.LessonWritingProgress
import com.zoonk.android.feature.player.LiveLessonWritingApi
import com.zoonk.android.feature.today.TodayRead
import com.zoonk.android.feature.today.stepsDone
import com.zoonk.android.feature.warmup.WarmUpCard
import com.zoonk.android.feature.warmup.WarmUpStore
import com.zoonk.android.feature.warmup.rememberReadyHold
import com.zoonk.android.feature.warmup.watchTouches
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.TaskNotFound
import com.zoonk.android.ui.characters.BuddyLook
import com.zoonk.android.ui.characters.buddyName
import com.zoonk.android.ui.characters.look
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.ButtonIcon
import com.zoonk.android.ui.components.CelebrationScope
import com.zoonk.android.ui.components.Eyebrow
import com.zoonk.android.ui.components.GenerationFailureNotice
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.PageLoading
import com.zoonk.android.ui.components.TaskActionBar
import com.zoonk.android.ui.components.TaskActions
import com.zoonk.android.ui.components.TaskSegment
import com.zoonk.android.ui.components.TaskSegments
import com.zoonk.android.ui.components.taskOption
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.factsLine
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.scaffold.PageSpan
import com.zoonk.android.ui.scaffold.ResultScreen
import com.zoonk.android.ui.scaffold.TaskScaffold
import com.zoonk.android.ui.scaffold.onPageSpan
import com.zoonk.android.ui.scaffold.spreadFold
import com.zoonk.android.ui.theme.zoonkType
import com.zoonk.api.models.LessonReadiness
import com.zoonk.api.models.StudyBlock
import com.zoonk.api.models.StudySession
import com.zoonk.api.models.TodayGoal
import kotlinx.coroutines.delay
import java.util.UUID

/**
 * Main's session page: a day's summary once nothing is left or the learner stopped, else its next
 * step to start, a day not opened yet included. Opening it only reads; every write is a tap.
 */
@Composable
fun SessionScreen(
    route: AppRoute.Session,
    app: AppContainer,
    navigator: AppNavigator,
) {
    val today by app.today.today.collectShown()
    val todayDay = (today as? LoadState.Loaded)?.value as? TodayRead.Day
    val shown =
        todayDay?.takeIf { read ->
            (route.goalId == null || route.goalId == (read.day.goalId ?: read.today.goal.id).toString()) &&
                (route.blockId == null || read.day.steps.any { it.id?.toString() == route.blockId })
        }
    val sessionId = route.sessionId?.let(UUID::fromString) ?: shown?.day?.sessionId
    val viewModel =
        viewModel(key = "session:${sessionId ?: route.goalId}") {
            SessionViewModel(
                app.studyOpener,
                app.studySessions,
                LiveLessonWritingApi(app.api),
                app.cache,
                readiness = { session, lessonId -> app.lessonPlayer.api.readiness(session, lessonId.toString()) },
                generations = { LiveGenerationSource(app.api, app.sessions.current) },
            )
        }

    LaunchedEffect(viewModel) {
        viewModel.routes.collect {
            navigator.closeTask()
            navigator.open(it)
        }
    }

    when {
        sessionId != null -> {
            SavedDay(app, navigator, viewModel, route, sessionId, goal = todayDay?.today?.goal)
        }

        shown != null -> {
            val day = shown.day
            val step = day.steps.firstOrNull { it.position == day.nextPosition }
            if (step == null) {
                LaunchedEffect(Unit) { navigator.closeTask() }
            } else {
                NextStop(
                    viewModel,
                    day,
                    step,
                    day.goalId ?: shown.today.goal.id,
                    asked = false,
                    notWritten = null,
                    alternative = null,
                    refresh = null,
                    onStop = null,
                    navigator = navigator,
                    warmUps = app.warmUps,
                )
            }
        }

        else -> {
            // Only a link can name a day Today doesn't hold, and Today says where that goal is.
            LaunchedEffect(today) { if (today is LoadState.Loaded || today is LoadState.Failed) navigator.closeTask() }
            SessionLoading(navigator::closeTask)
        }
    }
}

@Composable
private fun SavedDay(
    app: AppContainer,
    navigator: AppNavigator,
    viewModel: SessionViewModel,
    route: AppRoute.Session,
    sessionId: UUID,
    goal: TodayGoal?,
) {
    val read by app.studySessions.day[sessionId].collectShown()

    when (val state = read) {
        is LoadState.Loaded -> {
            val session = state.value
            val opened = session.blocks.firstOrNull { it.id.toString() == route.blockId && it.status in OPEN }
            val step = opened ?: session.blocks.firstOrNull { it.id == session.nextBlockId }
            if (route.stopped || step == null) {
                SessionSummaryContent(
                    app,
                    navigator,
                    viewModel,
                    session,
                    stopped = route.stopped,
                    goalKind = goal?.takeIf { it.id == session.goalId }?.kind,
                )
            } else {
                NextStop(
                    viewModel = viewModel,
                    day = session.toDayView(),
                    step = step.toDayStep(),
                    goalId = session.goalId,
                    asked = opened != null,
                    notWritten = opened?.let { app.studyOpener.notWritten(it.id) },
                    alternative = session.alternativeTo(step),
                    refresh = { app.studySessions.day[sessionId].refresh() },
                    onStop = if (session.sessionBar.completed > 0) ({ viewModel.stop(sessionId) }) else null,
                    navigator = navigator,
                    warmUps = app.warmUps,
                )
            }
        }

        is LoadState.Failed -> {
            TaskScaffold(onClose = navigator::closeTask) { padding ->
                LoadFailedMessage(onRetry = { app.studySessions.day[sessionId].invalidate() }, modifier = Modifier.padding(padding))
            }
        }

        LoadState.Empty -> {
            TaskNotFound(navigator)
        }

        else -> {
            SessionLoading(navigator::closeTask)
        }
    }
}

@Composable
private fun SessionSummaryContent(
    app: AppContainer,
    navigator: AppNavigator,
    viewModel: SessionViewModel,
    session: StudySession,
    stopped: Boolean,
    goalKind: TodayGoal.Kind?,
) {
    val read by app.studySessions.summary[session.id].collectShown()
    val learner by app.learnerSummary.summary.collectShown()
    val summary = (read as? LoadState.Loaded)?.value

    if (summary == null) {
        if (read is LoadState.Failed) {
            TaskScaffold(onClose = navigator::closeTask) { padding ->
                LoadFailedMessage(onRetry = { app.studySessions.summary[session.id].invalidate() }, modifier = Modifier.padding(padding))
            }
        } else {
            SessionLoading(navigator::closeTask)
        }
        return
    }

    if (!stopped && !summary.finished) {
        LaunchedEffect(session.id) { viewModel.readUnfinished(session.id) }
        SessionLoading(navigator::closeTask)
        return
    }

    // A completion whose answer was lost brings its certificates back here, before the session's milestone.
    val certificates = summary.certificates.map { it.naming }
    var certificatesClosed by rememberSaveable(certificates.map { it.code }) { mutableStateOf(false) }
    if (certificates.isNotEmpty() && !certificatesClosed) {
        CertificateCeremony(app, certificates, { certificatesClosed = true }, { navigator.open(AppRoute.Subscription) }, app.timeSource)
        return
    }

    viewModel.ceremony(summary.ceremony)?.let { milestone ->
        LaunchedEffect(milestone) { viewModel.holdCeremony(milestone) }
        SessionCeremony(app, milestone, viewModel::closeCeremony)
        return
    }

    val learnerBuddy = learner.value?.buddy
    val look = learnerBuddy?.look() ?: BuddyLook()
    val firstVisit = remember(summary.sessionId, summary.brainPower) { app.studySessions.firstVisit(summary.sessionId, summary.brainPower) }
    val day = session.toDayView()
    val goalId = session.goalId

    CelebrationScope(play = firstVisit) {
        SessionSummary(
            summary = summary,
            facts =
                SummaryFacts(
                    stopped = stopped,
                    goalKind = goalKind,
                    bonus = session.fullMeal.bonus,
                    guest = learner.value?.identity?.isAnonymous == true,
                ),
            buddy = look,
            buddyName = buddyName(look.kind, learnerBuddy?.name),
            busy = viewModel.busy,
            failed = viewModel.failed,
            actions =
                SummaryActions(
                    keepGoing = { viewModel.keepGoing(session.id) },
                    extraTime = { goalId?.let { viewModel.extraTime(day, it) } },
                    seeMistakes = { navigator.open(AppRoute.Mistakes) },
                    signUp = { navigator.open(AppRoute.Login) },
                    finish = navigator::closeTask,
                ),
        )
    }
}

/**
 * The day's next step, or the one a tap opened when its lesson isn't made yet. That wait reads the
 * day again until the lesson is there, or only the lesson's readiness while a run writes it, then
 * says it's ready and focuses Start, never opening it on its own: the learner may be reading, or
 * doing what "While you wait" offered. [notWritten] says,
 * in place of Start, why the API wouldn't write the lesson the tap asked for; [alternative] is work
 * to do meanwhile or instead. [refresh] is null on a day not opened yet, which has no lesson to
 * wait for; [onStop] once the session has work done. A goal's first lesson deals its guesses while
 * it's written, and a learner who guessed finishes the card once Start shows.
 */
@Composable
internal fun NextStop(
    viewModel: SessionViewModel,
    day: DayView,
    step: DayStep,
    goalId: UUID?,
    asked: Boolean,
    notWritten: LessonWriting?,
    alternative: DayStep?,
    refresh: (suspend () -> Unit)?,
    onStop: (() -> Unit)?,
    navigator: AppNavigator,
    warmUps: WarmUpStore,
) {
    ResultScreen {
        val refused = notWritten?.takeIf { step.isUnwrittenLesson() }
        val unwritten = refresh != null && refused == null && step.kind == StudyBlock.Kind.LEARN && step.screen != StudyBlock.Screen.LESSON
        val watched = step.lessonId?.takeIf { unwritten }
        val picking = unwritten && watched == null && asked
        val known = viewModel.lesson?.takeIf { it.id == watched }
        val refusal = refused ?: LessonWriting.SetAside.takeIf { known?.setAside == true }
        val lesson =
            when {
                !unwritten || refusal != null -> null
                known?.status == LessonReadiness.Status.GENERATING -> NextStopLesson.Writing
                known?.status == LessonReadiness.Status.FAILED -> NextStopLesson.Failed
                asked -> NextStopLesson.NotStarted
                else -> null
            }
        val waiting = lesson != null
        val run by viewModel.run.collectAsStateWithLifecycle()
        val failure =
            when {
                lesson == NextStopLesson.Failed -> GenerationFailure.Generation
                lesson == null || viewModel.stuckWait != step.position to lesson -> null
                lesson == NextStopLesson.NotStarted -> GenerationFailure.NotStarted
                else -> GenerationFailure.Generation
            }
        val busy = viewModel.busy != null
        val ready = !waiting && refusal == null
        val hold = rememberReadyHold(ready)
        val warmUpId = viewModel.lesson?.takeIf { it.id == step.lessonId && refusal == null && !hold.over }?.warmUpId
        val guessing = if (warmUpId != null) Modifier.watchTouches(hold) else Modifier
        val startsFor = goalId?.takeIf { ready }
        val written = startsFor != null && viewModel.writtenWhileWaiting == step.position
        val startFocus = remember { FocusRequester() }
        var screenFocused by remember { mutableStateOf(false) }
        val instead = alternative?.takeIf { !ready && goalId != null }

        LaunchedEffect(step.position, waiting, step.screen) {
            when {
                waiting -> viewModel.waitForLesson(step.position)
                step.screen == StudyBlock.Screen.LESSON -> viewModel.lessonWritten(step.position)
            }
        }
        val lifecycle = LocalLifecycleOwner.current.lifecycle
        LaunchedEffect(picking) {
            val readDay = refresh?.takeIf { picking } ?: return@LaunchedEffect
            lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
                while (true) {
                    delay(LESSON_CHECK_MILLIS)
                    readDay()
                }
            }
        }
        LaunchedEffect(watched, asked) {
            val lessonId = watched ?: return@LaunchedEffect
            val readDay = refresh ?: return@LaunchedEffect
            lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) { viewModel.followLesson(lessonId, asked, readDay) }
        }
        val runWrote = run.status == GenerationRun.Status.Ready && lesson == NextStopLesson.Writing
        LaunchedEffect(runWrote) { if (runWrote) refresh?.invoke() }
        LaunchedEffect(step.position, lesson) {
            val after = STUCK_AFTER_MILLIS[lesson] ?: return@LaunchedEffect
            viewModel.awaitStuck(step.position, lesson ?: return@LaunchedEffect, after)
        }
        val retry = { goalId?.let { viewModel.start(day, step, it) } }

        TaskScaffold(
            onClose = navigator::closeTask,
            modifier = Modifier.onFocusChanged { screenFocused = it.hasFocus }.then(guessing),
            title = { Text(stringResource(R.string.session_summary_eyebrow), maxLines = 1, style = MaterialTheme.typography.titleSmall) },
            bottomBar =
                if (startsFor != null || instead != null || onStop != null || viewModel.failed != null) {
                    {
                        TaskActionBar {
                            when (viewModel.failed) {
                                SessionAction.Start -> ErrorLine(stringResource(R.string.today_open_failed))
                                SessionAction.Stop -> ErrorLine(stringResource(R.string.session_next_stop_failed))
                                else -> Unit
                            }
                            TaskActions { main ->
                                onStop?.let {
                                    // Main stacks the actions on a narrow layout once an alternative joins them.
                                    OutlinedButton(
                                        busy = viewModel.busy == SessionAction.Stop,
                                        onClick = it,
                                        modifier = if (instead != null) Modifier.taskOption() else Modifier,
                                        enabled = !busy,
                                        leadingIcon = { ButtonIcon(R.drawable.ic_stop_circle) },
                                    ) { Text(stringResource(R.string.session_next_stop)) }
                                }
                                startsFor?.let { goal ->
                                    LaunchedEffect(written) { if (written && !screenFocused) startFocus.requestFocus() }
                                    Button(
                                        busy = viewModel.busy == SessionAction.Start,
                                        onClick = { viewModel.start(day, step, goal) },
                                        modifier = main.focusRequester(startFocus),
                                        enabled = !busy,
                                        leadingIcon = { ButtonIcon(R.drawable.ic_play_arrow) },
                                    ) {
                                        Text(stringResource(R.string.session_next_start))
                                    }
                                }
                                instead?.let { other ->
                                    Button(
                                        busy = viewModel.busy == SessionAction.Start,
                                        onClick = { goalId?.let { viewModel.start(day, other, it) } },
                                        modifier = main,
                                        enabled = !busy,
                                        leadingIcon = { ButtonIcon(R.drawable.ic_play_arrow) },
                                    ) {
                                        Text(
                                            stringResource(
                                                if (refusal != null) R.string.session_next_instead else R.string.session_next_while_waiting,
                                                blockTitle(other),
                                            ),
                                        )
                                    }
                                }
                            }
                        }
                    }
                } else {
                    null
                },
        ) { padding ->
            var span by remember { mutableStateOf<PageSpan?>(null) }

            BoxWithConstraints(Modifier.padding(padding).fillMaxSize().onPageSpan { span = it }) {
                val fold = spreadFold(maxWidth, span)

                if (fold != null) {
                    SessionSegments(
                        day,
                        step,
                        Modifier.width(fold.start).padding(horizontal = 16.dp, vertical = 24.dp).semantics { isTraversalGroup = true },
                        counted = true,
                    )
                }
                // What's next keeps its place in the composition, only padded past a fold, so folding keeps a guess on its card.
                Column(
                    Modifier.fillMaxSize().padding(start = fold?.end ?: 0.dp).semantics { isTraversalGroup = true },
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    if (fold ==
                        null
                    ) {
                        SessionSegments(day, step, Modifier.widthIn(max = CONTENT_WIDTH).fillMaxWidth().padding(horizontal = 16.dp))
                    }
                    Column(
                        modifier =
                            Modifier
                                .fillMaxSize()
                                .verticalScroll(rememberScrollState())
                                .padding(horizontal = 16.dp, vertical = 24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Column(Modifier.widthIn(max = CONTENT_WIDTH).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Eyebrow(stringResource(R.string.session_next_eyebrow))
                            Text(blockTitle(step), Modifier.semantics { heading() }, style = MaterialTheme.typography.headlineSmall)
                            blockDetail(step)?.let {
                                Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
                            }
                            StepFacts(step)
                            if (written) {
                                Text(
                                    stringResource(R.string.session_next_lesson_ready),
                                    Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                                    style = MaterialTheme.typography.bodyMedium,
                                )
                            }
                            refusal?.let { reason ->
                                Surface(
                                    Modifier.padding(top = 16.dp).fillMaxWidth(),
                                    color = MaterialTheme.colorScheme.surfaceContainerHigh,
                                    shape = MaterialTheme.shapes.medium,
                                ) {
                                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                        LessonNotWrittenNotice(
                                            reason,
                                            onRetry = { goalId?.let { viewModel.start(day, step, it) } },
                                            onOpen = navigator::open,
                                        )
                                    }
                                }
                            }
                            if (waiting) {
                                Column(Modifier.padding(top = 16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                                    if (failure != null) {
                                        GenerationFailureNotice(failure, onRetry = { retry() })
                                    } else {
                                        LessonWritingProgress(
                                            run = if (lesson == NextStopLesson.Writing) run else GenerationRun(),
                                            onRetry = {
                                                if (run.failure ==
                                                    GenerationFailure.Connection
                                                ) {
                                                    viewModel.reconnect()
                                                } else {
                                                    retry()
                                                }
                                            },
                                            note = stringResource(R.string.session_next_writing_note),
                                        )
                                    }
                                }
                            }
                            WarmUpCard(warmUpId, warmUps, AnalyticsEvent.WarmUpSurface.LessonWait, hold, Modifier.padding(top = 16.dp))
                        }
                    }
                }
            }
        }
    }
}

/**
 * Main's session header segments: the day's work by its minutes, done in blue and the shown step as
 * the learner's place. [counted] says how many are done above them, for a page of their own.
 */
@Composable
private fun SessionSegments(
    day: DayView,
    step: DayStep,
    modifier: Modifier,
    counted: Boolean = false,
) {
    val steps = day.steps.filter { it.status != StudyBlock.Status.SKIPPED }
    if (steps.isEmpty()) return

    val segments =
        steps.map {
            when {
                it.status == StudyBlock.Status.COMPLETED -> TaskSegment.Done
                it.position == step.position -> TaskSegment.Current
                else -> TaskSegment.Ahead
            }
        }
    val weights = steps.map { it.estimatedMinutes.toFloat() }
    val progress = stepsDone(steps.count(DayStep::isFinished), steps.size)

    if (counted) {
        Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(progress, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.zoonkType.data)
            TaskSegments(segments, weights = weights)
        }
    } else {
        TaskSegments(segments, modifier, weights = weights, contentDescription = progress)
    }
}

@Composable
private fun StepFacts(step: DayStep) {
    val facts =
        listOfNotNull(
            formatMinutes(step.estimatedMinutes.toInt(), currentLocale()),
            stringResource(R.string.today_step_often_tested).takeIf { step.oftenTested },
        )
    Text(
        facts.factsLine(),
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        style = MaterialTheme.zoonkType.data,
    )
}

@Composable
private fun ErrorLine(text: String) {
    Text(text, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium)
}

@Composable
private fun SessionLoading(onClose: () -> Unit) {
    TaskScaffold(onClose = onClose) { padding -> PageLoading(Modifier.padding(padding)) }
}

/** Main's `findAlternativeStudyBlock`: other work to do while [step]'s lesson waits, never work that waits itself. */
private fun StudySession.alternativeTo(step: StudyBlock): DayStep? =
    blocks
        .firstOrNull {
            it.id != step.id && it.status == StudyBlock.Status.PENDING && it.kind != StudyBlock.Kind.LEARN && it.waitReason == null
        }?.toDayStep()

private val OPEN = setOf(StudyBlock.Status.ACTIVE, StudyBlock.Status.PENDING)

/** Main's `STUCK_AFTER_MS`: when a wait that hasn't moved says so, with Try again. */
private val STUCK_AFTER_MILLIS = mapOf(NextStopLesson.NotStarted to 20_000L, NextStopLesson.Writing to 600_000L)
private val CONTENT_WIDTH = 640.dp
