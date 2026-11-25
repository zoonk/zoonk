package com.zoonk.android.feature.today

import androidx.activity.compose.LocalActivity
import androidx.annotation.StringRes
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.repeatOnLifecycle
import com.zoonk.android.R
import com.zoonk.android.app.AppSnackbars
import com.zoonk.android.data.AnalyticsEvent
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.Resource
import com.zoonk.android.data.TrackShown
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.challenge.MockScheduleStore
import com.zoonk.android.feature.language.LanguageLevelCard
import com.zoonk.android.feature.mock.MockScheduleNotice
import com.zoonk.android.feature.mock.MockScheduleSheet
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.plan.ExamOverActions
import com.zoonk.android.feature.session.DayStep
import com.zoonk.android.feature.session.MissionOpens
import com.zoonk.android.feature.session.OpeningWaitLine
import com.zoonk.android.feature.session.WaitState
import com.zoonk.android.feature.session.page
import com.zoonk.android.feature.session.rememberWaitState
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.ActOn
import com.zoonk.android.ui.characters.BuddyLook
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.scaffold.BarNoteRoom
import com.zoonk.android.ui.scaffold.BottomBar
import com.zoonk.android.ui.scaffold.PageWithSupportingPane
import com.zoonk.android.ui.scaffold.barNoteInPage
import com.zoonk.android.ui.scaffold.barNoteViewport
import com.zoonk.android.ui.scaffold.mainActionWidth
import com.zoonk.android.ui.scaffold.rememberBarNoteRoom
import com.zoonk.api.models.LanguageToday
import com.zoonk.api.models.StudyBlockLesson
import com.zoonk.api.models.StudySession
import com.zoonk.api.models.TodayGoal
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.util.UUID
import kotlin.time.Duration.Companion.seconds

/** What Today shows of a day, worked out once per read. */
internal class TodayDayModel(
    val read: TodayRead.Day,
    val writingStalled: Boolean,
) {
    val day = read.day
    val today = read.today

    /** Main's `useDayState`: a wait for the day's lessons that ran out asks for them, as a day nobody is preparing does. */
    val state = if (day.state == StudySession.State.WAITING && writingStalled) StudySession.State.PREPARE else day.state

    /** Only a day with no blocks asks for its lessons with its line and action; a started one asks from its list's row. */
    val asksForDay = state == StudySession.State.PREPARE && day.steps.isEmpty()

    /** Main's `useComingLessons`: the held time's lessons are asked for once nobody is writing them or the wait ran out. */
    val comingAsks = day.lessonsToPrepare || writingStalled
    val pastDate = today.pastDateLessons()?.takeIf { state == StudySession.State.REST || state == StudySession.State.AHEAD }
    val upNext = day.upNextLessons(pastDate != null)
    val keepLearning = upNext.isNotEmpty()
    val summaryRoute = AppRoute.Session(goalId = (day.goalId ?: today.goal.id).toString(), summaryRequested = true)

    /** The day's one main action, which its button, its wait and its failure all follow; null for none. */
    val action: TodayMainAction? =
        when {
            pastDate != null -> if (today.goal.kind == TodayGoal.Kind.EXAM) TodayMainAction.ExamOver else TodayMainAction.SeePlan

            asksForDay -> TodayMainAction.Prepare

            // A finished day stays done while the extra work after it goes on.
            state == StudySession.State.UNDERWAY || (state == StudySession.State.DONE && day.nextStep != null) -> TodayMainAction.Continue

            keepLearning -> TodayMainAction.KeepLearning

            state == StudySession.State.DONE -> TodayMainAction.Summary

            state == StudySession.State.AHEAD && day.extraTime.available -> TodayMainAction.Practice

            else -> null
        }
}

