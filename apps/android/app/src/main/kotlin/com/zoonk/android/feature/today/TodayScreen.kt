package com.zoonk.android.feature.today

import androidx.annotation.DrawableRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.account.VisitorWelcome
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.LearnerAccess
import com.zoonk.android.ui.characters.BuddyLook
import com.zoonk.android.ui.characters.buddyName
import com.zoonk.android.ui.characters.look
import com.zoonk.android.ui.components.GoalBox
import com.zoonk.android.ui.components.GoalExamples
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.StatusMessage
import com.zoonk.android.ui.components.rememberGoalExamples
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.scaffold.TabRootScaffold
import com.zoonk.api.models.LearnerSummary
import com.zoonk.api.models.LearnerSummaryGoal
import com.zoonk.api.models.SuggestedGoal
import com.zoonk.api.models.TodayGoal
import kotlinx.coroutines.launch
import java.time.ZoneId

/** Today's tab: the day's session, or what stands in for it (no goal, a paused goal, a plan being built). */
@Composable
fun TodayScreen(
    app: AppContainer,
    navigator: AppNavigator,
) {
    val access by app.learnerAccess.collectAsStateWithLifecycle()
    val viewModel = viewModel { TodayViewModel(app.studyOpener, app.today, app.plans) }

    LaunchedEffect(viewModel, navigator) {
        viewModel.routes.collect { tapped ->
            // A goal switch or a new day since the tap: what it opened belongs to the day no longer shown.
            val shown = app.today.today.state.value.value as? TodayRead.Day
            val same = tapped.goalId == null || (shown?.today?.goal?.id == tapped.goalId && shown.day.localDate == tapped.localDate)
            if (same && app.goalSwitch.pending.value == null) navigator.open(tapped.route)
        }
    }

    TabRootScaffold(app, navigator) { padding ->
        when (access) {
            LearnerAccess.Visitor -> {
                VisitorWelcome(app, navigator, padding)
            }

            LearnerAccess.SessionEnded -> {
                SessionEnded(navigator, padding)
            }

            LearnerAccess.Unavailable -> {
                val scope = rememberCoroutineScope()
                LoadFailedMessage(onRetry = { scope.launch { app.sessions.retryRestore() } }, modifier = Modifier.padding(padding))
            }

            LearnerAccess.Restoring -> {
                TodayPlaceholder(padding)
            }

            LearnerAccess.SignedIn, LearnerAccess.NoGoal, LearnerAccess.Learner -> {
                TodayRead(app, navigator, viewModel, padding)
            }
        }
    }
}

@Composable
private fun TodayRead(
    app: AppContainer,
    navigator: AppNavigator,
    viewModel: TodayViewModel,
    padding: PaddingValues,
) {
    val state by app.today.today.collectShown()
    val summary by app.learnerSummary.summary.collectShown()
    val switchingTo by app.goalSwitch.pending.collectAsStateWithLifecycle()
    val saving by app.goalSwitch.saving.collectAsStateWithLifecycle()
    val refreshing by app.today.today.isRefreshing
        .collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()
    val shown = state.value

    LaunchedEffect(shown) { if (shown !is TodayRead.GoalNotActive) viewModel.resumed() }
    LaunchedEffect(shown, switchingTo) { switchingTo?.takeIf { app.today.shows(it) }?.let(app.goalSwitch::settle) }

    when (val shown = state) {
        LoadState.Idle, LoadState.Loading -> {
            TodayPlaceholder(padding)
        }

        is LoadState.Failed, LoadState.Empty -> {
            LoadFailedMessage(onRetry = { scope.launch { app.today.today.refresh() } }, modifier = Modifier.padding(padding))
        }

        is LoadState.Loaded -> {
            when (val read = shown.value) {
                is TodayRead.Day -> {
                    val behind = switchingTo != null && read.today.goal.id != switchingTo

                    // The switch saved but Today couldn't read the new goal's day: never offer the old one's.
                    if (behind && !saving && !refreshing) {
                        LoadFailedMessage(onRetry = { scope.launch { app.today.today.refresh() } }, modifier = Modifier.padding(padding))
                        return
                    }

                    val buddy = summary.value?.buddy?.look() ?: BuddyLook()
                    val brainPower by app.today.brainPower.collectShown()
                    val language =
                        if (read.today.goal.kind == TodayGoal.Kind.LANGUAGE) {
                            app.today.language[read.today.goal.id]
                                .collectShown()
                                .value
                        } else {
                            null
                        }
                    TodayDay(
                        read = read,
                        today = app.today.today,
                        switching = behind,
                        viewModel = viewModel,
                        navigator = navigator,
                        padding = padding,
                        buddy = buddy,
                        buddyName = buddyName(buddy.kind, summary.value?.buddy?.name),
                        brainPower = brainPower.value,
                        practice = { TodayPractice(app.today, read.today.goal, navigator::open) },
                        plans = app.plans,
                        language = language,
                    )
                }

                is TodayRead.NoGoal -> {
                    val suggestion = read.suggestedGoal
                    if (suggestion != null) {
                        WelcomeBack(suggestion, viewModel, padding)
                    } else {
                        FirstGoal(summary.value, navigator, padding)
                    }
                }

                is TodayRead.Preparing -> {
                    Preparing(app, navigator, read, padding)
                }

                TodayRead.GoalNotActive -> {
                    GoalAtRest(app, navigator, viewModel, summary.value, padding)
                }
            }
        }
    }
}

