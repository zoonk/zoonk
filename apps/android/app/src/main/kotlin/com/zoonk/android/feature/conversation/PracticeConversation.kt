package com.zoonk.android.feature.conversation

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.role
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
import com.zoonk.android.data.StepState
import com.zoonk.android.feature.subscription.PlusMark
import com.zoonk.android.feature.subscription.PlusNotice
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.GenerationWait
import com.zoonk.android.ui.components.KindDotLeading
import com.zoonk.android.ui.components.LearnKind
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LimitPeriod
import com.zoonk.android.ui.components.LimitTier
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.api.models.LanguagePracticeCall
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.util.UUID

/** Main's `useCallStart`: a start that takes longer than a call written ahead is a model writing it. */
class CallStartModel(
    private val start: suspend (CallRequest) -> CallStart,
) : ViewModel() {
    enum class State { Idle, Starting, Writing, Failed, WriteFailed }

    var state by mutableStateOf(State.Idle)
        private set

    /** The plan's call time a refused start ran into. */
    var limit by mutableStateOf<Limit.Reached?>(null)
        private set

    /** [onStarted] opens the call; the sheet is ready for a fresh start when the learner is back. */
    fun start(
        request: CallRequest,
        onStarted: (UUID) -> Unit,
    ) {
        val wasWriting = state == State.WriteFailed
        state = if (wasWriting) State.Writing else State.Starting
        limit = null
        viewModelScope.launch {
            val writing =
                launch {
                    delay(WRITING_AFTER_MS)
                    if (state == State.Starting) state = State.Writing
                }
            val started = start(request)
            writing.cancel()
            val wrote = state == State.Writing
            limit = (started as? CallStart.Limited)?.limit
            state =
                if (started is CallStart.Started) {
                    onStarted(started.conversationId)
                    State.Idle
                } else if (wrote) {
                    State.WriteFailed
                } else {
                    State.Failed
                }
        }
    }

    private companion object {
        const val WRITING_AFTER_MS = 1000L
    }
}

/**
 * Main's `PracticeConversation`: a unit's "Practice a conversation" row, whose sheet picks the
 * call's length (Plus lengths locked) and starts it. For the unit page and the tutor's offers.
 */
@Composable
fun PracticeConversation(
    call: LanguagePracticeCall,
    chapterId: UUID,
    goalId: UUID?,
    app: AppContainer,
    navigator: AppNavigator,
    modifier: Modifier = Modifier,
) = PracticeConversation(call, chapterId, goalId, app.conversations::start, navigator::open, modifier)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun PracticeConversation(
    call: LanguagePracticeCall,
    chapterId: UUID,
    goalId: UUID?,
    start: suspend (CallRequest) -> CallStart,
    open: (AppRoute) -> Unit,
    modifier: Modifier = Modifier,
) {
    var sheet by rememberSaveable { mutableStateOf(false) }
    val character = call.character
    val with = character?.let { stringResource(R.string.conversation_practice_with, it.name, it.role) }

    ListItem(
        headlineContent = { Text(stringResource(R.string.conversation_practice)) },
        supportingContent =
            (if (call.paused) stringResource(R.string.conversation_paused_title) else with)?.let { text -> { Text(text) } },
        leadingContent = { KindDotLeading(LearnKind.Conversation) },
        modifier = modifier.clickable(role = Role.Button) { sheet = true },
        colors = ListItemDefaults.colors(containerColor = Color.Transparent),
    )

    if (sheet) {
        ModalBottomSheet(onDismissRequest = { sheet = false }) {
            Column(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp)
                    .padding(bottom = 24.dp)
                    .navigationBarsPadding(),
                verticalArrangement = Arrangement.spacedBy(20.dp),
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(
                        stringResource(R.string.conversation_practice),
                        Modifier.semantics { heading() },
                        style = MaterialTheme.typography.titleLarge,
                    )
                    with?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium) }
                }
                CallSetup(call, chapterId, goalId, start, open, onStarted = { sheet = false })
            }
        }
    }
}

@Composable
private fun CallSetup(
    call: LanguagePracticeCall,
    chapterId: UUID,
    goalId: UUID?,
    start: suspend (CallRequest) -> CallStart,
    open: (AppRoute) -> Unit,
    onStarted: () -> Unit,
) {
    val model = viewModel(key = "practice-call:$chapterId") { CallStartModel(start) }
    var minutes by rememberSaveable { mutableLongStateOf(call.defaultMinutes) }
    val startCall = {
        model.start(CallRequest.Practice(chapterId, goalId, minutes)) { id ->
            onStarted()
            open(AppRoute.Conversation(id.toString()))
        }
    }

    when {
        call.paused -> {
            CallOffMessage(stringResource(R.string.conversation_paused_title)) {
                Text(
                    stringResource(R.string.conversation_paused),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        }

        model.state == CallStartModel.State.Writing || model.state == CallStartModel.State.WriteFailed -> {
            val failed = model.state == CallStartModel.State.WriteFailed
            GenerationWait(
                kind = GenerationKind.ConversationCall,
                run =
                    if (failed) {
                        GenerationRun(GenerationRun.Status.Failed, GenerationFailure.NotStarted)
                    } else {
                        GenerationRun(GenerationRun.Status.Following, steps = mapOf("writeCall" to StepState.Started))
                    },
                onRetry = startCall,
            ) {
                if (!failed) {
                    Text(
                        stringResource(R.string.conversation_opens_when_ready),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
            }
        }

        call.limit != null -> {
            val limit = requireNotNull(call.limit)
            CallLimitMessage(
                Limit.Reached(
                    LimitTier.entries.first { it.name.equals(limit.tier.value, ignoreCase = true) },
                    LimitPeriod.entries.first { it.name.equals(limit.period.value, ignoreCase = true) },
                ),
                onCreateAccount = { open(AppRoute.Login) },
                onSeePlus = { open(AppRoute.Subscription) },
            )
        }

        else -> {
            LengthChoices(call, minutes, onChange = { minutes = it })
            if (minutes in call.plusMinutes) {
                PlusNotice(
                    onSeePlus = { open(AppRoute.Subscription) },
                    description = stringResource(R.string.conversation_longer_calls_plus),
                )
            } else {
                StartCallButton(
                    starting = model.state == CallStartModel.State.Starting,
                    onClick = startCall,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            if (model.state == CallStartModel.State.Failed) {
                Text(
                    stringResource(R.string.conversation_start_failed),
                    Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        }
    }
}

@Composable
private fun LengthChoices(
    call: LanguagePracticeCall,
    selected: Long,
    onChange: (Long) -> Unit,
) {
    val locale = currentLocale()
    val choices = (call.minutes.map { it to false } + call.plusMinutes.map { it to true }).sortedBy { it.first }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(stringResource(R.string.conversation_call_length), style = MaterialTheme.typography.titleSmall)
        FlowRow(
            Modifier.selectableGroup(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            choices.forEach { (minutes, locked) ->
                FilterChip(
                    selected = minutes == selected,
                    onClick = { onChange(minutes) },
                    label = { Text(formatMinutes(minutes.toInt(), locale)) },
                    leadingIcon =
                        if (minutes == selected) {
                            {
                                Icon(
                                    painterResource(R.drawable.ic_check),
                                    contentDescription = null,
                                    modifier = Modifier.size(FilterChipDefaults.IconSize),
                                )
                            }
                        } else {
                            null
                        },
                    modifier = Modifier.semantics { role = Role.RadioButton },
                    trailingIcon = if (locked) ({ PlusMark() }) else null,
                )
            }
        }
    }
}
