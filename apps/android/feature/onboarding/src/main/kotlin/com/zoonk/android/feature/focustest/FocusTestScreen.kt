package com.zoonk.android.feature.focustest

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.LocalEventTracker
import com.zoonk.android.data.Resource
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.setup.SetupColumn
import com.zoonk.android.feature.onboarding.setup.TestProgress
import com.zoonk.android.feature.placementtest.Sitting
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.ui.VisitOf
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.components.PageLoading
import com.zoonk.android.ui.scaffold.TaskScaffold
import com.zoonk.api.models.LearnerSummary
import com.zoonk.api.models.LearnerSummaryGoal
import kotlinx.coroutines.launch

/**
 * `/focus-test`: an exam goal's Focus test opened from its plan, Today, the reveal or a link. A goal
 * named in the route is the one being set up; otherwise it's the goal in the switcher. Other goals
 * have none, so they go to the plan, as main redirects.
 */
@Composable
fun FocusTestScreen(
    route: AppRoute.FocusTest,
    app: AppContainer,
    navigator: AppNavigator,
) {
    FocusTestScreen(route, app.learnerSummary.summary, app.onboarding, app.plans, app.focusTests, navigator)
}

@Composable
internal fun FocusTestScreen(
    route: AppRoute.FocusTest,
    summaries: Resource<LearnerSummary>,
    store: OnboardingStore,
    plans: PlanStore,
    focusTests: FocusTestStore,
    navigator: AppNavigator,
) {
    val summary by summaries.collectShown()
    val goal = summary.value?.goals?.firstOrNull { goal -> route.goalId?.let { goal.id.toString() == it } ?: goal.isActive }
    var sitting by remember { mutableStateOf<Sitting?>(null) }
    val scope = rememberCoroutineScope()
    val tracker = LocalEventTracker.current

    // The screens name the test above their headlines; the bar shows the questions' progress.
    TaskScaffold(
        onClose = {
            sitting?.let { tracker.track(it.left) }
            navigator.closeTask()
        },
        title = { sitting?.let { TestProgress(it.share) } },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding).consumeWindowInsets(padding)) {
            when {
                goal?.kind == LearnerSummaryGoal.Kind.EXAM -> {
                    val questions = viewModel(key = "focus-test-questions:${goal.id}") { SessionQuestionsModel(focusTests, goal.id) }
                    VisitOf(questions.visit)
                    SetupColumn {
                        FocusTestFlow(
                            goalId = goal.id.toString(),
                            subject = goal.displayName,
                            store = store,
                            plans = plans,
                            run = remember { GenerationRun() },
                            onRetryRun = null,
                            onSitting = { sitting = it },
                            onLeft = navigator::closeTask,
                            plan =
                                OnPlan(
                                    onChangeFocus = {
                                        navigator.closeTask()
                                        navigator.open(AppRoute.Plan(focus = CHOOSE_FOCUS))
                                    },
                                    questions = questions,
                                    startOnOpen = route.start,
                                ),
                        )
                    }
                }

                // Only an exam goal has the test; any other chooses its focus on the plan.
                goal != null -> {
                    LaunchedEffect(goal.id) {
                        navigator.closeTask()
                        navigator.open(AppRoute.Plan(focus = CHOOSE_FOCUS))
                    }
                    PageLoading()
                }

                summary is LoadState.Failed -> {
                    LoadFailedMessage(onRetry = { scope.launch { summaries.refresh() } })
                }

                summary is LoadState.Loaded || summary == LoadState.Empty -> {
                    LaunchedEffect(Unit) { navigator.showRoot(AppTab.Today) }
                    PageLoading()
                }

                else -> {
                    PageLoading()
                }
            }
        }
    }
}

/** The plan's `?focus=choose`: its focus sheet open. */
private const val CHOOSE_FOCUS = "choose"
