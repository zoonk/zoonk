package com.zoonk.android.feature.tutor

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.LoadState
import com.zoonk.android.feature.memory.MemoryUpdated
import com.zoonk.android.navigation.AppLink
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.richtext.MarkdownText
import kotlinx.coroutines.launch

internal class TutorRoutes(
    val createAccount: () -> Unit,
    val signIn: () -> Unit,
    val seePlus: () -> Unit,
    val open: (AppRoute) -> Unit,
)

@Composable
internal fun TutorThreadView(
    vm: TutorViewModel,
    thread: LoadState<TutorThread>,
    state: TutorConversationState,
    identity: TutorIdentity,
    suggestions: List<TutorSuggestion>,
    routes: TutorRoutes,
    modifier: Modifier = Modifier,
) {
    val coroutines = rememberCoroutineScope()

    Box(modifier.fillMaxSize()) {
        when {
            thread is LoadState.Loaded -> {
                val turns = thread.value.turns
                if (turns.isEmpty() && !thread.value.hasMore) {
                    EmptyThread(identity, suggestions.takeIf { state.limit(turns) == null }.orEmpty(), state.canAsk(turns), vm::send)
                } else {
                    Turns(vm, thread.value, state, identity, routes)
                }
            }

            thread is LoadState.Failed -> {
                val failure = if (thread.error == ApiError.NotFound) TutorFailure.Gone else TutorFailure.Failed
                Column(
                    Modifier.align(Alignment.Center).padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Text(
                        failureMessage(failure),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                    FailureAction(failure, routes, onRetry = { coroutines.launch { vm.thread.refresh() } })
                }
            }

            else -> {
                ConversationLoading()
            }
        }
    }
}

@Composable
private fun Turns(
    vm: TutorViewModel,
    thread: TutorThread,
    state: TutorConversationState,
    identity: TutorIdentity,
    routes: TutorRoutes,
) {
    val list = rememberLazyListState()
    val latest = thread.turns.lastOrNull()?.id
    var shown by rememberSaveable { mutableStateOf<String?>(null) }

    // The latest question comes into view as it's asked, from its top, as main scrolls it.
    LaunchedEffect(latest) {
        if (latest == null || latest == shown) return@LaunchedEffect
        val index = thread.turns.lastIndex + if (thread.hasMore) 1 else 0
        if (shown == null) list.scrollToItem(index) else list.animateScrollToItem(index)
        shown = latest
    }

    LazyColumn(
        state = list,
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(24.dp),
    ) {
        if (thread.hasMore) {
            item(key = "earlier", contentType = "earlier") { EarlierQuestions(state, vm::loadEarlier) }
        }
        items(thread.turns, key = { it.id }, contentType = { "turn" }) { turn ->
            TurnView(turn, vm, state, identity, routes, others = thread.turns.count { it.isInProgress && it.id != turn.id })
        }
    }
}

@Composable
private fun EarlierQuestions(
    state: TutorConversationState,
    onLoad: () -> Unit,
) {
    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (state.earlierFailed) {
            Text(
                text = stringResource(R.string.tutor_load_earlier_failed),
                modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
        FilledTonalButton(onClick = onLoad, enabled = !state.loadingEarlier) {
            if (state.loadingEarlier) {
                CircularProgressIndicator(Modifier.size(ButtonDefaults.IconSize), strokeWidth = 2.dp)
                Spacer(Modifier.size(ButtonDefaults.IconSpacing))
            }
            Text(stringResource(R.string.tutor_load_earlier))
        }
    }
}

@Composable
private fun TurnView(
    turn: TutorTurn,
    vm: TutorViewModel,
    state: TutorConversationState,
    identity: TutorIdentity,
    routes: TutorRoutes,
    others: Int,
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Column(
            Modifier.fillMaxWidth().semantics(mergeDescendants = true) { heading() },
            horizontalAlignment = Alignment.End,
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Text(aboutLabel(turn.about), color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelMedium)
            Surface(
                modifier = Modifier.widthIn(max = BUBBLE_MAX_WIDTH),
                shape = MaterialTheme.shapes.large,
                color = MaterialTheme.colorScheme.surfaceContainerHigh,
            ) {
                Text(turn.question, Modifier.padding(horizontal = 14.dp, vertical = 10.dp), style = MaterialTheme.typography.bodyLarge)
            }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Box(Modifier.size(AVATAR_SIZE)) { TutorAvatar(identity, AVATAR_SIZE) }
            Column(Modifier.weight(1f).padding(top = 4.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                // A finished or failed answer is read out once; while it streams nothing is, word by word.
                val finished = turn.status == TutorTurn.Status.Completed || turn.status == TutorTurn.Status.Failed
                Column(
                    Modifier.semantics { if (finished) liveRegion = LiveRegionMode.Polite },
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Answer(turn, vm, state, routes, others)
                }
                if (turn.answer != null || turn.status != TutorTurn.Status.Running) turn.toolOffer?.let { TutorOffer(it, routes) }
                state.memoryChanges[turn.id]?.let { changes -> MemoryUpdated(changes.map { it.shown }, onUndo = vm::undoMemory) }
            }
        }
    }
}

@Composable
private fun Answer(
    turn: TutorTurn,
    vm: TutorViewModel,
    state: TutorConversationState,
    routes: TutorRoutes,
    others: Int,
) {
    val streaming = state.answeringId == turn.id
    val busy = state.answeringId != null || state.asking
    val failure = state.answerFailures[turn.id]
    val linksChecked = turn.id !in state.streamed

    when {
        turn.status == TutorTurn.Status.Pending && !streaming -> {
            FilledTonalButton(onClick = { vm.retryAnswer(turn.id) }, enabled = !busy && others == 0) {
                Text(stringResource(R.string.tutor_get_answer))
            }
        }

        turn.status == TutorTurn.Status.Failed -> {
            turn.answer?.let { AnswerText(it, linksChecked, routes) }
            if (failure?.helpLimit != null) {
                Text(
                    stringResource(R.string.tutor_not_answered),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
            } else {
                Text(
                    text = if (failure.isGeneric) stringResource(R.string.tutor_answer_failed) else failureMessage(failure),
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodyMedium,
                )
                FailureAction(failure, routes, onRetry = { vm.retryAnswer(turn.id) }, enabled = !busy && others == 0)
            }
        }

        turn.answer != null -> {
            AnswerText(turn.answer, linksChecked, routes)
            if (turn.status == TutorTurn.Status.Running && !streaming) CheckAgain(enabled = !busy && others == 0) { vm.checkAgain(turn.id) }
        }

        turn.status == TutorTurn.Status.Completed -> {
            Text(
                stringResource(R.string.tutor_no_answer),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyLarge,
            )
        }

        else -> {
            Row(
                Modifier.semantics(mergeDescendants = true) { liveRegion = LiveRegionMode.Polite },
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp)
                Text(
                    stringResource(R.string.tutor_thinking),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyLarge,
                )
            }
            if (turn.status == TutorTurn.Status.Running && !streaming) CheckAgain(enabled = !busy && others == 0) { vm.checkAgain(turn.id) }
        }
    }
}

/** Main names the failure itself only when it's about the session, Plus, a gone lesson or a slow-down. */
private val TutorFailure?.isGeneric: Boolean
    get() = this == null || this == TutorFailure.Failed || this == TutorFailure.Invalid

/** Unchecked links read as their words. A checked one opens Zoonk's page in the app, or a website after asking. */
@Composable
private fun AnswerText(
    answer: String,
    linksChecked: Boolean,
    routes: TutorRoutes,
) {
    var asked by remember { mutableStateOf<String?>(null) }
    val open: (String) -> Unit = { url ->
        val route = AppLink.parse(url)
        if (route != null) {
            routes.open(route)
        } else if (url.isWebAddress) {
            asked = url
        }
    }

    MarkdownText(
        markdown = answer,
        onOpenLink = open.takeIf { linksChecked },
        style = MaterialTheme.typography.bodyLarge,
    )

    asked?.let { url -> ExternalLink(url, onDismiss = { asked = null }) }
}

private val String.isWebAddress: Boolean get() = startsWith("https://") || startsWith("http://")

@Composable
private fun ExternalLink(
    url: String,
    onDismiss: () -> Unit,
) {
    val uri = LocalUriHandler.current

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.tutor_link_title)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(stringResource(R.string.tutor_link_description))
                Surface(shape = MaterialTheme.shapes.small, color = MaterialTheme.colorScheme.surfaceContainerHigh) {
                    Text(url, Modifier.padding(12.dp), fontFamily = FontFamily.Monospace, style = MaterialTheme.typography.bodySmall)
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    onDismiss()
                    uri.openUri(url)
                },
            ) { Text(stringResource(R.string.tutor_link_open)) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.tutor_link_cancel)) } },
    )
}