/** Main's date line reads the goal's time zone; with none known it shows no date rather than one that may be off by a day. */
@Composable
internal fun localDayLine(summary: LearnerSummary?): String? {
    val zone = summary?.timeZone ?: return null
    val today = java.time.LocalDate.now(ZoneId.of(zone))
    return formatDate(today, currentLocale(), DateStyle.WeekdayDayShort, today)
}

/** The plan is still in the account, so this leads back to it instead of a first goal built again as a guest. */
@Composable
private fun SessionEnded(
    navigator: AppNavigator,
    padding: PaddingValues,
) {
    StatusMessage(
        icon = R.drawable.ic_lock,
        title = stringResource(R.string.gate_session_ended_title),
        description = stringResource(R.string.today_session_ended_description),
        modifier = Modifier.padding(padding).verticalScroll(rememberScrollState()),
    ) {
        Button(onClick = { navigator.open(AppRoute.Login) }) { Text(stringResource(R.string.gate_log_in)) }
        OutlinedButton(onClick = { navigator.open(AppRoute.StartGoal()) }) { Text(stringResource(R.string.gate_start_something_new)) }
    }
}

@Composable
private fun WelcomeBack(
    suggestion: SuggestedGoal,
    viewModel: TodayViewModel,
    padding: PaddingValues,
) {
    TodayPage(padding) {
        TodayPageHeader(date = null, state = null, title = stringResource(R.string.today_welcome_back))
        TodayStatusLine(
            icon = R.drawable.ic_explore,
            sentence = stringResource(R.string.today_suggested_goal_question, suggestion.title),
            clause = stringResource(R.string.today_suggested_goal_detail),
        )
        TodayActions {
            Button(enabled = !viewModel.isAnswering, onClick = { viewModel.answer(suggestion, accepted = true, hasGoal = false) }) {
                Text(stringResource(R.string.today_suggested_goal_accept))
            }
            OutlinedButton(
                enabled = !viewModel.isAnswering,
                onClick = { viewModel.answer(suggestion, accepted = false, hasGoal = false) },
            ) {
                Text(stringResource(R.string.today_not_now))
            }
        }
        if (viewModel.answerFailed) SaveFailed(stringResource(R.string.today_save_failed))
    }
}

