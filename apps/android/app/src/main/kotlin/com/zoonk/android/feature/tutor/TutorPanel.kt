package com.zoonk.android.feature.tutor

import androidx.annotation.StringRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.isImeVisible
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.SuggestionChip
import androidx.compose.material3.Text
import androidx.compose.material3.adaptive.currentWindowAdaptiveInfoV2
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
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
import com.zoonk.android.data.LoadState
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
    val summary by app.learnerSummary.summary.collectShown()
    val activeGoalId = summary.value?.activeGoalId?.toString()
    val vm = viewModel(key = "tutor:${scope.thread}:$account") { TutorViewModel(scope, app.tutor) }
    SideEffect {
        vm.scope = scope
        vm.activeGoalId = activeGoalId
    }
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

/**
 * The conversation as a page of its own, as main's `TutorConversation` on the buddy tab: the
 * buddy's hello opens it and its suggestions wait above the composer until the first question.
 * [onAsked] and [onAnswered] fire for questions asked and answered while it shows.
 */
@Immutable
internal class TutorPage(
    val greeting: String,
    val suggestions: List<TutorSuggestion>,
    val placeholder: String,
    val greetingAction: (@Composable () -> Unit)? = null,
    val onAsked: () -> Unit = {},
    val onAnswered: () -> Unit = {},
    val composerFocus: FocusRequester? = null,
)

@Composable
internal fun TutorPanel(
    vm: TutorViewModel,
    access: TutorAccess,
    identity: TutorIdentity,
    routes: TutorRoutes,
    modifier: Modifier = Modifier,
    lessonSuggestions: List<TutorSuggestion> = emptyList(),
    page: TutorPage? = null,
) {
    val suggestions = page?.suggestions ?: tutorSuggestions(vm.scope, lessonSuggestions)
    val composerPadding = Modifier.padding(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 16.dp)

    Column(modifier) {
        if (access != TutorAccess.Ask && page != null) {
            TutorThreadView(
                vm,
                LoadState.Loaded(TutorThread.Empty),
                TutorConversationState(),
                identity,
                suggestions,
                routes,
                Modifier.weight(1f),
                page,
            )
            PageAccountPrompt(routes, composerPadding)
            return@Column
        }
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

        TutorThreadView(vm, thread, state, identity, suggestions, routes, Modifier.weight(1f), page)
        if (page != null) {
            TurnSignals(turns, page)
            val empty = turns?.isEmpty() == true && thread.value?.hasMore == false
            if (empty && state.limit(turns.orEmpty()) == null) {
                SuggestionChips(
                    suggestions,
                    enabled = state.canAsk(turns.orEmpty()),
                    onSend = vm::send,
                    Modifier.padding(horizontal = 12.dp),
                )
            }
        }
        TutorComposer(
            vm,
            turns,
            state,
            routes,
            composerPadding,
            placeholder = page?.placeholder ?: placeholderLabel(vm.scope),
            focus = page?.composerFocus ?: remember { FocusRequester() },
        )
    }
}

@Composable
private fun SuggestionChips(
    suggestions: List<TutorSuggestion>,
    enabled: Boolean,
    onSend: (TutorSuggestion) -> Unit,
    modifier: Modifier = Modifier,
) {
    FlowRow(modifier, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        suggestions.forEach { suggestion ->
            SuggestionChip(onClick = { onSend(suggestion) }, label = { Text(suggestion.label) }, enabled = enabled)
        }
    }
}

/** Guests see the buddy's hello; talking takes an account, which the conversation would start. */
@Composable
private fun PageAccountPrompt(
    routes: TutorRoutes,
    modifier: Modifier = Modifier,
) {
    OutlinedCard(modifier.fillMaxWidth()) {
        Row(
            Modifier.padding(start = 16.dp, end = 8.dp, top = 8.dp, bottom = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                stringResource(R.string.tutor_page_sign_up),
                Modifier.weight(1f),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
            Button(onClick = routes.createAccount) { Text(stringResource(R.string.limit_create_account)) }
        }
    }
}

/** Main's turn signals: a question asked here, then its answer finishing, once each; none for what was already there. */
@Composable
private fun TurnSignals(
    turns: List<TutorTurn>?,
    page: TutorPage,
) {
    val seen = remember { TurnsSeen() }
    val onAsked by rememberUpdatedState(page.onAsked)
    val onAnswered by rememberUpdatedState(page.onAnswered)

    LaunchedEffect(turns) { turns?.let { seen.check(it, onAsked, onAnswered) } }
}

internal class TurnsSeen {
    private var known: MutableSet<String>? = null
    private val waiting = mutableSetOf<String>()

    fun check(
        turns: List<TutorTurn>,
        onAsked: () -> Unit,
        onAnswered: () -> Unit,
    ) {
        val opening = known == null
        val seen = known ?: mutableSetOf<String>().also { known = it }
        turns.forEach { turn ->
            val isNew = seen.add(turn.id)
            if (turn.isInProgress) {
                if (isNew && !opening) onAsked()
                waiting += turn.id
            } else if (waiting.remove(turn.id) && turn.status == TutorTurn.Status.Completed) {
                onAnswered()
            }
        }
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
    lessonSuggestions: List<TutorSuggestion> = emptyList(),
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
            startCall = app.conversations::start,
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
            TutorPanel(rememberTutor(scope, app), rememberTutorAccess(app), identity, routes, Modifier.weight(1f), lessonSuggestions)
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
