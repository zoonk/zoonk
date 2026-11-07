package com.zoonk.android.feature.today

import androidx.activity.compose.LocalActivity
import androidx.annotation.DrawableRes
import androidx.annotation.StringRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
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
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.data.AnalyticsEvent
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.Resource
import com.zoonk.android.data.TrackShown
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.language.LanguageLevelCard
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.feature.session.DayStep
import com.zoonk.android.feature.session.MissionOpens
import com.zoonk.android.feature.session.OpeningWaitLine
import com.zoonk.android.feature.session.WaitState
import com.zoonk.android.feature.session.page
import com.zoonk.android.feature.session.rememberWaitState
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.characters.BuddyLook
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.ButtonIcon
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.scaffold.DockedActionBar
import com.zoonk.android.ui.scaffold.PageWithSupportingPane
import com.zoonk.android.ui.scaffold.isMediumLayout
import com.zoonk.api.models.LanguageToday
import com.zoonk.api.models.StudySession
import com.zoonk.api.models.TodayGoal
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

/** What Today shows of a day, worked out once per read. */
internal class TodayDayModel(
    val read: TodayRead.Day,
    val writingStalled: Boolean,
) {
    val day = read.day
    val today = read.today
    val state = day.state
    val pastDate = today.pastDateLessons()?.takeIf { state == StudySession.State.REST || state == StudySession.State.AHEAD }
    val upNext = day.upNextLessons(pastDate != null)
    val keepLearning = upNext.isNotEmpty()
    val todaySubjects =
        day.steps
            .filterNot(DayStep::isFinished)
            .mapNotNull(DayStep::subject)
            .toSet()
}

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
    brainPower: Long? = null,
    practice: @Composable () -> Unit = {},
    plans: PlanStore? = null,
    language: LoadState<LanguageToday>? = null,
    onboarding: OnboardingStore? = null,
    refreshIfChanged: suspend () -> Boolean,
) {
    val wide = isMediumLayout()
    val poll =
        pollWhile(
            active = read.day.isWaitingForLessons(read.today.lessonStatus),
            read = today,
            context = Triple(read.today.goal.id, read.day.localDate, read.day.sessionId),
            poll = refreshIfChanged,
        )
    val model = remember(read, poll.stalled) { TodayDayModel(read, poll.stalled) }
    val activity = LocalActivity.current
    DisposableEffect(viewModel, read.noticeVisit()) { onDispose { if (activity?.isChangingConfigurations != true) viewModel.endVisit() } }
    TrackShown(AnalyticsEvent.TodayViewed)
    // Here rather than in the notice, which a lazy list or a layout change can compose again within one visit.
    viewModel.noticeEvent(read)?.let { TrackShown(it) }
    val scope = rememberCoroutineScope()
    var pulled by remember { mutableStateOf(false) }
    var doneOpen by rememberSaveable { mutableStateOf(false) }
    var moreOpen by rememberSaveable { mutableStateOf(false) }
    val folds = TodayFolds(doneOpen, moreOpen, toggleDone = { doneOpen = !doneOpen }, toggleMore = { moreOpen = !moreOpen })
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
                brainPower = brainPower,
                practice = practice,
                notice = { layout ->
                    TodayNotice(TodayNoticeState(read, viewModel, navigator::open, plans, language?.value, onboarding), layout)
                },
                onMission = { opens -> openMission(opens, model, actions, today, scope) },
                pending = { viewModel.pending },
                failed = { viewModel.failed },
                navigate = navigator::open,
                standing = {
                    val openPlan = { navigator.open(AppRoute.Plan()) }
                    if (read.today.goal.kind == TodayGoal.Kind.LANGUAGE) {
                        language?.value?.level?.let { LanguageLevelCard(it, onOpenPlan = openPlan) }
                    } else {
                        val syllabus = plans?.syllabus?.get(read.today.goal.id)?.collectShown()
                        TodayPreparation(read.today.progress, syllabus?.value?.value, model.todaySubjects, onOpenPlan = openPlan)
                    }
                },
            )

        // While a switch is on its way the page still shows the previous goal; a tap would open its session.
        PageWithSupportingPane(
            supportingPane = { TodayAsidePane(model, aside) },
            modifier = Modifier.alpha(if (switching) SWITCHING_ALPHA else 1f),
        ) { beside ->
            Column(Modifier.fillMaxSize()) {
                LazyColumn(
                    modifier = Modifier.weight(1f).fillMaxWidth(),
                    horizontalAlignment = if (beside) Alignment.Start else Alignment.CenterHorizontally,
                    contentPadding = PaddingValues(top = 8.dp, bottom = 24.dp),
                ) {
                    item(key = "heading", contentType = "heading") {
                        TodayHeading(model, wide, Modifier.pageItem()) {
                            if (wide) TodayAction(model, viewModel, actions, Modifier.widthIn(max = WIDE_ACTION_WIDTH), docked = false)
                        }
                    }

                    todaySession(model, viewModel, actions, folds, wide, buddyName)

                    if (!beside) {
                        item(key = "aside", contentType = "aside") {
                            // Main pulls the notice up under the day's action; the docked action leaves the queue right above it.
                            TodayAside(model, aside, beside = false, modifier = Modifier.pageItem().padding(top = 24.dp))
                        }
                    }
                }

                if (!wide) TodayActionBar(model, viewModel, actions)
            }
        }
    }
}

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
)

