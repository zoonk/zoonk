package com.zoonk.android.feature.tutor

import androidx.annotation.StringRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.isImeVisible
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.adaptive.currentWindowAdaptiveInfoV2
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.repeatOnLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.window.core.layout.WindowSizeClass
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.SessionState
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import kotlinx.coroutines.launch

/**
 * The conversation about [scope], kept by the screen showing it so a draft or an answer survives
 * closing it; each account gets its own.
 */
@Composable
internal fun rememberTutor(
    scope: TutorScope,
    app: AppContainer,
): TutorViewModel {
    val session by app.sessions.state.collectAsStateWithLifecycle()
    val account = (session as? SessionState.SignedIn)?.session?.localId
    val vm = viewModel(key = "tutor:${scope.thread}:$account") { TutorViewModel(scope, app.tutor) }
    SideEffect { vm.scope = scope }
    return vm
}

/** Visitors and guests are asked to create an account: the tutor isn't part of a guest's allowance. */
internal enum class TutorAccess { Ask, Guest, SignedOut }

@Composable
internal fun rememberTutorAccess(app: AppContainer): TutorAccess {
    val session by app.sessions.state.collectAsStateWithLifecycle()
    return when (val current = session) {
        is SessionState.SignedIn -> if (current.isGuest) TutorAccess.Guest else TutorAccess.Ask
        is SessionState.SignedOut -> if (current.sessionEnded) TutorAccess.SignedOut else TutorAccess.Guest
        SessionState.Restoring, SessionState.Unavailable -> TutorAccess.Guest
    }
}

@Composable
internal fun TutorPanel(
    vm: TutorViewModel,
    access: TutorAccess,
    identity: TutorIdentity,
    routes: TutorRoutes,
    modifier: Modifier = Modifier,
    lessonSuggestions: List<TutorSuggestion> = emptyList(),
) {
    val suggestions = tutorSuggestions(vm.scope, lessonSuggestions)

    Column(modifier) {
        if (access != TutorAccess.Ask) {
            AccountPrompt(access, routes, Modifier.weight(1f))
            return@Column
        }

        val thread by vm.thread.collectShown()
        val state by vm.state.collectAsStateWithLifecycle()
        val turns = thread.value?.turns
        val remote = turns?.let(state::remote)

        if (remote != null) {
            val lifecycle = LocalLifecycleOwner.current.lifecycle
            LaunchedEffect(remote) { lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) { vm.followRemote(remote) } }
        }

        TutorThreadView(vm, thread, state, identity, suggestions, routes, Modifier.weight(1f))
        TutorComposer(vm, turns, state, routes, Modifier.padding(start = 12.dp, end = 12.dp, top = 8.dp, bottom = 16.dp))
    }
}

/** Main's drawer: on every window the conversation opens from the screen it's about. */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
internal fun TutorSheet(
    scope: TutorScope,
    app: AppContainer,
    navigator: AppNavigator,
    identity: TutorIdentity,
    onDismiss: () -> Unit,
) {
    val sheet = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val coroutines = rememberCoroutineScope()
    val close: () -> Unit = { coroutines.launch { sheet.hide() }.invokeOnCompletion { onDismiss() } }
    val open: (AppRoute) -> Unit = { route ->
        onDismiss()
        navigator.open(route)
    }
    val routes =
        TutorRoutes(
            createAccount = { open(AppRoute.Login) },
            signIn = { open(AppRoute.Login) },
            seePlus = { open(AppRoute.Subscription) },
            open = open,
        )
    val tall = currentWindowAdaptiveInfoV2().windowSizeClass.isHeightAtLeastBreakpoint(WindowSizeClass.HEIGHT_DP_MEDIUM_LOWER_BOUND)
    // The sheet already sits above the keyboard, so typing takes all the height that's left.
    val share = if (tall && !WindowInsets.isImeVisible) SHEET_SHARE else 1f

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheet) {
        Column(Modifier.fillMaxHeight(share).semantics { paneTitle = identity.name }) {
            Row(
                Modifier.padding(start = 16.dp, end = 4.dp, bottom = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                TutorAvatar(identity, HEADER_AVATAR_SIZE)
                Column(Modifier.weight(1f)) {
                    Text(
                        text = identity.name,
                        modifier = Modifier.semantics { heading() },
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        style = MaterialTheme.typography.titleMedium,
                    )
                    Text(
                        descriptionLabel(scope),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
                IconButton(onClick = close) {
                    Icon(painterResource(R.drawable.ic_close), contentDescription = stringResource(R.string.tutor_close))
                }
            }
            HorizontalDivider()
            TutorPanel(rememberTutor(scope, app), rememberTutorAccess(app), identity, routes, Modifier.weight(1f))
        }
    }
}

@Composable
private fun tutorSuggestions(
    scope: TutorScope,
    lessonSuggestions: List<TutorSuggestion>,
): List<TutorSuggestion> =
    when (scope) {
        is TutorScope.Answer -> {
            listOf(suggestion(R.string.tutor_suggest_walk_through)) + lessonSuggestions.filter { it.id == "simpler" }
        }

        is TutorScope.Chapter -> {
            listOf(suggestion(R.string.tutor_suggest_chapter))
        }

        is TutorScope.Lesson, is TutorScope.Step -> {
            lessonSuggestions
        }

        is TutorScope.Mock -> {
            listOf(suggestion(R.string.tutor_suggest_mock_practice), suggestion(R.string.tutor_suggest_mock_missed))
        }

        is TutorScope.Plan -> {
            listOf(suggestion(R.string.tutor_suggest_plan_today), suggestion(R.string.tutor_suggest_plan_next))
        }

        is TutorScope.Subject -> {
            listOf(suggestion(R.string.tutor_suggest_subject_left), suggestion(R.string.tutor_suggest_subject_cover))
        }

        is TutorScope.Item -> {
            listOf(
                suggestion(if (scope.answered) R.string.tutor_suggest_walk_through else R.string.tutor_suggest_item_asking),
                suggestion(R.string.tutor_suggest_item_idea),
            )
        }
    }

@Composable
private fun suggestion(
    @StringRes label: Int,
) = TutorSuggestion(stringResource(label))

private const val SHEET_SHARE = 0.7f
private val HEADER_AVATAR_SIZE = 28.dp
