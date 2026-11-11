package com.zoonk.android.feature.focustest

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.onboarding.WriteOutcome
import com.zoonk.android.feature.onboarding.setup.SetupColumn
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.components.Meter
import com.zoonk.android.ui.components.PageLoading
import com.zoonk.android.ui.scaffold.TaskScaffold
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
    val summary by app.learnerSummary.summary.collectShown()
    val goal = summary.value?.goals?.firstOrNull { goal -> route.goalId?.let { goal.id.toString() == it } ?: goal.isActive }
    var progress by remember { mutableStateOf<Float?>(null) }
    val scope = rememberCoroutineScope()

    TaskScaffold(
        onClose = navigator::closeTask,
        title = {
            progress?.let {
                Meter(
                    share = it,
                    modifier = Modifier.width(METER_WIDTH),
                    color = MaterialTheme.colorScheme.primary,
                    contentDescription = stringResource(R.string.onboarding_placement_progress),
                )
            } ?: Text(stringResource(R.string.focustest_title))
        },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding).consumeWindowInsets(padding)) {
            when {
                goal?.kind == LearnerSummaryGoal.Kind.EXAM -> {
                    SetupColumn {
                        FocusTestFlow(
                            goalId = goal.id.toString(),
                            host = FocusTestHost.Plan,
                            subject = goal.displayName,
                            store = app.onboarding,
                            plans = app.plans,
                            run = remember { GenerationRun() },
                            onRetryRun = null,
                            onProgress = { progress = it },
                            onDone = {
                                navigator.closeTask()
                                WriteOutcome.Done(Unit)
                            },
                            onChangeFocus = {
                                navigator.closeTask()
                                navigator.open(AppRoute.Plan(focus = CHOOSE_FOCUS))
                            },
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
                    LoadFailedMessage(onRetry = { scope.launch { app.learnerSummary.summary.refresh() } })
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

private val METER_WIDTH = 96.dp
