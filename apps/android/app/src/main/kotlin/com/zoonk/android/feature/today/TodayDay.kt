package com.zoonk.android.feature.today

import androidx.activity.compose.LocalActivity
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.adaptive.currentWindowAdaptiveInfoV2
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
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.window.core.layout.WindowSizeClass
import com.zoonk.android.R
import com.zoonk.android.data.Resource
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.feature.session.MissionOpens
import com.zoonk.android.feature.session.OpeningWaitLine
import com.zoonk.android.feature.session.WaitState
import com.zoonk.android.feature.session.page
import com.zoonk.android.feature.session.rememberWaitState
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.characters.BuddyLook
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.scaffold.DockedActionBar
import com.zoonk.android.ui.scaffold.PageWithSupportingPane
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

/** What Today shows of a day, worked out once per read. */
internal class TodayDayModel(
    val read: TodayRead.Day,
    val writingStalled: Boolean,
) {
    val day = read.day
    val today = read.today
    val state = day.dayState()
    val session = day.sessionState()
    val pastDate = today.pastDateLessons()?.takeIf { state == DayState.Rest || state == DayState.Ahead }
    val upNext = day.upNextLessons(pastDate != null)
    val keepLearning = upNext.isNotEmpty()
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun TodayDay(
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
) {
    val wide = currentWindowAdaptiveInfoV2().windowSizeClass.isWidthAtLeastBreakpoint(WindowSizeClass.WIDTH_DP_MEDIUM_LOWER_BOUND)
    val stalled =
        pollWhile(
            active = read.day.isWaitingForLessons(read.today.lessonStatus),
            read = today,
            context = Triple(read.today.goal.id, read.day.localDate, read.day.sessionId),
        ).stalled
    val model = remember(read, stalled) { TodayDayModel(read, stalled) }
    val activity = LocalActivity.current
    DisposableEffect(viewModel) { onDispose { if (activity?.isChangingConfigurations != true) viewModel.endVisit() } }
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
                next = { model.day.nextStep?.let { if (idle()) viewModel.open(read, it, next = true) } },
                keepLearning = { if (idle()) viewModel.keepLearning(read) },
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
                notice = { layout -> TodayNotice(TodayNoticeState(read, viewModel, navigator::open, plans), layout) },
                onMission = { opens -> openMission(opens, model, actions, today, scope) },
                navigate = navigator::open,
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
                            TodayAside(model, aside, beside = false, modifier = Modifier.pageItem().padding(top = 32.dp))
                        }
                    }
                }

                if (!wide) TodayActionBar(model, viewModel, actions)
            }
        }
    }
}

/** A mission's block opens as its row does; its page opens where it lives. */
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
            if (step != null) actions.open(step) else scope.launch { today.refresh() }
        }

        else -> {
            opens.page(goalId)?.let(actions.navigate)
        }
    }
}

internal class TodayActionHandlers(
    val open: (com.zoonk.android.feature.session.DayStep) -> Unit,
    val next: () -> Unit,
    val keepLearning: () -> Unit,
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
            state == DayState.Underway ||
            state == DayState.Done ||
            (state == DayState.Ahead && day.extraTime.available)

@Composable
internal fun TodayAction(
    model: TodayDayModel,
    viewModel: TodayViewModel,
    actions: TodayActionHandlers,
    modifier: Modifier,
    docked: Boolean,
) {
    if (!model.hasAction) return

    val pending = viewModel.pending
    val status = rememberActionStatus(model, viewModel)
    val tap =
        when {
            model.pastDate != null -> null
            model.keepLearning || model.state == DayState.Ahead -> TodayTap.KeepLearning
            model.state == DayState.Underway -> TodayTap.Continue
            else -> null
        }

    Column(modifier, horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        val buttonModifier = if (docked) Modifier.fillMaxWidth() else Modifier
        val busy = tap != null && pending == tap

        when {
            model.pastDate != null -> {
                ActionButton(stringResource(R.string.today_see_plan), busy = false, buttonModifier) { actions.navigate(AppRoute.Plan()) }
            }

            model.keepLearning -> {
                ActionButton(stringResource(R.string.today_keep_learning), busy, buttonModifier, actions.keepLearning)
            }

            model.state == DayState.Underway -> {
                val label = if (model.session.started) R.string.today_continue_session else R.string.today_start_session
                ActionButton(stringResource(label), busy, buttonModifier, actions.next)
            }

            model.state == DayState.Done -> {
                ActionButton(stringResource(R.string.today_see_summary), busy = false, buttonModifier) {
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
                ActionButton(stringResource(R.string.today_practice_minutes, minutes), busy, buttonModifier, actions.keepLearning)
            }
        }

        // Beside the title there's no room under the button: the day's meta line says it instead.
        if (docked) TodayActionStatus(status)
    }
}

/** What the day's action is waiting for, or that it failed. */
internal class ActionStatus(
    val wait: WaitState,
    val failed: TodayTap?,
) {
    val speaking: Boolean get() = wait != WaitState.None || failed != null
}

@Composable
internal fun rememberActionStatus(
    model: TodayDayModel,
    viewModel: TodayViewModel,
): ActionStatus {
    val tap =
        when {
            model.pastDate != null -> null
            model.keepLearning || model.state == DayState.Ahead -> TodayTap.KeepLearning
            model.state == DayState.Underway -> TodayTap.Continue
            else -> null
        }
    val wait = rememberWaitState(tap != null && viewModel.pending == tap)
    return ActionStatus(wait, tap?.takeIf { viewModel.failed == it })
}

@Composable
internal fun TodayActionStatus(
    status: ActionStatus,
    modifier: Modifier = Modifier,
) {
    OpeningWaitLine(status.wait, modifier)

    if (status.failed != null) {
        Text(
            text =
                stringResource(
                    if (status.failed ==
                        TodayTap.Continue
                    ) {
                        R.string.today_open_failed
                    } else {
                        R.string.today_keep_learning_failed
                    },
                ),
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
    onClick: () -> Unit,
) {
    Button(
        onClick = { if (!busy) onClick() },
        modifier = modifier.widthIn(min = 160.dp),
        contentPadding = ButtonDefaults.ContentPadding,
    ) {
        if (busy) {
            CircularProgressIndicator(
                modifier = Modifier.padding(end = ButtonDefaults.IconSpacing).size(ButtonDefaults.IconSize),
                color = MaterialTheme.colorScheme.onPrimary,
                strokeWidth = 2.dp,
            )
        }
        Text(label)
    }
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
internal fun Modifier.pageItem(): Modifier = widthIn(max = PAGE_WIDTH).fillMaxWidth().padding(horizontal = 16.dp)

private const val SWITCHING_ALPHA = 0.6f

/** Beside the title, the action and its wait line never squeeze the title. */
private val WIDE_ACTION_WIDTH = 280.dp
