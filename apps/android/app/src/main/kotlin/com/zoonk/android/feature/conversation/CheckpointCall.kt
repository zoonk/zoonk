package com.zoonk.android.feature.conversation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.GenerationFailure
import com.zoonk.android.data.GenerationKind
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.StepState
import com.zoonk.android.data.collectShown
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.ui.components.GenerationWait
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.api.models.LanguageCheckpointCall
import com.zoonk.api.models.LanguageCheckpointCallIntro
import kotlinx.coroutines.launch
import java.util.UUID

/** The call a checkpoint opened, with the microphone answer from its Start; null when it opens on its own intro. */
data class OpenedCall(
    val conversationId: UUID,
    val startWith: Boolean?,
)

/** A language checkpoint's start, from the learner's tap. */
class CheckpointCallModel(
    private val blockId: UUID,
    private val store: ConversationStore,
) : ViewModel() {
    enum class Start { Idle, Starting, Failed, PlusRequired }

    val call = store.checkpointCall(blockId)

    var start by mutableStateOf(Start.Idle)
        private set

    var opened by mutableStateOf<OpenedCall?>(null)
        private set

    /** [microphone] is the learner's answer on the intro's Start; a call being prepared opens on its own intro. */
    fun start(microphone: Boolean?) {
        start = Start.Starting
        viewModelScope.launch {
            start =
                when (val started = store.startCheckpoint(blockId)) {
                    is CheckpointStart.Started -> {
                        opened = OpenedCall(started.conversationId, microphone)
                        Start.Idle
                    }

                    CheckpointStart.PlusRequired -> {
                        Start.PlusRequired
                    }

                    CheckpointStart.Changed -> {
                        call.refresh()
                        Start.Idle
                    }

                    CheckpointStart.Failed -> {
                        Start.Failed
                    }
                }
        }
    }
}

/**
 * `/checkpoint/{blockId}` on a language goal (main's checkpoint page): the unit's challenge is a
 * call. [otherwise] is the checkpoint's own screen when it isn't a call (the duel, or Plus's
 * challenge without one).
 */
@Composable
fun LanguageCheckpointCall(
    route: AppRoute.Checkpoint,
    app: AppContainer,
    navigator: AppNavigator,
    otherwise: @Composable () -> Unit,
) {
    val blockId = remember(route.blockId) { runCatching { UUID.fromString(route.blockId) }.getOrNull() }
    if (blockId == null) {
        otherwise()
        return
    }
    val model = viewModel(key = "checkpoint-call:$blockId") { CheckpointCallModel(blockId, app.conversations) }
    val exits =
        remember(navigator) {
            object : ConversationExits {
                override fun close() = navigator.closeTask()

                override fun open(route: AppRoute) = navigator.open(route)
            }
        }

    CheckpointCallContent(
        model = model,
        exits = exits,
        onToday = {
            navigator.closeTask()
            navigator.showRoot(AppTab.Today)
        },
        conversation = { id, startWith -> ConversationEntry(id, app, exits, startWith) },
        otherwise = otherwise,
    )
}

@Composable
internal fun CheckpointCallContent(
    model: CheckpointCallModel,
    exits: ConversationExits,
    onToday: () -> Unit,
    conversation: @Composable (id: UUID, startWith: Boolean?) -> Unit,
    otherwise: @Composable () -> Unit,
) {
    model.opened?.let { opened ->
        conversation(opened.conversationId, opened.startWith)
        return
    }

    val load by model.call.collectShown()
    val scope = rememberCoroutineScope()
    when (val state = load) {
        LoadState.Idle, LoadState.Loading -> {
            CallFrame(title = stringResource(R.string.conversation_unit_challenge), onClose = exits::close) {
                item(key = "loading") { Box(Modifier.callItem(), contentAlignment = Alignment.Center) { CircularProgressIndicator() } }
            }
        }

        is LoadState.Failed -> {
            CallFrame(title = stringResource(R.string.conversation_unit_challenge), onClose = exits::close) {
                item(
                    key = "failed",
                ) { LoadFailedMessage(onRetry = { scope.launch { model.call.refresh() } }, modifier = Modifier.callItem()) }
            }
        }

        LoadState.Empty -> {
            otherwise()
        }

        is LoadState.Loaded -> {
            when (val call = state.value) {
                is LanguageCheckpointCall.ReadyWrapper -> {
                    conversation(call.value.conversationId, null)
                }

                is LanguageCheckpointCall.NotstartedWrapper -> {
                    CheckpointIntro(call.value, model, exits, onToday)
                }

                is LanguageCheckpointCall.PreparingWrapper -> {
                    CheckpointPreparing(call.value.unitTitle, model, exits)
                }

                // Main sends the learner to Today, where the blocks before this one are.
                is LanguageCheckpointCall.EarlierfirstWrapper -> {
                    LaunchedEffect(Unit) { onToday() }
                }

                is LanguageCheckpointCall.NotlanguageWrapper, is LanguageCheckpointCall.PlusrequiredWrapper -> {
                    otherwise()
                }
            }
        }
    }
}

