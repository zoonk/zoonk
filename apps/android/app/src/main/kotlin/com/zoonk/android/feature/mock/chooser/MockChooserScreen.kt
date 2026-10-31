package com.zoonk.android.feature.mock.chooser

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.lifecycle.compose.LifecycleStartEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.GenerationSource
import com.zoonk.android.data.LiveGenerationSource
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.mock.MockStore
import com.zoonk.android.feature.plan.planGoal
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.scaffold.PageScaffold
import com.zoonk.api.models.MockOptions
import com.zoonk.api.models.MockOptionsPlacementMock
import kotlinx.coroutines.launch
import java.util.UUID

/** Main's `/mock/new`: a mock of the goal in the switcher, any time. */
@Composable
fun MockChooserScreen(
    app: AppContainer,
    navigator: AppNavigator,
) {
    val summary by app.learnerSummary.summary.collectShown()
    val goalId = summary.value?.planGoal?.id

    if (goalId != null) {
        key(goalId) { MockChooser(goalId, placement = false, app, navigator) }
        return
    }

    val scope = rememberCoroutineScope()
    when (summary) {
        is LoadState.Failed -> {
            ChooserFrame(
                navigator,
            ) { LoadFailedMessage(onRetry = { scope.launch { app.learnerSummary.summary.refresh() } }) }
        }

        is LoadState.Loaded, LoadState.Empty -> {
            Leave(ChooserExit.Away(placementGoal = null), navigator)
        }

        else -> {
            ChooserFrame(navigator) { ChooserLoading() }
        }
    }
}

/** Main's `/mock/placement/{goalId}`: onboarding's mock, which sets where the plan starts. */
@Composable
fun PlacementMockScreen(
    route: AppRoute.PlacementMock,
    app: AppContainer,
    navigator: AppNavigator,
) {
    val goalId = remember(route.goalId) { runCatching { UUID.fromString(route.goalId) }.getOrNull() }

    if (goalId == null) {
        Leave(ChooserExit.Away(placementGoal = route.goalId), navigator)
    } else {
        MockChooser(goalId, placement = true, app, navigator)
    }
}

@Composable
internal fun MockChooser(
    goalId: UUID,
    placement: Boolean,
    app: AppContainer,
    navigator: AppNavigator,
    mockStore: MockStore = app.mocks,
    starter: MockStarter = app.mockStarter,
    generations: (AuthenticatedSession?) -> GenerationSource = { LiveGenerationSource(app.api, it) },
) {
    val options = mockStore.options[goalId]
    val state by options.collectShown()
    val viewModel = viewModel(key = "mock-chooser-$goalId-$placement") { MockChooserViewModel(goalId, starter, app.sessions, generations) }
    val opened by viewModel.opened.collectAsStateWithLifecycle()
    val status by viewModel.status.collectAsStateWithLifecycle()
    val run by viewModel.run.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()
    val listState = rememberLazyListState()
    val loaded = state.value
    val exit = opened?.let(ChooserExit::ToMock) ?: chooserExit(state, placement, goalId)

    LifecycleStartEffect(viewModel) {
        viewModel.onShown(true)
        onStopOrDispose { viewModel.onShown(false) }
    }

    if (exit != null) {
        Leave(exit, navigator)
        return
    }

    ChooserFrame(navigator, title = loaded?.let { chooserTitle(placement) }, listState = listState) {
        when {
            loaded == null && state is LoadState.Failed -> LoadFailedMessage(onRetry = { scope.launch { options.refresh() } })
            loaded == null -> ChooserLoading()
            status == ChooserStatus.Writing -> MockWriting(run, onRetry = viewModel::retry)
            placement -> PlacementChooser(loaded, viewModel, navigator, listState)
            else -> PracticeChooser(loaded, viewModel, navigator, listState)
        }
    }
}

/** Where main redirects instead of showing the chooser. */
internal sealed interface ChooserExit {
    data class ToMock(
        val id: String,
    ) : ChooserExit

    /** The goal has no mocks to take now. */
    data object ToExam : ChooserExit

    /** Not an exam, or no placement mock to take: to Today, or back to onboarding. */
    data class Away(
        val placementGoal: String?,
    ) : ChooserExit
}

private fun chooserExit(
    state: LoadState<MockOptions>,
    placement: Boolean,
    goalId: UUID,
): ChooserExit? {
    val away = ChooserExit.Away(placementGoal = goalId.toString().takeIf { placement })
    val options = state.value
    return when {
        options == null -> away.takeIf { state is LoadState.Empty || (state as? LoadState.Failed)?.error == ApiError.NotFound }
        placement -> placementExit(options, away)
        else -> options.running?.let { ChooserExit.ToMock(it.id.toString()) } ?: ChooserExit.ToExam.takeIf { options.options.isEmpty() }
    }
}

private fun placementExit(
    options: MockOptions,
    away: ChooserExit,
): ChooserExit? {
    val placement = options.placement ?: return away
    val mock = placement.mock ?: return null
    return if (mock.status == MockOptionsPlacementMock.Status.FINISHED) away else ChooserExit.ToMock(mock.id.toString())
}

/** The chooser was only a way there, so it goes from the back stack as main's redirect does. */
@Composable
private fun Leave(
    exit: ChooserExit,
    navigator: AppNavigator,
) {
    ChooserFrame(navigator) { ChooserLoading() }
    LaunchedEffect(exit) {
        navigator.back()
        when (exit) {
            is ChooserExit.ToMock -> navigator.open(AppRoute.Mock(exit.id))
            ChooserExit.ToExam -> navigator.open(AppRoute.Exam)
            is ChooserExit.Away -> exit.placementGoal?.let { navigator.open(AppRoute.GoalSetup(it)) } ?: navigator.showRoot(AppTab.Today)
        }
    }
}

@Composable
private fun ChooserFrame(
    navigator: AppNavigator,
    title: String? = null,
    listState: LazyListState? = null,
    content: @Composable () -> Unit,
) {
    val headlineScrolledAway by remember(listState) { derivedStateOf { (listState?.firstVisibleItemIndex ?: 0) > 0 } }

    PageScaffold(
        onBack = { navigator.back() },
        title = { title?.takeIf { headlineScrolledAway }?.let { Text(it, maxLines = 1, overflow = TextOverflow.Ellipsis) } },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) { content() }
    }
}

@Composable
private fun ChooserLoading() {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
}
