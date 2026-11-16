package com.zoonk.android.feature.conversation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.listSaver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.AnalyticsEvent
import com.zoonk.android.data.ContentWritingWait
import com.zoonk.android.data.GenerationKind
import com.zoonk.android.data.TrackShown
import com.zoonk.android.data.Visit
import com.zoonk.android.feature.subscription.GateWords
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.ActOn
import com.zoonk.android.ui.VisitOf
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.HeldSlot
import com.zoonk.android.ui.components.KindDot
import com.zoonk.android.ui.components.LearnKind
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LimitPeriod
import com.zoonk.android.ui.components.LimitTier
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.ModalBottomSheet
import com.zoonk.android.ui.components.WritingWait
import com.zoonk.android.ui.components.comesBackLine
import com.zoonk.android.ui.components.hasWayOn
import com.zoonk.android.ui.components.limitLifted
import com.zoonk.android.ui.components.needsAccount
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.api.models.LanguagePracticeCall
import kotlinx.coroutines.launch
import java.util.UUID
import kotlin.time.toJavaInstant

/**
 * Main's `useCallStart`: a call that isn't written yet waits on the run writing it, then starts again.
 * [refused] writes a subscription refusal into the access the screen reads, which shows its gate.
 */
class CallStartModel(
    private val starter: CallStarter,
    kind: GenerationKind,
    private val refused: suspend () -> Unit = {},
) : ViewModel() {
    /** The visit of the screen that asked: the call it started opens, or its failure shows, only on it. */
    val visit = Visit()

    enum class State { Idle, Starting, Failed, Paused, PlusRequired }

    private class Failure(
        val limit: Limit.Reached?,
    )

    private var phase by mutableStateOf(State.Idle)
    private val failure = visit.outcome<Failure>()

    /** Failed only on the visit that asked. */
    val state get() = if (failure.value != null) State.Failed else phase

    /** The plan's call time a refused start ran into, on the visit that asked. */
    val limit get() = failure.value?.limit

    /** The call a start opened, for the screen that asked to open with [OpenStartedCall]. */
    val started = visit.outcome<UUID>()

    val writing = starter.writingWaits.create(kind, viewModelScope)

    fun start(request: CallRequest) = start(request, visit.number)

    /** [asked] is the tap's visit, which the request sent again once its call is written still answers. */
    private fun start(
        request: CallRequest,
        asked: Int,
    ) {
        phase = State.Starting
        failure.clear()
        viewModelScope.launch {
            val started = starter.start(request)
            val answer = writing.answered((started as? CallStart.Writing)?.generationId) { start(request, asked) }
            phase =
                when {
                    answer == ContentWritingWait.Answer.Waiting -> {
                        State.Idle
                    }

                    started is CallStart.Started && answer == ContentWritingWait.Answer.Proceed -> {
                        this@CallStartModel.started.send(asked, started.conversationId)
                        State.Idle
                    }

                    started == CallStart.Paused -> {
                        State.Paused
                    }

                    started == CallStart.PlusRequired -> {
                        State.PlusRequired
                    }

                    else -> {
                        failure.send(asked, Failure((started as? CallStart.Limited)?.limit))
                        State.Idle
                    }
                }
            if (started == CallStart.PlusRequired) refused()
        }
    }
}

/**
 * The screen that starts [model]'s call: it opens the call that start opened, after the device turns too,
 * and leaving it ends the visit, so a start that answers later opens nothing.
 */
@Composable
fun OpenStartedCall(
    model: CallStartModel,
    open: (UUID) -> Unit,
) {
    VisitOf(model.visit)
    ActOn(model.started, open)
}

/** Hoist it above a layout that moves the row, as between a page and its aside, so the open sheet and its length stay. */
@Stable
class PracticeCallState internal constructor(
    sheetOpen: Boolean,
    minutes: Long,
) {
    var sheetOpen by mutableStateOf(sheetOpen)
    var minutes by mutableLongStateOf(minutes)
}

@Composable
fun rememberPracticeCallState(defaultMinutes: Long): PracticeCallState =
    rememberSaveable(
        saver = listSaver(save = { listOf(it.sheetOpen, it.minutes) }, restore = { PracticeCallState(it[0] as Boolean, it[1] as Long) }),
    ) { PracticeCallState(sheetOpen = false, minutes = defaultMinutes) }

@Composable
internal fun PracticeConversation(
    call: LanguagePracticeCall,
    chapterId: UUID,
    goalId: UUID?,
    app: AppContainer,
    navigator: AppNavigator,
    modifier: Modifier = Modifier,
    state: PracticeCallState = rememberPracticeCallState(call.defaultMinutes),
) = PracticeConversation(call, chapterId, goalId, app.conversations, navigator::open, modifier, state)