@Composable
private fun CheckpointIntro(
    call: LanguageCheckpointCallIntro,
    model: CheckpointCallModel,
    exits: ConversationExits,
    onToday: () -> Unit,
) {
    val startCall = rememberCallStart { microphone, _ -> model.start(microphone) }
    val start =
        when (model.start) {
            CheckpointCallModel.Start.Idle -> CallIntroStart.Idle
            CheckpointCallModel.Start.Starting -> CallIntroStart.Starting
            CheckpointCallModel.Start.Failed -> CallIntroStart.Failed
            CheckpointCallModel.Start.PlusRequired -> CallIntroStart.PlusRequired
        }

    if (call.dailyLimitReached) {
        CallIntro(
            conversation = call.intro,
            start = start,
            onStart = {},
            onSeePlus = { exits.open(AppRoute.Subscription) },
            onClose = exits::close,
            actions = {
                Text(
                    stringResource(R.string.conversation_study_time_used_up),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
                OutlinedButton(onClick = onToday, modifier = Modifier.barAction()) {
                    Text(stringResource(R.string.conversation_back_to_today))
                }
            },
        )
        return
    }

    CallIntro(
        conversation = call.intro,
        start = start,
        onStart = { startCall(false) },
        onSeePlus = { exits.open(AppRoute.Subscription) },
        onClose = exits::close,
    )
}

/** Main's `CheckpointCallPreparing`: the call is written for the learner's speaking level first, on their tap. */
@Composable
private fun CheckpointPreparing(
    unitTitle: String,
    model: CheckpointCallModel,
    exits: ConversationExits,
) {
    var asked by remember { mutableStateOf(false) }
    val title = stringResource(R.string.conversation_unit_challenge)

    if (!asked) {
        CallFrame(
            title = title,
            onClose = exits::close,
            bottomBar = {
                StartCallButton(
                    starting = false,
                    onClick = {
                        asked = true
                        model.start(microphone = null)
                    },
                    modifier = Modifier.barAction(),
                    label = stringResource(R.string.conversation_get_ready),
                )
            },
        ) {
            item(key = "header") {
                Column(Modifier.callItem(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(unitTitle, Modifier.semantics { heading() }, style = MaterialTheme.typography.headlineMedium)
                    Text(
                        stringResource(R.string.conversation_get_ready_description),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodyLarge,
                    )
                }
            }
        }
        return
    }

    val failed = model.start == CheckpointCallModel.Start.Failed || model.start == CheckpointCallModel.Start.PlusRequired
    CallFrame(title = title, onClose = exits::close) {
        item(key = "wait") {
            GenerationWait(
                kind = GenerationKind.ConversationCall,
                run =
                    if (failed) {
                        GenerationRun(GenerationRun.Status.Failed, GenerationFailure.NotStarted)
                    } else {
                        GenerationRun(GenerationRun.Status.Following, steps = mapOf("writeCall" to StepState.Started))
                    },
                onRetry = { model.start(microphone = null) },
                modifier = Modifier.callItem(),
            ) {
                Text(
                    stringResource(R.string.conversation_getting_ready),
                    Modifier.semantics { heading() },
                    style = MaterialTheme.typography.titleLarge,
                )
                Text(
                    stringResource(R.string.conversation_opens_here),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        }
    }
}
