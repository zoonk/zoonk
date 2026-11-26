package com.zoonk.android.feature.session

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
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
import com.zoonk.android.data.GenerationKind
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.LiveGenerationSource
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.TrackVisibleWait
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.ceremonies.CertificateCeremony
import com.zoonk.android.feature.ceremonies.SessionCeremony
import com.zoonk.android.feature.certificates.naming
import com.zoonk.android.feature.player.LessonNotWrittenNotice
import com.zoonk.android.feature.player.LessonWriting
import com.zoonk.android.feature.player.LessonWritingProgress
import com.zoonk.android.feature.player.lessonWaitWords
import com.zoonk.android.feature.today.TodayRead
import com.zoonk.android.feature.today.heldMinutes
import com.zoonk.android.feature.today.stepsDone
import com.zoonk.android.feature.warmup.WaitContent
import com.zoonk.android.feature.warmup.WaitQuizAction
import com.zoonk.android.feature.warmup.WarmUpStore
import com.zoonk.android.feature.warmup.rememberReadyHold
import com.zoonk.android.feature.warmup.rememberWaitQuiz
import com.zoonk.android.feature.warmup.watchTouches
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.TaskNotFound
import com.zoonk.android.ui.ActOn
import com.zoonk.android.ui.VisitOf
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
import com.zoonk.android.ui.components.focusMoveTarget
import com.zoonk.android.ui.components.rememberMoveFocus
import com.zoonk.android.ui.components.taskColumn
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
import com.zoonk.api.models.StudyDay
import com.zoonk.api.models.StudyReminderOffer
import com.zoonk.api.models.StudySession
import com.zoonk.api.models.TodayGoal
import java.util.UUID

/**
 * Main's session page: the next step to start, or the day's summary when study ends.
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
                app.cache,
                readiness = { session, lessonId -> app.lessonPlayer.api.readiness(session, lessonId.toString()) },
                generations = { LiveGenerationSource(app.api, app.sessions.current) },
            )
        }

    VisitOf(viewModel.visit)
    ActOn(viewModel.route) {
        navigator.closeTask()
        navigator.open(it)
    }

    when {
        sessionId != null -> {
            SavedDay(app, navigator, viewModel, route, sessionId, todayDay)
        }

        shown != null -> {
            UnopenedDay(viewModel, shown, { app.today.today.refresh() }, navigator, app.warmUps)
        }

        else -> {
            // Only a link can name a day Today doesn't hold, and Today says where that goal is.
            LaunchedEffect(today) { if (today is LoadState.Loaded || today is LoadState.Failed) navigator.closeTask() }
            SessionLoading(navigator::closeTask)
        }
    }
}

/** A day Today holds that isn't opened yet: Today's read is its only read, so it's what readiness refreshes. */
@Composable
internal fun UnopenedDay(
    viewModel: SessionViewModel,
    read: TodayRead.Day,
    refreshToday: suspend () -> Unit,
    navigator: AppNavigator,
    warmUps: WarmUpStore,
) {
    val day = read.day
    val step = day.steps.firstOrNull { it.position == day.nextPosition }
    if (step == null) {
        LaunchedEffect(Unit) { navigator.closeTask() }
        return
    }
    NextStop(
        viewModel = viewModel,
        day = day,
        step = step,
        goalId = day.goalId ?: read.today.goal.id,
        notWritten = null,
        alternative = day.steps.firstOrNull { it.position == day.alternativePosition },
        refresh = refreshToday,
        onStop = null,
        navigator = navigator,
        warmUps = warmUps,
    )
}