internal enum class TodayMainAction { ExamOver, SeePlan, Prepare, Continue, KeepLearning, Summary, Practice }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TodayDay(
    read: TodayRead.Day,
    today: Resource<TodayRead>,
    switching: Boolean,
    viewModel: TodayViewModel,
    navigator: AppNavigator,
    padding: PaddingValues,
    buddy: BuddyLook,
    buddyName: String,
    practice: @Composable () -> Unit = {},
    language: LoadState<LanguageToday>? = null,
    onboarding: OnboardingStore? = null,
    snackbars: AppSnackbars,
    schedule: MockScheduleStore? = null,
    refreshIfChanged: suspend () -> Boolean,
    refreshIfLessonsMoved: suspend (Map<UUID, StudyBlockLesson>) -> Unit,
) {
    val poll =
        pollWhile(
            active = read.day.isWaitingForOutline,
            read = today,
            context = Triple(read.today.goal.id, read.day.localDate, read.day.sessionId),
            poll = refreshIfChanged,
        )
    FollowLessonsBeingWritten(read.day.lessonsBeingWritten, refreshIfLessonsMoved)
    val model = remember(read, poll.stalled) { TodayDayModel(read, poll.stalled) }
    val fresh by today.freshState.collectAsStateWithLifecycle()
    val activity = LocalActivity.current
    DisposableEffect(viewModel, read.noticeVisit()) { onDispose { if (activity?.isChangingConfigurations != true) viewModel.endVisit() } }
    // In the app's snackbars, since the save it reports can end after a recreated window took this one's place.
    ActOn(viewModel.examOverFailure) { snackbars.show(R.string.today_save_failed) }
    TrackShown(AnalyticsEvent.TodayViewed)
    // Here rather than in the notice, which a lazy list or a layout change can compose again within one visit.
    viewModel.noticeEvent(read)?.let { TrackShown(it) }
    val scope = rememberCoroutineScope()
    var pulled by remember { mutableStateOf(false) }
    val list = rememberLazyListState()
    var scheduleId by rememberSaveable { mutableStateOf<String?>(null) }
    if (schedule != null) {
        scheduleId?.let { id ->
            MockScheduleSheet(schedule, UUID.fromString(id), navigator) { scheduleId = null }
        }
    }
    val actions =
        remember(viewModel, navigator, model, switching) {
            val idle = { !switching }
            TodayActionHandlers(
                open = { step -> if (idle()) viewModel.open(read, step, next = false) },
                openMission = { step -> if (idle()) viewModel.openMission(read, step) },
                next = { model.day.nextStep?.let { if (idle()) viewModel.open(read, it, next = true) } },
                keepLearning = { if (idle()) viewModel.keepLearning(read) },
                upNext = { if (idle()) viewModel.keepLearning(read, fromUpNext = true) },
                prepare = { if (idle()) viewModel.prepareLessons(read) },
                navigate = navigator::open,
                schedule = schedule?.let { { id -> if (idle()) scheduleId = id.toString() } },
            )
        }

    PullToRefreshBox(
        isRefreshing = pulled,
        onRefresh = {
            pulled = true
            scope.launch {
                today.refresh()
                pulled = false
                poll.restart()
            }
        },
        modifier = Modifier.fillMaxSize().padding(padding),
    ) {
        val aside =
            TodayAsideState(
                buddy = buddy,
                buddyName = buddyName,
                practice = practice,
                notice = { layout ->
                    TodayNotice(
                        TodayNoticeState(
                            read,
                            fresh is LoadState.Loaded || fresh is LoadState.Failed,
                            viewModel,
                            navigator::open,
                            language?.value,
                            onboarding,
                        ),
                        layout,
                    )
                    if (onboarding != null) UnfinishedGoal(onboarding, navigator::open)
                },
                onMission = { opens -> openMission(opens, model, actions, today, scope) },
                pending = { viewModel.pending },
                failed = { viewModel.failed },
                navigate = navigator::open,
                standing = {
                    val openPlan = { navigator.open(AppRoute.Plan()) }
                    if (read.today.goal.kind == TodayGoal.Kind.LANGUAGE) {
                        language?.value?.let { today ->
                            today.level?.let { LanguageLevelCard(it, today.targetLanguage, onOpenPlan = openPlan) }
                        }
                    } else {
                        TodayPreparation(
                            read.today.progress,
                            onOpenPlan = openPlan,
                            goalTitle = read.today.goal.displayName,
                        )
                    }
                },
            )

        // While a switch is on its way the page still shows the previous goal; a tap would open its session.
        PageWithSupportingPane(
            supportingPane = { TodayAsidePane(model, aside) },
            modifier = Modifier.alpha(if (switching) SWITCHING_ALPHA else 1f),
        ) { beside ->
            val noteRoom = rememberBarNoteRoom(list)
            Column(Modifier.fillMaxSize()) {
                LazyColumn(
                    modifier = Modifier.weight(1f).fillMaxWidth().barNoteViewport(noteRoom),
                    state = list,
                    horizontalAlignment = if (beside) Alignment.Start else Alignment.CenterHorizontally,
                    contentPadding = PaddingValues(top = 8.dp, bottom = 24.dp + noteRoom.height),
                ) {
                    item(key = "heading", contentType = "heading") {
                        TodayHeading(
                            model,
                            onAdjustPlan = { actions.navigate(AppRoute.Plan()) },
                            Modifier.pageItem(),
                            schedule = actions.schedule,
                        )
                    }

                    if (schedule != null) {
                        item(key = "mock-notice") { MockScheduleNotice(schedule, Modifier.pageItem()) }
                    }
                    todaySession(model, viewModel, actions, list, buddyName)

                    if (!beside) {
                        item(key = "aside", contentType = "aside") {
                            // Main pulls the notice up under the day's action; the docked action leaves the queue right above it.
                            TodayAside(model, aside, beside = false, modifier = Modifier.pageItem().padding(top = 24.dp))
                        }
                    }
                    barNoteInPage(noteRoom, Modifier.pageItem())
                }

                TodayActionBar(model, viewModel, actions, beside, noteRoom)
            }
        }
    }
}