/** Docked above the navigation bar on a phone, so the day's one action is always in reach. */
@Composable
private fun TodayActionBar(
    model: TodayDayModel,
    viewModel: TodayViewModel,
    actions: TodayActionHandlers,
) {
    if (!model.hasAction) return

    DockedActionBar {
        TodayAction(model, viewModel, actions, Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), docked = true)
    }
}

private val TodayDayModel.hasAction: Boolean
    get() =
        pastDate != null ||
            keepLearning ||
            state == StudySession.State.UNDERWAY ||
            state == StudySession.State.DONE ||
            state == StudySession.State.PREPARE ||
            (state == StudySession.State.AHEAD && day.extraTime.available)

@Composable
internal fun TodayAction(
    model: TodayDayModel,
    viewModel: TodayViewModel,
    actions: TodayActionHandlers,
    modifier: Modifier,
    docked: Boolean,
) {
    if (!model.hasAction) return

    val status = rememberActionStatus(model, viewModel)

    Column(modifier, horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        val buttonModifier = if (docked) Modifier.fillMaxWidth() else Modifier
        val busy = status.tap != null && viewModel.pending == status.tap
        val waiting = viewModel.pending != null && !busy

        when {
            model.pastDate != null -> {
                ActionButton(stringResource(R.string.today_see_plan), busy = false, buttonModifier, icon = R.drawable.ic_arrow_forward) {
                    actions.navigate(AppRoute.Plan())
                }
            }

            model.state == StudySession.State.PREPARE -> {
                ActionButton(
                    stringResource(R.string.today_get_lessons),
                    busy,
                    buttonModifier,
                    waiting = waiting,
                    icon = R.drawable.ic_playlist_add,
                    onClick = actions.prepare,
                )
            }

            model.keepLearning -> {
                ActionButton(stringResource(R.string.today_keep_learning), busy, buttonModifier, waiting, onClick = actions.keepLearning)
            }

            model.state == StudySession.State.UNDERWAY -> {
                val label = if (model.day.started) R.string.today_continue_session else R.string.today_start_session
                ActionButton(stringResource(label), busy, buttonModifier, waiting, onClick = actions.next)
            }

            model.state == StudySession.State.DONE -> {
                ActionButton(stringResource(R.string.today_see_summary), busy = false, buttonModifier, icon = R.drawable.ic_arrow_forward) {
                    actions.navigate(AppRoute.Session(goalId = (model.day.goalId ?: model.today.goal.id).toString()))
                }
            }

            else -> {
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
        }

        // Beside the title, Continue's words go on the day's meta line, as main's do.
        if (docked || status.tap != TodayTap.Continue) TodayActionStatus(status)
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
        when {
            model.pastDate != null -> null
            model.state == StudySession.State.PREPARE -> TodayTap.Prepare
            model.keepLearning || model.state == StudySession.State.AHEAD -> TodayTap.KeepLearning
            model.state == StudySession.State.UNDERWAY -> TodayTap.Continue
            else -> null
        }
    val wait = rememberWaitState(tap != null && viewModel.pending == tap)
    val failure =
        when {
            tap == null || viewModel.failed != tap -> null
            tap == TodayTap.Continue -> R.string.today_open_failed
            tap == TodayTap.KeepLearning && model.keepLearning -> R.string.today_keep_learning_failed
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
            modifier = modifier.semantics { liveRegion = LiveRegionMode.Polite },
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
    @DrawableRes icon: Int = R.drawable.ic_play_arrow,
    onClick: () -> Unit,
) {
    val forward = icon == R.drawable.ic_arrow_forward
    Button(
        busy = busy,
        onClick = onClick,
        modifier = modifier.widthIn(min = 160.dp),
        enabled = !waiting,
        focusableWhenDisabled = waiting,
        leadingIcon = if (forward) null else ({ ButtonIcon(icon) }),
        trailingIcon = if (forward) ({ ButtonIcon(R.drawable.ic_arrow_forward) }) else null,
    ) { Text(label) }
}

/** Nothing cached yet: the page's title, and a quiet sign it's on its way. */
@Composable
internal fun TodayPlaceholder(padding: PaddingValues) {
    TodayPage(padding) {
        TodayPageHeader(date = null, state = null, title = stringResource(R.string.today_title))
        Box(Modifier.fillMaxWidth().padding(top = 32.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
    }
}

/** Each item reads as one centered column of main's page width, whatever the window. */
internal fun Modifier.pageItem(): Modifier = widthIn(max = PAGE_WIDTH).fillMaxWidth().padding(horizontal = LIST_ITEM_INSET)

/** A `ListRow` on the page: as wide as [pageItem]'s column with its margin, which the row insets itself. */
internal fun Modifier.pageRow(): Modifier = widthIn(max = PAGE_WIDTH).fillMaxWidth()

private const val SWITCHING_ALPHA = 0.6f

/** Beside the title, the action and its wait line never squeeze the title. */
private val WIDE_ACTION_WIDTH = 280.dp