@Composable
private fun CheckAgain(
    enabled: Boolean,
    onClick: () -> Unit,
) {
    FilledTonalButton(onClick = onClick, enabled = enabled) {
        Icon(painterResource(R.drawable.ic_refresh), contentDescription = null, Modifier.size(ButtonDefaults.IconSize))
        Text(stringResource(R.string.tutor_check_again), Modifier.padding(start = ButtonDefaults.IconSpacing))
    }
}

/** Main's error action: sign in again, see Plus, or try again; a help limit or a gone lesson has none. */
@Composable
internal fun FailureAction(
    failure: TutorFailure?,
    routes: TutorRoutes,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    when {
        failure == TutorFailure.SignedOut -> {
            FilledTonalButton(onClick = routes.signIn, modifier = modifier) { Text(stringResource(R.string.tutor_sign_in)) }
        }

        failure == TutorFailure.PlusRequired -> {
            FilledTonalButton(onClick = routes.seePlus, modifier = modifier) { Text(stringResource(R.string.tutor_view_plans)) }
        }

        failure?.helpLimit != null || failure == TutorFailure.Gone -> {}

        else -> {
            FilledTonalButton(onClick = onRetry, modifier = modifier, enabled = enabled) {
                Icon(painterResource(R.drawable.ic_refresh), contentDescription = null, Modifier.size(ButtonDefaults.IconSize))
                Text(stringResource(R.string.tutor_try_again), Modifier.padding(start = ButtonDefaults.IconSpacing))
            }
        }
    }
}