/** The day's read can't tell a writer that stopped, so only readiness moves a row on. */
@Composable
private fun FollowLessonsBeingWritten(
    lessons: Map<UUID, StudyBlockLesson>,
    refreshIfLessonsMoved: suspend (Map<UUID, StudyBlockLesson>) -> Unit,
) {
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    LaunchedEffect(lessons) {
        if (lessons.isEmpty()) return@LaunchedEffect
        lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            while (true) {
                delay(LESSON_CHECK_INTERVAL)
                refreshIfLessonsMoved(lessons)
            }
        }
    }
}

private val LESSON_CHECK_INTERVAL = 5.seconds

private fun openMission(
    opens: MissionOpens,
    model: TodayDayModel,
    actions: TodayActionHandlers,
    today: Resource<TodayRead>,
    scope: CoroutineScope,
) {
    val goalId = (model.day.goalId ?: model.today.goal.id).toString()

    when (opens) {
        is MissionOpens.Block -> {
            val step = model.day.steps.firstOrNull { if (opens.blockId != null) it.id == opens.blockId else it.position == opens.position }
            // Done or gone meanwhile: Today reads the day again so the learner sees why.
            if (step != null) actions.openMission(step) else scope.launch { today.refresh() }
        }

        else -> {
            opens.page(goalId)?.let(actions.navigate)
        }
    }
}

internal class TodayActionHandlers(
    val open: (com.zoonk.android.feature.session.DayStep) -> Unit,
    val openMission: (com.zoonk.android.feature.session.DayStep) -> Unit,
    val next: () -> Unit,
    val keepLearning: () -> Unit,
    val upNext: () -> Unit,
    val prepare: () -> Unit,
    val navigate: (AppRoute) -> Unit,
    val schedule: ((UUID) -> Unit)? = null,
)

/** The day's one action, pinned to the bottom at every width; what it waits for or why it failed shows over the bar. */
@Composable
private fun TodayActionBar(
    model: TodayDayModel,
    viewModel: TodayViewModel,
    actions: TodayActionHandlers,
    beside: Boolean,
    noteRoom: BarNoteRoom,
) {
    if (model.action == null) return

    val status = rememberActionStatus(model, viewModel)
    // The day's column: at the pane's start beside its aside, its rows' inset at its sides.
    BottomBar(
        columnWidth = PAGE_WIDTH,
        columnAtStart = beside,
        columnMargin = LIST_ITEM_INSET,
        note = if (status.speaking) ({ TodayActionStatus(status) }) else null,
        noteRoom = noteRoom,
    ) {
        TodayAction(model, viewModel, actions, status)
    }
}

