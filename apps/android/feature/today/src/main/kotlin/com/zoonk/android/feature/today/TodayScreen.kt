package com.zoonk.android.feature.today

import androidx.annotation.DrawableRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
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
import com.zoonk.android.data.AnalyticsEvent
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.TrackShown
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.account.VisitorWelcome
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.questionsLeft
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.LearnerAccess
import com.zoonk.android.navigation.SignInGate
import com.zoonk.android.ui.characters.BuddyLook
import com.zoonk.android.ui.characters.buddyName
import com.zoonk.android.ui.characters.look
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.GoalBox
import com.zoonk.android.ui.components.GoalExamples
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.StatusMessage
import com.zoonk.android.ui.components.TaskActions
import com.zoonk.android.ui.components.bleed
import com.zoonk.android.ui.components.rememberGoalExamples
import com.zoonk.android.ui.scaffold.BeforeFold
import com.zoonk.android.ui.scaffold.BottomBar
import com.zoonk.android.ui.scaffold.PageWithSupportingPane
import com.zoonk.android.ui.scaffold.TabRootScaffold
import com.zoonk.android.ui.scaffold.pagePadding
import com.zoonk.api.models.LearnerSummary
import com.zoonk.api.models.LearnerSummaryGoal
import com.zoonk.api.models.SuggestedGoal
import com.zoonk.api.models.TodayGoal
import kotlinx.coroutines.launch