@Composable
private fun EmptyThread(
    identity: TutorIdentity,
    suggestions: List<TutorSuggestion>,
    canAsk: Boolean,
    onSelect: (TutorSuggestion) -> Unit,
) {
    CenteredState {
        TutorAvatar(identity, EMPTY_AVATAR_SIZE)
        Text(stringResource(R.string.tutor_empty_title), textAlign = TextAlign.Center, style = MaterialTheme.typography.titleMedium)
        Text(
            stringResource(R.string.tutor_empty_ai, identity.name),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            style = MaterialTheme.typography.bodyMedium,
        )
        if (suggestions.isNotEmpty()) {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally)) {
                suggestions.forEach { suggestion ->
                    FilledTonalButton(onClick = { onSelect(suggestion) }, enabled = canAsk) { Text(suggestion.label) }
                }
            }
        }
    }
}

/** Who can't ask yet: a guest creates an account, a learner whose session ended signs in again. */
@Composable
internal fun AccountPrompt(
    access: TutorAccess,
    routes: TutorRoutes,
    modifier: Modifier = Modifier,
) {
    val signedOut = access == TutorAccess.SignedOut

    CenteredState(modifier) {
        Icon(painterResource(R.drawable.ic_forum), contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(
            stringResource(if (signedOut) R.string.tutor_error_session else R.string.tutor_guest_title),
            textAlign = TextAlign.Center,
            style = MaterialTheme.typography.titleMedium,
        )
        Button(onClick = if (signedOut) routes.signIn else routes.createAccount) {
            Text(stringResource(if (signedOut) R.string.tutor_sign_in else R.string.limit_create_account))
        }
    }
}

/** Scrolls when it doesn't fit, as at twice the font size or with the keyboard open. */
@Composable
private fun CenteredState(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(
        modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterVertically),
        content = content,
    )
}

@Composable
private fun ConversationLoading() {
    val loading = stringResource(R.string.tutor_loading)

    Box(Modifier.fillMaxSize().semantics { contentDescription = loading }, contentAlignment = Alignment.Center) {
        CircularProgressIndicator()
    }
}

private val AVATAR_SIZE = 32.dp
private val EMPTY_AVATAR_SIZE = 48.dp
private val BUBBLE_MAX_WIDTH = 480.dp