@Composable
private fun SavedDay(
    app: AppContainer,
    navigator: AppNavigator,
    viewModel: SessionViewModel,
    route: AppRoute.Session,
    sessionId: UUID,
    todayDay: TodayRead.Day?,
) {
    val resource = app.studySessions.day[sessionId]
    val read by resource.collectShown()
    val fresh by resource.freshState.collectAsStateWithLifecycle()
    val loading = read == LoadState.Idle || read == LoadState.Loading
    // A tap on Today names a step of the saved day Today holds: it shows at once, and the session's read replaces it.
    val held =
        todayDay
            ?.today
            ?.session
            ?.saved()
            ?.takeIf { loading && it.id == sessionId && it.opened(route.blockId) != null }
    val session = read.value?.takeIf { route.stopped || it.nextBlockId != null || fresh is LoadState.Loaded } ?: held

    when {
        session != null -> {
            val opened = session.opened(route.blockId)
            val step = opened ?: session.blocks.firstOrNull { it.id == session.nextBlockId }
            val summaryOfDoneDay = route.summaryRequested && opened == null && session.state == StudySession.State.DONE
            if (route.stopped || summaryOfDoneDay || step == null) {
                SessionSummaryContent(
                    app,
                    navigator,
                    viewModel,
                    session,
                    stopped = route.stopped,
                    requested = route.summaryRequested && !route.stopped,
                    goalKind =
                        todayDay
                            ?.today
                            ?.goal
                            ?.takeIf { it.id == session.goalId }
                            ?.kind,
                )
            } else {
                NextStop(
                    viewModel = viewModel,
                    day = session.toDayView(),
                    step = step.toDayStep(),
                    goalId = session.goalId,
                    notWritten = opened?.let { app.studyOpener.notWritten(it.id) },
                    alternative = session.blocks.firstOrNull { it.position == session.alternativePosition }?.toDayStep(),
                    refresh = { app.studySessions.day[sessionId].refresh() },
                    onStop = if (session.sessionBar.completed > 0) ({ viewModel.stop(sessionId) }) else null,
                    navigator = navigator,
                    warmUps = app.warmUps,
                )
            }
        }

        read is LoadState.Failed || fresh is LoadState.Failed -> {
            TaskScaffold(onClose = navigator::closeTask) { padding ->
                LoadFailedMessage(onRetry = { app.studySessions.day[sessionId].invalidate() }, modifier = Modifier.padding(padding))
            }
        }

        read == LoadState.Empty -> {
            TaskNotFound(navigator)
        }

        else -> {
            SessionLoading(navigator::closeTask)
        }
    }
}

private fun StudyDay.saved(): StudySession? =
    when (this) {
        is StudyDay.ActiveWrapper -> value
        is StudyDay.CompletedWrapper -> value
        is StudyDay.PlannedWrapper -> value
        is StudyDay.UnstartedWrapper -> null
    }

private fun StudySession.opened(blockId: String?): StudyBlock? = blocks.firstOrNull { it.id.toString() == blockId && it.status in OPEN }