@Composable
private fun TodayAction(
    model: TodayDayModel,
    viewModel: TodayViewModel,
    actions: TodayActionHandlers,
    status: ActionStatus,
) {
    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.CenterEnd) {
        val buttonModifier = Modifier.mainActionWidth()
        val busy = status.tap != null && viewModel.pending == status.tap
        val waiting = viewModel.pending != null && !busy

        when (model.action) {
            TodayMainAction.ExamOver -> {
                TodayExamOver(model, viewModel)
            }

            TodayMainAction.SeePlan -> {
                ActionButton(stringResource(R.string.today_see_your_plan), busy = false, buttonModifier) {
                    actions.navigate(AppRoute.Plan(focus = "time"))
                }
            }

            TodayMainAction.Prepare -> {
                ActionButton(
                    stringResource(R.string.today_get_lessons),
                    busy,
                    buttonModifier,
                    waiting = waiting,
                    onClick = actions.prepare,
                )
            }

            TodayMainAction.KeepLearning -> {
                ActionButton(stringResource(R.string.today_keep_learning), busy, buttonModifier, waiting, onClick = actions.keepLearning)
            }

            TodayMainAction.Continue -> {
                val label = if (model.day.started) R.string.today_continue_session else R.string.today_start_session
                ActionButton(stringResource(label), busy, buttonModifier, waiting, onClick = actions.next)
            }

            TodayMainAction.Summary -> {
                ActionButton(stringResource(R.string.today_see_summary), busy = false, buttonModifier) {
                    actions.navigate(model.summaryRoute)
                }
            }

            TodayMainAction.Practice -> {
                val minutes =
                    formatNumber(
                        model.day.extraTime.minutes
                            .toDouble(),
                        currentLocale(),
                    )
                ActionButton(
                    stringResource(R.string.today_practice_minutes, minutes),
                    busy,
                    buttonModifier,
                    waiting,
                    onClick = actions.keepLearning,
                )
            }

            null -> {}
        }
    }
}

/** What the day's action is waiting for, or why it failed. */
internal class ActionStatus(
    val tap: TodayTap?,
    val wait: WaitState,
    @StringRes val failure: Int?,
) {
    val speaking: Boolean get() = wait != WaitState.None || failure != null
}

@Composable
internal fun rememberActionStatus(
    model: TodayDayModel,
    viewModel: TodayViewModel,
): ActionStatus {
    val tap =
        when (model.action) {
            TodayMainAction.Prepare -> TodayTap.Prepare
            TodayMainAction.KeepLearning, TodayMainAction.Practice -> TodayTap.KeepLearning
            TodayMainAction.Continue -> TodayTap.Continue
            else -> null
        }
    val wait = rememberWaitState(tap != null && viewModel.pending == tap)
    val failure =
        when {
            tap == null || viewModel.failed != tap -> null
            tap == TodayTap.Continue -> R.string.today_open_failed
            model.action == TodayMainAction.KeepLearning -> R.string.today_keep_learning_failed
            else -> R.string.today_save_failed
        }
    return ActionStatus(tap, wait, failure)
}

@Composable
internal fun TodayActionStatus(
    status: ActionStatus,
    modifier: Modifier = Modifier,
) {
    OpeningWaitLine(status.wait, modifier)

    if (status.failure != null) {
        Text(
            text = stringResource(status.failure),
            modifier = modifier,
            color = MaterialTheme.colorScheme.error,
            style = MaterialTheme.typography.bodyMedium,
        )
    }
}

@Composable
private fun ActionButton(
    label: String,
    busy: Boolean,
    modifier: Modifier,
    waiting: Boolean = false,
    onClick: () -> Unit,
) {
    Button(
        busy = busy,
        onClick = onClick,
        modifier = modifier,
        enabled = !waiting,
        focusableWhenDisabled = waiting,
    ) { Text(label) }
}

/** Nothing cached yet: the page's title, and a quiet sign it's on its way. */
@Composable
internal fun TodayPlaceholder(padding: PaddingValues) {
    TodayPage(padding) {
        TodayPageHeader(stringResource(R.string.today_title))
        Box(Modifier.fillMaxWidth().padding(top = 32.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
    }
}

/** Each item reads as one centered column of main's page width, whatever the window. */
internal fun Modifier.pageItem(): Modifier = widthIn(max = PAGE_WIDTH).fillMaxWidth().padding(horizontal = LIST_ITEM_INSET)

/** A `ListRow` on the page: as wide as [pageItem]'s column with its margin, which the row insets itself. */
internal fun Modifier.pageRow(): Modifier = widthIn(max = PAGE_WIDTH).fillMaxWidth()

private const val SWITCHING_ALPHA = 0.6f

/** Main's `TodayExamOver`: the Plan's answers after the exam's date; [TodayDay] says a failed save in the shared toast. */
@Composable
private fun TodayExamOver(
    model: TodayDayModel,
    viewModel: TodayViewModel,
) {
    val goal = model.today.goal
    val answer = viewModel.examOverAnswer?.takeIf { it.goalId == goal.id }

    ExamOverActions(
        goalTitle = goal.displayName,
        keeping = answer?.archive == false,
        archiving = answer?.archive == true,
        onArchive = { viewModel.archiveGoal(goal.id) },
        onKeepStudying = { viewModel.keepStudying(goal.id) },
    )
}