@Composable
fun PracticeConversation(
    call: LanguagePracticeCall,
    chapterId: UUID,
    goalId: UUID?,
    start: CallStarter,
    open: (AppRoute) -> Unit,
    modifier: Modifier = Modifier,
    state: PracticeCallState = rememberPracticeCallState(call.defaultMinutes),
) {
    val with = call.character?.let { stringResource(R.string.conversation_practice_with, it.name, it.role) }

    ListRow(
        headline = { Text(stringResource(R.string.conversation_practice)) },
        modifier = modifier,
        onClick = { state.sheetOpen = true },
        leading = { KindDot(LearnKind.Conversation) },
        supporting = (if (call.paused) stringResource(R.string.conversation_paused_title) else with)?.let { text -> { Text(text) } },
    )

    PracticeCallSheet(call, chapterId, goalId, start, open, state)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PracticeCallSheet(
    call: LanguagePracticeCall,
    chapterId: UUID,
    goalId: UUID?,
    start: CallStarter,
    open: (AppRoute) -> Unit,
    state: PracticeCallState,
) {
    if (!state.sheetOpen) return

    ModalBottomSheet(onDismissRequest = { state.sheetOpen = false }) {
        PracticeCallSheetContent(call, chapterId, goalId, start, open, state)
    }
}

/** What the practice call's sheet holds: its title, then the call's setup. */
@Composable
internal fun PracticeCallSheetContent(
    call: LanguagePracticeCall,
    chapterId: UUID,
    goalId: UUID?,
    start: CallStarter,
    open: (AppRoute) -> Unit,
    state: PracticeCallState,
) {
    val with = call.character?.let { stringResource(R.string.conversation_practice_with, it.name, it.role) }
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
        CallSetup(call, chapterId, goalId, start, open, state)
    }
}

@Composable
private fun CallSetup(
    call: LanguagePracticeCall,
    chapterId: UUID,
    goalId: UUID?,
    start: CallStarter,
    open: (AppRoute) -> Unit,
    state: PracticeCallState,
) {
    val model = viewModel(key = "practice-call:$chapterId") { CallStartModel(start, GenerationKind.ConversationCall) }
    val writing by model.writing.generationId.collectAsStateWithLifecycle()
    val minutes = state.minutes
    val startCall = { model.start(CallRequest.Practice(chapterId, goalId, minutes)) }
    OpenStartedCall(model) { id ->
        state.sheetOpen = false
        open(AppRoute.Conversation(id.toString()))
    }
    val offered =
        call.limit?.let {
            Limit.Reached(
                LimitTier.entries.first { tier -> tier.name.equals(it.tier.value, ignoreCase = true) },
                LimitPeriod.entries.first { period -> period.name.equals(it.period.value, ignoreCase = true) },
                it.availableAt?.toJavaInstant(),
            )
        }
    val limit = (model.limit.takeIf { model.state == CallStartModel.State.Failed } ?: offered)?.takeUnless { limitLifted(it) }

    when {
        call.paused -> {
            CallsPausedMessage()
        }

        writing != null -> {
            WritingWait(model.writing, hint = stringResource(R.string.conversation_opens_when_ready))
        }

        else -> {
            val locked = minutes in call.plusMinutes
            if (call.minutes.isNotEmpty() || call.plusMinutes.isNotEmpty()) LengthChoices(call, minutes, onChange = { state.minutes = it })
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                CallSetupLine(call, limit, locked)
                when {
                    limit?.needsAccount == true -> {
                        Button(
                            onClick = { open(AppRoute.Login) },
                            modifier = Modifier.fillMaxWidth(),
                        ) { Text(stringResource(R.string.limit_create_account)) }
                    }

                    locked || limit?.hasWayOn == true -> {
                        if (locked) TrackShown(AnalyticsEvent.SubscriptionGateShown)
                        Button(onClick = { open(AppRoute.Subscription) }, modifier = Modifier.fillMaxWidth()) {
                            Text(stringResource(R.string.subscription_subscribe))
                        }
                    }

                    else -> {
                        // A Plus learner's waits for the limit's day, which turns it on with the length picked meanwhile.
                        StartCallButton(
                            starting = model.state == CallStartModel.State.Starting,
                            onClick = startCall,
                            modifier = Modifier.fillMaxWidth(),
                            enabled = limit == null,
                        )
                    }
                }
            }
            if (model.state == CallStartModel.State.Paused) CallsPausedMessage()
            if (model.state == CallStartModel.State.Failed && model.limit == null) {
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

/**
 * Main's line over the sheet's action: why it can't start (the limit, else a Plus-only length). It keeps a Plus-only
 * length's room wherever the sheet offers one, and the limit's room after its day comes, so the action never moves.
 */
@Composable
private fun CallSetupLine(
    call: LanguagePracticeCall,
    limit: Limit.Reached?,
    locked: Boolean,
) {
    val lockedLine = stringResource(R.string.conversation_longer_calls_gate)
    HeldSlot(gated = limit != null) {
        Box(Modifier.semantics { liveRegion = LiveRegionMode.Polite }) {
            if (call.plusMinutes.isNotEmpty()) GateWords(lockedLine, null, Modifier.alpha(0f).clearAndSetSemantics {})
            when {
                limit != null -> GateWords(callLimitTitle(limit), comesBackLine(limit))
                locked -> GateWords(lockedLine, null)
            }
        }
    }
}

@Composable
private fun CallsPausedMessage() {
    CallOffMessage(stringResource(R.string.conversation_paused_title)) {
        Text(
            stringResource(R.string.conversation_paused),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
    }
}

@Composable
private fun LengthChoices(
    call: LanguagePracticeCall,
    selected: Long,
    onChange: (Long) -> Unit,
) {
    val locale = currentLocale()
    val choices = (call.minutes + call.plusMinutes).sorted()
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(stringResource(R.string.conversation_call_length), style = MaterialTheme.typography.titleSmall)
        FlowRow(
            Modifier.selectableGroup(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            choices.forEach { minutes ->
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
                )
            }
        }
    }
}
