package com.zoonk.android.feature.plan

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleStartEffect
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.repeatOnLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.GenerationKind
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.GenerationWait
import com.zoonk.android.ui.components.GoalBox
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.scaffold.TabRootScaffold
import com.zoonk.api.models.LearnerSummary
import com.zoonk.api.models.LearnerSummaryGoal
import com.zoonk.api.models.Plan
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.time.Duration.Companion.seconds

@Composable
fun PlanScreen(
    app: AppContainer,
    navigator: AppNavigator,
) {
    val summary by app.learnerSummary.summary.collectShown()
    val scope = rememberCoroutineScope()

    TabRootScaffold(app, navigator) { padding ->
        val loaded = summary.value
        val goal = loaded?.planGoal

        when {
            loaded == null && summary is LoadState.Failed -> {
                PlanLoadFailed(padding) { scope.launch { app.learnerSummary.summary.refresh() } }
            }

            loaded == null -> {
                PlanLoading(padding)
            }

            goal == null -> {
                PlanNoGoal(navigator, padding)
            }

            else -> {
                key(goal.id) { GoalPlan(goal, loaded, app, navigator, padding) }
            }
        }
    }
}

@Composable
private fun GoalPlan(
    goal: LearnerSummaryGoal,
    summary: LearnerSummary,
    app: AppContainer,
    navigator: AppNavigator,
    padding: PaddingValues,
) {
    val resource = app.plans.plan[goal.id]
    val state by resource.collectShown()
    val scope = rememberCoroutineScope()
    val read = state.value
    val courseSetup = if (goal.courseId != null) setupLeft(app, goal, course = true) else SetupLeft.No

    when {
        courseSetup == SetupLeft.Unknown -> {
            SetupLoading(app, goal, padding)
        }

        courseSetup == SetupLeft.Yes -> {
            PlanStateColumn(padding) { PlanSetupLeft(goal, navigator) }
        }

        read != null && read.plan.ready -> {
            ReadyPlan(goal, summary, read.plan, app, navigator, padding)
        }

        state is LoadState.Loaded || state is LoadState.Empty || (state as? LoadState.Failed)?.error == ApiError.NotFound -> {
            PlanWithoutPlan(goal, app, navigator, padding, onRefresh = { resource.refresh() })
        }

        state is LoadState.Failed -> {
            PlanLoadFailed(padding) { scope.launch { resource.refresh() } }
        }

        else -> {
            PlanLoading(padding)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ReadyPlan(
    goal: LearnerSummaryGoal,
    summary: LearnerSummary,
    plan: Plan,
    app: AppContainer,
    navigator: AppNavigator,
    padding: PaddingValues,
) {
    val resource = app.plans.plan[goal.id]
    val refreshing by resource.isRefreshing.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()
    val viewModel = viewModel(key = "plan-${goal.id}") { PlanViewModel(app.plans, goal.id) }

    WhileShown(plan.isPhaseBeingWritten) {
        while (true) {
            delay(WRITING_REFRESH)
            app.plans.refreshIfChanged(goal.id)
        }
    }

    PullToRefreshBox(
        isRefreshing = refreshing,
        onRefresh = { scope.launch { resource.refresh() } },
        modifier = Modifier.fillMaxSize().padding(padding),
    ) {
        PlanPage(page = PlanPageState(goal, plan, summary), app = app, navigator = navigator, viewModel = viewModel)
    }
}

private enum class SetupLeft { Yes, No, Unknown }

@Composable
private fun setupLeft(
    app: AppContainer,
    goal: LearnerSummaryGoal,
    course: Boolean = false,
): SetupLeft {
    val setup by app.plans.setup[goal.id].collectShown()
    val loaded = setup.value ?: return if (setup is LoadState.Empty) SetupLeft.No else SetupLeft.Unknown
    val left = if (course) loaded.courseSetupLeft else loaded.questionsLeft
    return if (left) SetupLeft.Yes else SetupLeft.No
}

@Composable
private fun SetupLoading(
    app: AppContainer,
    goal: LearnerSummaryGoal,
    padding: PaddingValues,
) {
    val setup by app.plans.setup[goal.id].collectShown()
    val scope = rememberCoroutineScope()
    if (setup is LoadState.Failed) {
        PlanLoadFailed(padding) { scope.launch { app.plans.setup[goal.id].refresh() } }
    } else {
        PlanLoading(padding)
    }
}

@Composable
private fun PlanWithoutPlan(
    goal: LearnerSummaryGoal,
    app: AppContainer,
    navigator: AppNavigator,
    padding: PaddingValues,
    onRefresh: suspend () -> Unit,
) {
    when (setupLeft(app, goal)) {
        SetupLeft.Yes -> PlanStateColumn(padding) { PlanSetupLeft(goal, navigator) }
        SetupLeft.No -> PlanStateColumn(padding) { PlanBuilding(goal, app, onRefresh) }
        SetupLeft.Unknown -> SetupLoading(app, goal, padding)
    }
}

@Composable
private fun PlanSetupLeft(
    goal: LearnerSummaryGoal,
    navigator: AppNavigator,
) {
    Text(text = goal.title, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
    PlanTitle()
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            text = stringResource(R.string.plan_setup_left_title),
            modifier = Modifier.semantics { heading() },
            style = MaterialTheme.typography.titleMedium,
        )
        Text(
            text = stringResource(R.string.plan_setup_left_description),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Button(onClick = { navigator.open(AppRoute.GoalSetup(goal.id.toString())) }, modifier = Modifier.padding(top = 8.dp)) {
            Text(stringResource(R.string.plan_continue))
        }
    }
}

/**
 * The planner is building the plan: main's `JourneyBuilding`, which follows the run and reads the
 * plan again until it shows. It follows only while the Plan shows, and only for the session that
 * started it.
 */
@Composable
private fun PlanBuilding(
    goal: LearnerSummaryGoal,
    app: AppContainer,
    onRefresh: suspend () -> Unit,
) {
    val session = app.sessions.current ?: return
    val viewModel =
        viewModel(key = "plan-building-${goal.id}-${session.localId}") { PlanBuildingViewModel(app.plans, app.api, session, goal.id) }
    val run by viewModel.follower.run.collectAsStateWithLifecycle()
    val ready = run.status == GenerationRun.Status.Ready

    LifecycleStartEffect(viewModel) {
        if (viewModel.follower.run.value.status != GenerationRun.Status.Ready) viewModel.follower.follow(null)
        onStopOrDispose { viewModel.follower.stop() }
    }
    WhileShown(true, ready) {
        while (true) {
            delay(if (ready) READY_REFRESH else FALLBACK_REFRESH)
            onRefresh()
        }
    }

    GenerationWait(
        kind = GenerationKind.Curriculum,
        run = run,
        onRetry = viewModel.follower::retry,
    ) {
        Text(
            text = stringResource(R.string.plan_building_eyebrow, goal.title),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        PlanTitle()
        Text(
            text = stringResource(R.string.plan_building_description),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

private val READY_REFRESH = 2.seconds
private val FALLBACK_REFRESH = 20.seconds
private val WRITING_REFRESH = 10.seconds

/** Runs [block] while the screen is started and [active], restarting it when [key] changes. */
@Composable
private fun WhileShown(
    active: Boolean,
    key: Any? = null,
    block: suspend () -> Unit,
) {
    if (!active) return
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    LaunchedEffect(lifecycle, key) {
        lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) { block() }
    }
}

@Composable
private fun PlanLoadFailed(
    padding: PaddingValues,
    onRetry: () -> Unit,
) {
    Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
        LoadFailedMessage(onRetry = onRetry)
    }
}

/** A quick explanation has no plan, so the Plan offers to start a goal. */
@Composable
private fun PlanNoGoal(
    navigator: AppNavigator,
    padding: PaddingValues,
) {
    var words by rememberSaveable { mutableStateOf("") }

    PlanStateColumn(padding) {
        PlanTitle()
        Text(
            text = stringResource(R.string.plan_no_goal_description),
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        GoalBox(
            value = words,
            onValueChange = { words = it },
            onSubmit = { navigator.open(AppRoute.StartGoal(goal = it)) },
            modifier = Modifier.padding(top = 16.dp),
        )
    }
}

@Composable
private fun PlanStateColumn(
    padding: PaddingValues,
    content: @Composable () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 8.dp)
                .widthIn(max = 672.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        content()
    }
}

@Composable
internal fun PlanTitle(modifier: Modifier = Modifier) {
    Text(
        text = stringResource(R.string.plan_title),
        modifier = modifier.semantics { heading() },
        style = MaterialTheme.typography.headlineMedium,
    )
}

@Composable
private fun PlanLoading(padding: PaddingValues) {
    Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
        CircularProgressIndicator()
    }
}