/** Today's tab: the day's session, or what stands in for it (no goal, a paused goal, a plan being built). */
@Composable
fun TodayScreen(
    app: AppContainer,
    navigator: AppNavigator,
) {
    val access by app.learnerAccess.collectAsStateWithLifecycle()
    val viewModel = viewModel { TodayViewModel(app.studyOpener, app.today, app.plans, app.focusTests) }

    LaunchedEffect(viewModel, navigator) {
        viewModel.routes.collect { tapped ->
            // A goal switch or a new day since the tap: what it opened belongs to the day no longer shown.
            val shown = app.today.today.state.value.value as? TodayRead.Day
            val same = tapped.goalId == null || (shown?.today?.goal?.id == tapped.goalId && shown.day.localDate == tapped.localDate)
            if (same && app.goalSwitch.pending.value == null) navigator.open(tapped.route)
        }
    }

    TabRootScaffold { padding ->
        when (access) {
            LearnerAccess.Visitor -> {
                TrackShown(AnalyticsEvent.HomeViewed)
                VisitorWelcome(app, navigator, padding)
            }

            LearnerAccess.SessionEnded -> {
                SignInGate(ended = true, navigator, padding)
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
                        practice = {
                            TodayPractice(
                                app.today,
                                app.mocks,
                                read.today.goal,
                                completedLessons = summary.value?.places?.completedLessons == true,
                                navigate = navigator::open,
                            )
                        },
                        plans = app.plans,
                        refreshIfChanged = app.today::refreshIfChanged,
                        language = language,
                        onboarding = app.onboarding,
                    )
                }

                is TodayRead.NoGoal -> {
                    val suggestion = read.suggestedGoal
                    if (suggestion != null) {
                        WelcomeBack(suggestion, viewModel, padding)
                    } else {
                        FirstGoal(summary.value, app.onboarding, navigator, padding)
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

@Composable
internal fun WelcomeBack(
    suggestion: SuggestedGoal,
    viewModel: TodayViewModel,
    padding: PaddingValues,
) {
    TodayPage(
        padding,
        note = if (viewModel.answerFailed) ({ BarFailure(stringResource(R.string.today_save_failed)) }) else null,
        bottomBar = {
            TaskActions(
                back = {
                    OutlinedButton(
                        enabled = !viewModel.isAnswering,
                        onClick = { viewModel.answer(suggestion, accepted = false, hasGoal = false) },
                    ) {
                        Text(stringResource(R.string.today_not_now))
                    }
                },
            ) { main ->
                Button(
                    enabled = !viewModel.isAnswering,
                    onClick = { viewModel.answer(suggestion, accepted = true, hasGoal = false) },
                    modifier = main,
                ) {
                    Text(stringResource(R.string.today_suggested_goal_accept))
                }
            }
        },
    ) {
        TodayPageHeader(stringResource(R.string.today_welcome_back))
        TodayStatusLine(
            icon = R.drawable.ic_explore,
            sentence = stringResource(R.string.today_suggested_goal_question, suggestion.title),
            clause = stringResource(R.string.today_suggested_goal_detail),
        )
    }
}

/** A signed-in learner without a goal states one here; an unfinished quick explanation or goal comes first. */
@Composable
private fun FirstGoal(
    summary: LearnerSummary?,
    onboarding: OnboardingStore,
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

    PageWithSupportingPane(
        atFoldOnly = true,
        supportingPane = {
            GoalExamples(
                examples = rememberGoalExamples(),
                onPick = start,
                modifier = Modifier.verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 24.dp),
            )
        },
        modifier = Modifier.padding(padding),
    ) { examplesBeside ->
        TodayPage(PaddingValues()) {
            TodayPageHeader(stringResource(R.string.today_title))
            if (explanation != null) ExplanationContinue(explanation, navigator)
            UnfinishedGoal(onboarding, navigator::open)
            GoalBox(value = goal, onValueChange = { goal = it }, onSubmit = start)
            if (!examplesBeside) GoalExamples(examples = rememberGoalExamples(), onPick = start)
        }
    }
}

@Composable
private fun ExplanationContinue(
    explanation: LearnerSummaryGoal,
    navigator: AppNavigator,
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        ListRow(
            headline = { Text(explanation.displayName) },
            modifier = Modifier.bleed(LIST_ITEM_INSET),
            highlighted = true,
            leading = { androidx.compose.material3.Icon(painterResource(R.drawable.ic_play_arrow), contentDescription = null) },
            supporting = { Text(stringResource(R.string.today_quick_explanation)) },
        )
        Button(onClick = { navigator.open(AppRoute.Explain(explanation.id.toString())) }) {
            Text(stringResource(R.string.today_continue_draft))
        }
    }
}

/** A goal typed after the learner's newest goal and not confirmed yet, offered back where it was left. */
@Composable
internal fun UnfinishedGoal(
    onboarding: OnboardingStore,
    navigate: (AppRoute) -> Unit,
) {
    val state by onboarding.unfinishedGoal.collectShown()
    val draft = state.value ?: return

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        ListRow(
            headline = { Text(draft.prompt, maxLines = 3, overflow = TextOverflow.Ellipsis) },
            modifier = Modifier.bleed(LIST_ITEM_INSET),
            highlighted = true,
            leading = { androidx.compose.material3.Icon(painterResource(R.drawable.ic_edit), contentDescription = null) },
            supporting = { Text(stringResource(R.string.today_unfinished_setup)) },
        )
        OutlinedButton(onClick = { navigate(AppRoute.StartGoal(draftId = draft.draftId.toString())) }) {
            Text(stringResource(R.string.today_continue_draft))
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

    val newGoal = { navigator.open(AppRoute.StartGoal()) }

    if (goal?.status == LearnerSummaryGoal.Status.COMPLETED) {
        TodayAtRest(
            padding = padding,
            icon = R.drawable.ic_flag,
            sentence = stringResource(R.string.today_finished_goal, goal.displayName),
        ) { main -> Button(onClick = newGoal, modifier = main) { Text(stringResource(R.string.today_new_goal)) } }
        return
    }

    TodayAtRest(
        padding = padding,
        banner = { UnfinishedGoal(app.onboarding, navigator::open) },
        icon = R.drawable.ic_pause,
        sentence =
            goal?.let { stringResource(R.string.today_paused_goal, it.displayName) } ?: stringResource(R.string.today_paused_this_goal),
        clause = stringResource(R.string.today_paused_detail),
        detail = { if (goal?.status == LearnerSummaryGoal.Status.PAUSED) ResumeEffect(app, goal) },
        failure =
            when (viewModel.resumeFailure) {
                ResumeFailure.GoalLimit -> stringResource(R.string.today_resume_goal_limit)
                ResumeFailure.Failed -> stringResource(R.string.today_save_failed)
                null -> null
            },
        other = if (goal != null) ({ OutlinedButton(onClick = newGoal) { Text(stringResource(R.string.today_new_goal)) } }) else null,
    ) { main ->
        if (goal != null) {
            Button(busy = viewModel.resuming != null, onClick = { viewModel.resume(goal.id) }, modifier = main) {
                Text(stringResource(R.string.today_resume))
            }
        } else {
            Button(onClick = newGoal, modifier = main) { Text(stringResource(R.string.today_new_goal)) }
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
    val setup by app.onboarding.onboardings[read.goalId.toString()].collectShown()

    if (setup.value?.planRevealed == false && setup.value?.planReadiness?.ready == true) {
        TodayAtRest(
            padding = padding,
            icon = R.drawable.ic_check,
            sentence = stringResource(R.string.onboarding_plan_ready_goal, read.displayName),
        ) { main ->
            Button(onClick = { navigator.open(AppRoute.GoalSetup(read.goalId.toString(), revealMoment = true)) }, modifier = main) {
                Text(stringResource(R.string.onboarding_see_plan))
            }
        }
        return
    }

    // A goal left halfway through its questions has no plan coming until they're answered.
    if (setup.value?.questionsLeft == true) {
        TodayAtRest(
            padding = padding,
            icon = R.drawable.ic_checklist,
            sentence = stringResource(R.string.today_setting_up_goal, read.displayName),
        ) { main ->
            Button(onClick = { navigator.open(AppRoute.GoalSetup(read.goalId.toString())) }, modifier = main) {
                Text(stringResource(R.string.today_continue_draft))
            }
        }
        return
    }

    val scope = rememberCoroutineScope()

    if (setup is LoadState.Failed) {
        LoadFailedMessage(
            onRetry = { scope.launch { app.onboarding.onboardings[read.goalId.toString()].refresh() } },
            modifier = Modifier.padding(padding),
        )
        return
    }

    val poll = pollWhile(active = setup.value?.questionsLeft == false, read = app.today.today, context = read.goalId)

    TodayPage(padding) {
        TodayPageHeader(stringResource(R.string.today_title))
        if (poll.stalled) PlanWaitStalled(poll.restart) else TodayPlanWait(read.displayName)
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
internal fun TodayPlanWait(goalTitle: String) {
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

/** A goal with no day: what it is in the page, what to do about it in the bottom bar, the main action last. */
@Composable
internal fun TodayAtRest(
    padding: PaddingValues,
    @DrawableRes icon: Int,
    sentence: String,
    clause: String? = null,
    banner: @Composable () -> Unit = {},
    detail: @Composable () -> Unit = {},
    failure: String? = null,
    other: (@Composable () -> Unit)? = null,
    main: @Composable (Modifier) -> Unit,
) {
    TodayPage(
        padding,
        note = failure?.let { { BarFailure(it) } },
        bottomBar = { TaskActions(back = other) { modifier -> main(modifier) } },
    ) {
        banner()
        TodayPageHeader(stringResource(R.string.today_title))
        TodayStatusLine(icon = icon, sentence = sentence, clause = clause)
        detail()
    }
}

/** One readable column, scrolled, as main's `Page`, over the page's [bottomBar] when it has one. */
@Composable
internal fun TodayPage(
    padding: PaddingValues,
    note: (@Composable () -> Unit)? = null,
    bottomBar: (@Composable ColumnScope.() -> Unit)? = null,
    content: @Composable () -> Unit,
) {
    BeforeFold { beforeFold ->
        Column(beforeFold.fillMaxSize().padding(padding)) {
            Box(
                modifier = Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()),
                contentAlignment = Alignment.TopCenter,
            ) {
                Column(
                    modifier = Modifier.widthIn(max = PAGE_WIDTH).fillMaxWidth().padding(pagePadding()),
                    verticalArrangement = Arrangement.spacedBy(20.dp),
                ) {
                    content()
                }
            }
            if (bottomBar != null) BottomBar(note = note, columnWidth = PAGE_WIDTH, content = bottomBar)
        }
    }
}

@Composable
private fun BarFailure(message: String) {
    Text(text = message, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium)
}

internal val PAGE_WIDTH = 720.dp
