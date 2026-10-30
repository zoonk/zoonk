package com.zoonk.android.feature.session

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.adaptive.currentWindowAdaptiveInfoV2
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.window.core.layout.WindowSizeClass
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.ceremonies.SessionCeremony
import com.zoonk.android.feature.player.LessonNotWrittenNotice
import com.zoonk.android.feature.player.LessonWriting
import com.zoonk.android.feature.today.TodayRead
import com.zoonk.android.feature.today.stepsDone
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.characters.BuddyLook
import com.zoonk.android.ui.characters.buddyName
import com.zoonk.android.ui.characters.look
import com.zoonk.android.ui.components.CelebrationScope
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.components.MeterPart
import com.zoonk.android.ui.components.MeterParts
import com.zoonk.android.ui.components.NotFoundMessage
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.scaffold.TaskScaffold
import com.zoonk.android.ui.theme.withTabularFigures
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
    val viewModel = viewModel(key = "session:${sessionId ?: route.goalId}") { SessionViewModel(app.studyOpener, app.studySessions) }

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
                )
            }
        }

        is LoadState.Failed -> {
            TaskScaffold(onClose = navigator::closeTask) { padding ->
                LoadFailedMessage(onRetry = { app.studySessions.day[sessionId].invalidate() }, modifier = Modifier.padding(padding))
            }
        }

        LoadState.Empty -> {
            TaskScaffold(onClose = navigator::closeTask) { padding -> NotFoundMessage(navigator::closeTask, Modifier.padding(padding)) }
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
 * day again until the lesson is there, then opens it, since the tap asked for it; a link or a
 * screen restored later waits for Start instead. [notWritten] says, in place of Start, why the API
 * wouldn't write the lesson the tap asked for; [alternative] is work to do meanwhile or instead.
 * [refresh] is null on a day not opened yet, which has no lesson to wait for; [onStop] once the
 * session has work done.
 */
@Composable
private fun NextStop(
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
) {
    val rereading = refresh?.takeIf { step.waitsForItsLesson() }
    val waiting = rereading != null
    var waited by remember(step.id) { mutableStateOf(false) }
    val busy = viewModel.busy != null
    val refusal = notWritten?.takeIf { step.isUnwrittenLesson() }
    val ready = !waiting && refusal == null
    val startsFor = goalId?.takeIf { ready }
    val instead = alternative?.takeIf { !ready && goalId != null }
    // Main stacks the actions full width below its large breakpoint once an alternative joins them.
    val stacked =
        instead != null &&
            !currentWindowAdaptiveInfoV2().windowSizeClass.isWidthAtLeastBreakpoint(WindowSizeClass.WIDTH_DP_EXPANDED_LOWER_BOUND)
    val actionWidth = if (stacked) Modifier.fillMaxWidth() else Modifier

    LaunchedEffect(waiting) {
        val reread = rereading ?: return@LaunchedEffect
        waited = true
        while (true) {
            delay(LESSON_CHECK_MILLIS)
            reread()
        }
    }
    LaunchedEffect(waiting, waited) {
        if (!waiting && waited && asked && goalId != null) viewModel.start(day, step, goalId)
    }

    TaskScaffold(
        onClose = navigator::closeTask,
        title = { Text(stringResource(R.string.session_summary_eyebrow), maxLines = 1, style = MaterialTheme.typography.titleSmall) },
        bottomBar =
            if (startsFor != null || instead != null || onStop != null || viewModel.failed != null) {
                {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        when (viewModel.failed) {
                            SessionAction.Start -> ErrorLine(stringResource(R.string.today_open_failed))
                            SessionAction.Stop -> ErrorLine(stringResource(R.string.session_next_stop_failed))
                            else -> Unit
                        }
                        FlowRow(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.End),
                            verticalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            onStop?.let {
                                OutlinedButton(
                                    onClick = it,
                                    modifier = actionWidth,
                                    enabled = !busy,
                                ) { Text(stringResource(R.string.session_next_stop)) }
                            }
                            startsFor?.let { goal ->
                                Button(onClick = { viewModel.start(day, step, goal) }, enabled = !busy) {
                                    Text(stringResource(R.string.session_next_start))
                                }
                            }
                            instead?.let { other ->
                                Button(
                                    onClick = { goalId?.let { viewModel.start(day, other, it) } },
                                    modifier = actionWidth,
                                    enabled = !busy,
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
        Column(Modifier.padding(padding).fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally) {
            SessionSegments(day, step, Modifier.widthIn(max = CONTENT_WIDTH).fillMaxWidth().padding(horizontal = 16.dp))
            Column(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 16.dp, vertical = 24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Column(Modifier.widthIn(max = CONTENT_WIDTH).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        stringResource(R.string.session_next_eyebrow),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.labelLarge,
                    )
                    Text(blockTitle(step), Modifier.semantics { heading() }, style = MaterialTheme.typography.headlineSmall)
                    blockDetail(step)?.let {
                        Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
                    }
                    StepFacts(step)
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
                        Row(
                            Modifier.padding(top = 16.dp),
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            CircularProgressIndicator(Modifier.padding(2.dp))
                            Text(stringResource(R.string.session_next_getting_ready), style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                }
            }
        }
    }
}

/** Main's session header segments: the day's work by its minutes, done in blue and the shown step as the learner's place. */
@Composable
private fun SessionSegments(
    day: DayView,
    step: DayStep,
    modifier: Modifier,
) {
    val steps = day.steps.filter { it.status != StudyBlock.Status.SKIPPED }
    val done = MaterialTheme.colorScheme.tertiary
    val parts =
        steps.map {
            val fill =
                when {
                    it.status == StudyBlock.Status.COMPLETED -> MeterPart.Fill.Solid(done)
                    it.position == step.position -> MeterPart.Fill.Place()
                    else -> MeterPart.Fill.Track
                }
            MeterPart(fill, weight = it.estimatedMinutes.coerceAtLeast(1).toFloat())
        }

    if (parts.isNotEmpty()) MeterParts(parts, modifier, contentDescription = stepsDone(steps.count(DayStep::isFinished), steps.size))
}

@Composable
private fun StepFacts(step: DayStep) {
    val facts =
        listOfNotNull(
            formatMinutes(step.estimatedMinutes.toInt(), currentLocale()),
            stringResource(R.string.today_step_often_tested).takeIf { step.oftenTested },
        )
    Text(
        facts.joinToString(" · "),
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        style = MaterialTheme.typography.labelMedium.withTabularFigures(),
    )
}

@Composable
private fun ErrorLine(text: String) {
    Text(text, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium)
}

@Composable
private fun SessionLoading(onClose: () -> Unit) {
    TaskScaffold(onClose = onClose) { padding ->
        Column(
            Modifier.padding(padding).fillMaxSize(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            CircularProgressIndicator()
        }
    }
}

/** Main's `findAlternativeStudyBlock`: other work to do while [step]'s lesson waits, never work that waits itself. */
private fun StudySession.alternativeTo(step: StudyBlock): DayStep? =
    blocks
        .firstOrNull {
            it.id != step.id && it.status == StudyBlock.Status.PENDING && it.kind != StudyBlock.Kind.LEARN && it.waitReason == null
        }?.toDayStep()

private val OPEN = setOf(StudyBlock.Status.ACTIVE, StudyBlock.Status.PENDING)
private const val LESSON_CHECK_MILLIS = 5_000L
private val CONTENT_WIDTH = 640.dp