/** A signed-in learner without a goal states one here; an unfinished quick explanation comes first. */
@Composable
private fun FirstGoal(
    summary: LearnerSummary?,
    navigator: AppNavigator,
    padding: PaddingValues,
) {
    var goal by rememberSaveable { mutableStateOf("") }
    val start = { words: String -> navigator.open(AppRoute.StartGoal(goal = words)) }
    val explanation =
        summary?.goals?.lastOrNull {
            it.kind == LearnerSummaryGoal.Kind.EXPLAIN && it.status != LearnerSummaryGoal.Status.COMPLETED &&
                it.status != LearnerSummaryGoal.Status.ARCHIVED
        }

    TodayPage(padding) {
        TodayPageHeader(date = localDayLine(summary), state = null, title = stringResource(R.string.today_title))
        if (explanation != null) ExplanationContinue(explanation, navigator)
        GoalBox(value = goal, onValueChange = { goal = it }, onSubmit = start)
        GoalExamples(examples = rememberGoalExamples(), onPick = start)
    }
}

@Composable
private fun ExplanationContinue(
    explanation: LearnerSummaryGoal,
    navigator: AppNavigator,
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        androidx.compose.material3.ListItem(
            headlineContent = { Text(explanation.title) },
            supportingContent = { Text(stringResource(R.string.today_quick_explanation)) },
            leadingContent = {
                androidx.compose.material3.Icon(painterResource(R.drawable.ic_play_arrow), contentDescription = null)
            },
            colors =
                androidx.compose.material3.ListItemDefaults
                    .colors(containerColor = MaterialTheme.colorScheme.surfaceContainerHigh),
            modifier = Modifier.clip(MaterialTheme.shapes.medium),
        )
        Button(onClick = { navigator.open(AppRoute.Explain(explanation.id.toString())) }) {
            Text(stringResource(R.string.today_continue_explanation))
        }
    }
}