@Composable
private fun SessionSummaryContent(
    app: AppContainer,
    navigator: AppNavigator,
    viewModel: SessionViewModel,
    session: StudySession,
    stopped: Boolean,
    requested: Boolean,
    goalKind: TodayGoal.Kind?,
) {
    VisitOf(viewModel.summaryOpening)
    ActOn(viewModel.summaryExit) { reason ->
        navigator.open(AppRoute.Today)
        if (reason == SummaryExit.DayChanged) app.today.today.invalidate()
    }
    val visitId = rememberSaveable(session.id) { UUID.randomUUID() }
    val resource = app.studySessions.summary[session.id]
    val read by resource.collectShown()
    val fresh by resource.freshState.collectAsStateWithLifecycle()
    val learner by app.learnerSummary.summary.collectShown()
    val summary = read.value?.takeIf { fresh is LoadState.Loaded }

    if (summary == null) {
        if (read is LoadState.Failed || fresh is LoadState.Failed) {
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

    val visit = viewModel.summaryVisit
    LaunchedEffect(visitId) {
        if (viewModel.summaryVisit == null) viewModel.recordSummaryVisit(session.id, visitId, requested)
    }
    if (visit == SummaryVisit.Failed) {
        TaskScaffold(onClose = navigator::closeTask) { padding ->
            LoadFailedMessage(
                onRetry = { viewModel.recordSummaryVisit(session.id, visitId, requested) },
                modifier = Modifier.padding(padding),
            )
        }
        return
    }
    if (visit == null) {
        SessionLoading(navigator::closeTask)
        return
    }

    val learnerBuddy = learner.value?.buddy
    val look = learnerBuddy?.look() ?: BuddyLook()
    val day = session.toDayView()
    val goalId = session.goalId
    // Showing the offer claims it, so a re-read summary comes back without one; it stays for this visit.
    val offered = rememberSaveable(summary.sessionId) { summary.reminderOffer?.let { listOf(it.time, it.timeZone) }.orEmpty() }
    val reminderOffer = offered.takeIf { it.size == 2 }?.let { (time, zone) -> StudyReminderOffer(time = time, timeZone = zone) }

    CelebrationScope(play = visit == SummaryVisit.First) {
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
            reminderOffer = reminderOffer?.let { offer -> { ReminderOfferCard(app, offer) } },
        )
    }
}

/**
 * The day's next step, or the one a tap opened when its lesson isn't written yet. Its first frame
 * shows the lesson as the day's read has it, so it never offers Start for a lesson being written;
 * its readiness then says it live. While it's written, or once its writing failed, the wait asks
 * that readiness until the day has the lesson, then says it's ready and focuses Start, never opening
 * it on its own: the learner may be reading, or doing the other step it offers. [notWritten] says,
 * in place of Start, why the API wouldn't write the lesson the tap asked for; [alternative] is
 * core's pick of work to do meanwhile or instead; [refresh] reads the day again; [onStop] is set
 * once the session has work done. A goal's first lesson deals
 * its guesses while it's written, and a learner who guessed finishes the card once Start shows.
 */
@Composable
internal fun NextStop(
    viewModel: SessionViewModel,
    day: DayView,
    step: DayStep,
    goalId: UUID?,
    notWritten: LessonWriting?,
    alternative: DayStep?,
    refresh: suspend () -> Unit,
    onStop: (() -> Unit)?,
    navigator: AppNavigator,
    warmUps: WarmUpStore,
) {
    ResultScreen {
        val refused = notWritten?.takeIf { step.isUnwrittenLesson() }
        val watched =
            step.lessonId?.takeIf {
                refused == null && step.kind == StudyBlock.Kind.LEARN && step.screen != StudyBlock.Screen.LESSON
            }
        val known = viewModel.lesson?.takeIf { it.id == watched }
        val status = known?.status?.value ?: step.lesson?.status?.value
        val setAside = known?.setAside ?: step.lesson?.setAside
        val refusal = refused ?: LessonWriting.SetAside.takeIf { watched != null && setAside == true }
        val lesson =
            when {
                watched == null || refusal != null -> NextStopLesson.Ready
                status == LessonReadiness.Status.GENERATING.value -> NextStopLesson.Writing
                status == LessonReadiness.Status.FAILED.value -> NextStopLesson.Failed
                status == null -> NextStopLesson.Unknown
                else -> NextStopLesson.Ready
            }
        val waiting = lesson == NextStopLesson.Writing || lesson == NextStopLesson.Failed
        val waitKind = known?.kind ?: GenerationKind.Lesson
        val run by viewModel.run.collectAsStateWithLifecycle()
        val failed = lesson == NextStopLesson.Failed
        val busy = viewModel.busy != null
        val ready = lesson == NextStopLesson.Ready && refusal == null
        val hold = rememberReadyHold(ready)
        val warmUpId = viewModel.lesson?.takeIf { it.id == step.lessonId && refusal == null && !hold.over }?.warmUpId
        val guessing = if (warmUpId != null) Modifier.watchTouches(hold) else Modifier
        val quiz = rememberWaitQuiz(warmUpId, warmUps)
        if (waiting || hold.holding) TrackVisibleWait("nextStop", "lesson", goalId?.toString())
        val startsFor = goalId?.takeIf { ready }
        val written = startsFor != null && viewModel.writtenWhileWaiting == step.position
        val startFocus = remember { FocusRequester() }
        val moveFocus = rememberMoveFocus()
        var screenFocused by remember { mutableStateOf(false) }
        val reviewStarts = rememberReviewStarts()
        val opening = rememberWaitState(viewModel.busy == SessionAction.Start)
        val instead = alternative?.takeIf { !ready && lesson != NextStopLesson.Unknown && goalId != null }

        LaunchedEffect(step.position, waiting, step.screen) {
            when {
                waiting -> viewModel.waitForLesson(step.position)
                step.screen == StudyBlock.Screen.LESSON -> viewModel.lessonWritten(step.position)
            }
        }
        val lifecycle = LocalLifecycleOwner.current.lifecycle
        LaunchedEffect(watched) {
            val lessonId = watched ?: return@LaunchedEffect
            lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) { viewModel.followLesson(lessonId, step.lesson, refresh) }
        }
        val runWrote = run.status == GenerationRun.Status.Ready && lesson == NextStopLesson.Writing
        LaunchedEffect(runWrote) { if (runWrote) refresh() }
        val retry = { goalId?.let { viewModel.start(day, step, it) } }

        TaskScaffold(
            onClose = { if (quiz.showingProgress && quiz.hasQuiz) quiz.back() else navigator.closeTask() },
            modifier = Modifier.onFocusChanged { screenFocused = it.hasFocus }.then(guessing),
            title = { Text(stringResource(R.string.session_summary_eyebrow), maxLines = 1, style = MaterialTheme.typography.titleSmall) },
            bottomBar =
                if ((waiting && !failed && quiz.hasQuiz && (quiz.showingProgress || quiz.hasNext)) || startsFor != null ||
                    instead != null ||
                    onStop != null ||
                    viewModel.failed != null
                ) {
                    {
                        TaskActionBar {
                            when (viewModel.failed) {
                                SessionAction.Start -> ErrorLine(stringResource(R.string.today_open_failed))
                                SessionAction.Stop -> ErrorLine(stringResource(R.string.session_next_stop_failed))
                                else -> Unit
                            }
                            OpeningWaitLine(opening)
                            TaskActions { main ->
                                onStop?.let {
                                    OutlinedButton(
                                        busy = viewModel.busy == SessionAction.Stop,
                                        onClick = it,
                                        enabled = !busy,
                                        leadingIcon = { ButtonIcon(R.drawable.ic_stop_circle) },
                                    ) { Text(stringResource(R.string.session_next_stop)) }
                                }
                                startsFor?.let { goal ->
                                    LaunchedEffect(written) { if (written && !screenFocused) moveFocus(startFocus) }
                                    Button(
                                        busy = viewModel.busy == SessionAction.Start,
                                        onClick = {
                                            reviewStarts.note(step, goal)
                                            viewModel.start(day, step, goal)
                                        },
                                        modifier = main.focusMoveTarget(startFocus),
                                        enabled = !busy,
                                    ) {
                                        Text(
                                            stringResource(
                                                if (step.status == StudyBlock.Status.ACTIVE) {
                                                    R.string.session_next_continue
                                                } else {
                                                    R.string.session_next_start
                                                },
                                            ),
                                        )
                                    }
                                }
                                // A failed run waits for nothing: Try again and the way back are its only ways on.
                                if (waiting && !failed) WaitQuizAction(quiz, hold, modifier = Modifier.taskOption())
                                instead?.let { other ->
                                    Button(
                                        busy = viewModel.busy == SessionAction.Start,
                                        onClick = { goalId?.let { viewModel.start(day, other, it) } },
                                        modifier = main,
                                        enabled = !busy,
                                    ) {
                                        Text(
                                            alternativeLabel(other),
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
                        SessionSegments(day, step, Modifier.taskColumn())
                    }
                    Column(
                        modifier =
                            Modifier
                                .fillMaxSize()
                                .verticalScroll(rememberScrollState())
                                .padding(vertical = 24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Column(Modifier.taskColumn(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Eyebrow(stringResource(R.string.session_next_eyebrow))
                            Text(blockTitle(step), Modifier.semantics { heading() }, style = MaterialTheme.typography.headlineMedium)
                            blockDetail(step)?.let {
                                Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
                            }
                            StepFacts(step)
                            ReviewIntro(step, reviewStarts.openAtFirst(goalId), Modifier.padding(top = 16.dp))
                            if (written && !hold.holding) {
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
                            if (failed) {
                                GenerationFailureNotice(
                                    GenerationFailure.Generation,
                                    onRetry = { retry() },
                                    modifier = Modifier.padding(top = 16.dp),
                                )
                            } else if (waiting || hold.holding) {
                                // Only the lesson's readiness says whether its writing stopped.
                                val shown =
                                    when {
                                        ready -> {
                                            GenerationRun(status = GenerationRun.Status.Ready)
                                        }

                                        run.status == GenerationRun.Status.Failed -> {
                                            run.copy(
                                                status = GenerationRun.Status.Following,
                                                failure = null,
                                            )
                                        }

                                        else -> {
                                            run
                                        }
                                    }
                                quiz.open()
                                val share =
                                    com.zoonk.android.ui.components.rememberGenerationProgress(
                                        waitKind,
                                        shown,
                                    )
                                val words = lessonWaitWords(waitKind)
                                WaitContent(
                                    quiz,
                                    hold,
                                    AnalyticsEvent.WarmUpSurface.LessonWait,
                                    waitKind,
                                    shown,
                                    stringResource(if (ready) words.ready else words.gettingReady),
                                    goalId = goalId?.toString(),
                                    progressShare = share,
                                    onRetry = { retry() },
                                ) {
                                    LessonWritingProgress(
                                        waitKind,
                                        shown,
                                        { retry() },
                                        stringResource(R.string.session_next_writing_note).takeUnless { ready },
                                        progressShare = share,
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

/**
 * Main's session header bar. [counted] says how many are done above it, for a pane of its own; over
 * the next step only TalkBack reads the count, as main's header does.
 */
@Composable
private fun SessionSegments(
    day: DayView,
    step: DayStep,
    modifier: Modifier,
    counted: Boolean = false,
) {
    val parts = dayParts(day.steps, isNext = { it.position == step.position })
    val held = day.heldMinutes > 0
    if (parts.isEmpty() && !held) return
    val progress = stepsDone(day.sessionBar)
    val draws = drawsDayProgress(parts.size, held)

    if (counted) {
        Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(progress, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.zoonkType.data)
            if (draws) DayProgress(parts, held)
        }
    } else if (draws) {
        DayProgress(parts, held, modifier, contentDescription = progress)
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

/** Main's `useAlternativeLabel`: a verb for what [step] starts; only a challenge needs its name. */
@Composable
private fun alternativeLabel(step: DayStep): String =
    when {
        step.checkpointFacts != null -> stringResource(R.string.session_next_start_title, blockTitle(step))
        step.kind == StudyBlock.Kind.REVIEW -> stringResource(R.string.session_next_review_now)
        else -> stringResource(R.string.session_next_practice_now)
    }

private val OPEN = setOf(StudyBlock.Status.ACTIVE, StudyBlock.Status.PENDING)
