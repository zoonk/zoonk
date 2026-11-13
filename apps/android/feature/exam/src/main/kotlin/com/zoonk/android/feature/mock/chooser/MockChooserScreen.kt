package com.zoonk.android.feature.mock.chooser

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.lifecycle.compose.LifecycleStartEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
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
import com.zoonk.android.ui.components.PageLoading
import com.zoonk.android.ui.components.rememberPressFocus
import com.zoonk.android.ui.scaffold.PageScaffold
import com.zoonk.api.models.MockOptions
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
        key(goalId) { MockChooser(goalId, app, navigator) }
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
            Leave(ChooserExit.Away, navigator)
        }

        else -> {
            ChooserFrame(navigator) { PageLoading() }
        }
    }
}

@Composable
internal fun MockChooser(
    goalId: UUID,
    app: AppContainer,
    navigator: AppNavigator,
    mockStore: MockStore = app.mocks,
    starter: MockStarter = app.mockStarter,
    generations: (AuthenticatedSession?) -> GenerationSource = { LiveGenerationSource(app.api, it) },
) {
    val options = mockStore.options[goalId]
    val state by options.collectShown()
    val viewModel = viewModel(key = "mock-chooser-$goalId") { MockChooserViewModel(goalId, starter, app.sessions, generations) }
    val opened by viewModel.opened.collectAsStateWithLifecycle()
    val status by viewModel.status.collectAsStateWithLifecycle()
    val run by viewModel.run.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()
    val listState = rememberLazyListState()
    val loaded = state.value
    val exit = opened?.let(ChooserExit::ToMock) ?: chooserExit(state)
    val writing = status == ChooserStatus.Writing
    val focus =
        rememberPressFocus(
            when {
                loaded == null -> null
                writing -> "wait"
                else -> "start"
            },
            // On a phone the action is in the list's first row, which can be scrolled away.
            reveal = { listState.scrollToItem(0) },
        )
    val retry = {
        focus.pressInHolder()
        viewModel.retry()
    }

    LifecycleStartEffect(viewModel) {
        viewModel.onShown(true)
        onStopOrDispose { viewModel.onShown(false) }
    }

    if (exit != null) {
        Leave(exit, navigator)
        return
    }

    ChooserFrame(navigator, title = loaded?.let { stringResource(R.string.mock_chooser_title) }) {
        when {
            loaded == null && state is LoadState.Failed -> LoadFailedMessage(onRetry = { scope.launch { options.refresh() } })
            loaded == null -> PageLoading()
            writing -> MockWriting(run, onRetry = retry, titleFocus = focus.requester)
            else -> PracticeChooser(loaded, viewModel, navigator, listState, focus.requester, focus::press)
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

    /** Not an exam: to Today. */
    data object Away : ChooserExit
}

private fun chooserExit(state: LoadState<MockOptions>): ChooserExit? {
    val options = state.value
    return when {
        options == null -> ChooserExit.Away.takeIf { state is LoadState.Empty || (state as? LoadState.Failed)?.error == ApiError.NotFound }
        else -> options.running?.let { ChooserExit.ToMock(it.id.toString()) } ?: ChooserExit.ToExam.takeIf { options.options.isEmpty() }
    }
}

/** The chooser was only a way there, so it goes from the back stack as main's redirect does. */
@Composable
private fun Leave(
    exit: ChooserExit,
    navigator: AppNavigator,
) {
    ChooserFrame(navigator) { PageLoading() }
    LaunchedEffect(exit) {
        navigator.back()
        when (exit) {
            is ChooserExit.ToMock -> navigator.open(AppRoute.Mock(exit.id))
            ChooserExit.ToExam -> navigator.open(AppRoute.Exam)
            ChooserExit.Away -> navigator.showRoot(AppTab.Today)
        }
    }
}

@Composable
private fun ChooserFrame(
    navigator: AppNavigator,
    title: String? = null,
    content: @Composable () -> Unit,
) {
    PageScaffold(
        onBack = { navigator.back() },
        title = { title?.let { Text(it, maxLines = 1, overflow = TextOverflow.Ellipsis) } },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) { content() }
    }
}