/** Pausing or finishing a goal never swaps the page for another. */
@Composable
private fun GoalAtRest(
    app: AppContainer,
    navigator: AppNavigator,
    viewModel: TodayViewModel,
    summary: LearnerSummary?,
    padding: PaddingValues,
) {
    val goal = summary?.goals?.firstOrNull { it.id == summary.activeGoalId }
    val date = localDayLine(summary)

    if (goal?.status == LearnerSummaryGoal.Status.COMPLETED) {
        TodayAtRest(
            padding = padding,
            date = date,
            state = stringResource(R.string.today_finished),
            icon = R.drawable.ic_flag,
            sentence = stringResource(R.string.today_finished_goal, goal.title),
            clause = stringResource(R.string.today_finished_detail),
        ) {
            Button(onClick = { navigator.open(AppRoute.StartGoal()) }) { Text(stringResource(R.string.today_start_new_goal)) }
        }
        return
    }

    TodayAtRest(
        padding = padding,
        date = date,
        state = stringResource(R.string.today_paused),
        icon = R.drawable.ic_pause,
        sentence = goal?.let { stringResource(R.string.today_paused_goal, it.title) } ?: stringResource(R.string.today_paused_this_goal),
        clause = stringResource(R.string.today_paused_detail),
        detail = { if (goal?.status == LearnerSummaryGoal.Status.PAUSED) ResumeEffect(app, goal) },
        failure =
            when (viewModel.resumeFailure) {
                ResumeFailure.GoalLimit -> stringResource(R.string.today_resume_goal_limit)
                ResumeFailure.Failed -> stringResource(R.string.today_save_failed)
                null -> null
            },
    ) {
        if (goal != null) {
            Button(enabled = viewModel.resuming == null, onClick = { viewModel.resume(goal.id) }) {
                Text(stringResource(R.string.today_resume_goal, goal.title), maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            OutlinedButton(onClick = { navigator.open(AppRoute.StartGoal()) }) { Text(stringResource(R.string.today_new_goal)) }
        } else {
            Button(onClick = { navigator.open(AppRoute.StartGoal()) }) { Text(stringResource(R.string.today_new_goal)) }
        }
    }
}

@Composable
private fun ResumeEffect(
    app: AppContainer,
    goal: LearnerSummaryGoal,
) {
    val preview by app.today.resumePreview[goal.id].collectShown()

    if (preview.value == true) {
        Text(
            text = stringResource(R.string.today_resume_effect),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
    }
}

@Composable
private fun Preparing(
    app: AppContainer,
    navigator: AppNavigator,
    read: TodayRead.Preparing,
    padding: PaddingValues,
) {
    val left by app.today.onboardingLeft[read.goalId].collectShown()

    // A goal left halfway through its questions has no plan coming until they're answered.
    if (left.value == true) {
        TodayAtRest(
            padding = padding,
            date = null,
            state = stringResource(R.string.today_setting_up),
            icon = R.drawable.ic_checklist,
            sentence = stringResource(R.string.today_setting_up_goal, read.title),
            clause = stringResource(R.string.today_setting_up_detail),
        ) {
            Button(onClick = { navigator.open(AppRoute.GoalSetup(read.goalId.toString())) }) {
                Text(stringResource(R.string.today_continue_setting_up))
            }
        }
        return
    }

    val scope = rememberCoroutineScope()

    if (left is LoadState.Failed) {
        LoadFailedMessage(
            onRetry = { scope.launch { app.today.onboardingLeft[read.goalId].refresh() } },
            modifier = Modifier.padding(padding),
        )
        return
    }

    val poll = pollWhile(active = left.value == false, read = app.today.today, context = read.goalId)

    TodayPage(padding) {
        TodayPageHeader(date = stringResource(R.string.today_building_plan), state = null, title = stringResource(R.string.today_title))
        if (poll.stalled) PlanWaitStalled(poll.restart) else TodayPlanWait(read.title)
    }
}

/** Polling gave up: it may still be building, so Reconnect starts reading again. */
@Composable
private fun PlanWaitStalled(onReconnect: () -> Unit) {
    Column(
        modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(
            stringResource(R.string.today_connection_lost),
            modifier =
                Modifier.semantics {
                    heading()
                },
            style = MaterialTheme.typography.titleMedium,
        )
        Text(
            text = stringResource(R.string.today_connection_lost_detail),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
        OutlinedButton(onClick = onReconnect) { Text(stringResource(R.string.today_reconnect)) }
    }
}

@Composable
private fun TodayPlanWait(goalTitle: String) {
    Column(
        modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(text = stringResource(R.string.today_building_plan_goal, goalTitle), style = MaterialTheme.typography.titleMedium)
        Text(
            text = stringResource(R.string.today_building_plan_detail),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
        androidx.compose.material3.LinearProgressIndicator(modifier = Modifier.fillMaxWidth().padding(top = 8.dp))
    }
}

@Composable
private fun TodayAtRest(
    padding: PaddingValues,
    date: String?,
    state: String,
    @DrawableRes icon: Int,
    sentence: String,
    clause: String,
    detail: @Composable () -> Unit = {},
    failure: String? = null,
    actions: @Composable () -> Unit,
) {
    TodayPage(padding) {
        TodayPageHeader(date = date, state = state, title = stringResource(R.string.today_title))
        TodayStatusLine(icon = icon, sentence = sentence, clause = clause)
        detail()
        TodayActions(actions)
        if (failure != null) SaveFailed(failure)
    }
}

/** One readable column, scrolled, as main's `Page`. */
@Composable
internal fun TodayPage(
    padding: PaddingValues,
    content: @Composable () -> Unit,
) {
    Box(
        modifier = Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()),
        contentAlignment = Alignment.TopCenter,
    ) {
        Column(
            modifier = Modifier.widthIn(max = PAGE_WIDTH).fillMaxWidth().padding(horizontal = 16.dp, vertical = 24.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            content()
        }
    }
}

@Composable
internal fun TodayActions(content: @Composable () -> Unit) {
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) { content() }
}

@Composable
private fun SaveFailed(
    message: String,
    modifier: Modifier = Modifier,
) {
    Text(
        text = message,
        modifier = modifier.semantics { liveRegion = LiveRegionMode.Polite },
        color = MaterialTheme.colorScheme.error,
        style = MaterialTheme.typography.bodyMedium,
    )
}

internal val PAGE_WIDTH = 720.dp
