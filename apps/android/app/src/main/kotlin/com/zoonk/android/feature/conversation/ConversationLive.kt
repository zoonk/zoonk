package com.zoonk.android.feature.conversation

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.FilledTonalIconButton
import androidx.compose.material3.FilledTonalIconToggleButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.livecall.LiveCallPhase
import com.zoonk.android.feature.livecall.LiveCallState
import com.zoonk.android.ui.components.formatClock
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.LanguageConversation
import com.zoonk.api.models.LanguageConversationSetup.EndsAtLimit
import com.zoonk.api.models.LanguageConversationTurn.Speaker
import com.zoonk.api.models.SpeakingTask

/** What the learner can do during the call. */
internal class LiveCallActions(
    val onEnd: () -> Unit,
    val onHelp: () -> Unit,
    val onMute: () -> Unit,
    val onSend: (String) -> Unit,
)

/**
 * Main's live call: who's talking, the transcript, the call's status, then the goals (turning
 * blue as they're met), a tip for the next one and, after Help, phrases to lean on. Back ends the
 * call as End does, so a stray gesture never drops it unsaved.
 */
@Composable
internal fun ConversationLive(
    conversation: LanguageConversation,
    call: LiveCallState,
    usedHelp: Boolean,
    actions: LiveCallActions,
) {
    val listState = rememberLazyListState()
    val examTask = conversation.examTask
    val next = if (examTask == null) conversation.objectives.firstOrNull { it.label !in call.metLabels } else null
    val metCount = conversation.objectives.count { it.label in call.metLabels }
    val goalsMeta = stringResource(R.string.conversation_goals_met, metCount, conversation.objectives.size)
    val character = conversation.character

    BackHandler(onBack = actions.onEnd)

    // The newest words stay in view, unless the learner scrolled up to read earlier ones.
    val said =
        call.turns.size to
            call.turns
                .lastOrNull()
                ?.text
                ?.length
    LaunchedEffect(said) {
        val info = listState.layoutInfo
        val nearEnd = (info.visibleItemsInfo.lastOrNull()?.index ?: 0) >= info.totalItemsCount - TRANSCRIPT_TAIL
        if (nearEnd && info.totalItemsCount > 0) listState.scrollToItem(info.totalItemsCount - 1)
    }

    CallFrame(
        title = conversation.title,
        onClose = actions.onEnd,
        listState = listState,
        bottomBar = { LiveBar(call, actions) },
        aside = {
            if (examTask == null) {
                Column {
                    SectionTitle(stringResource(R.string.conversation_goals), trailing = goalsMeta)
                    Checklist(conversation.objectives, conversation.targetLanguage, met = { it in call.metLabels })
                }
            } else {
                SpeakingCardView(examTask.card, conversation.targetLanguage, compact = true)
            }
            CallTip(call.limitNear, next?.description)
            if (usedHelp) Phrases(conversation)
        },
    ) { beside ->
        item(key = "character") {
            val detail =
                if (examTask != null) {
                    taskRoleNoun(examTask.task.role == SpeakingTask.Role.PARTNER)
                } else {
                    stringResource(R.string.conversation_character_detail, character.role, character.place)
                }
            CharacterRow(character.name, detail, Modifier.callItem(), talking = call.characterTalking)
        }
        if (!beside && examTask != null) {
            item(key = "card") { SpeakingCardView(examTask.card, conversation.targetLanguage, Modifier.callItem(), compact = true) }
        }
        if (!beside && examTask == null) {
            item(key = "goals") {
                Checklist(
                    conversation.objectives,
                    conversation.targetLanguage,
                    met = { it in call.metLabels },
                    modifier = Modifier.callItem(),
                )
            }
        }
        call.turns.forEachIndexed { index, turn ->
            // Turns only grow at the end, so their position identifies them.
            item(key = "turn-$index", contentType = turn.speaker) {
                Turn(turn.speaker, turn.text, conversation, Modifier.callItem())
            }
        }
        item(key = "status") { CallStatus(call, character.name, Modifier.callItem()) }
        if (!beside) {
            item(key = "tip") { CallTip(call.limitNear, next?.description, Modifier.callItem()) }
            if (usedHelp) item(key = "phrases") { Phrases(conversation, Modifier.callItem()) }
        }
    }
}

@Composable
private fun CallClock(call: LiveCallState) {
    val live = call.phase == LiveCallPhase.Live
    val clock = stringResource(R.string.conversation_clock, formatClock(call.elapsedSeconds * 1000), formatClock(call.limitSeconds * 1000))
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(
            Modifier
                .size(8.dp)
                .background(if (live) MaterialTheme.colorScheme.tertiary else MaterialTheme.colorScheme.outlineVariant, CircleShape),
        )
        Text(clock, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelMedium.withTabularFigures())
    }
}

@Composable
private fun Turn(
    speaker: Speaker,
    text: String,
    conversation: LanguageConversation,
    modifier: Modifier = Modifier,
) {
    val words = inLanguage(text, conversation.targetLanguage)
    if (speaker == Speaker.LEARNER) {
        val said = stringResource(R.string.conversation_you_said, text)
        Box(modifier, contentAlignment = Alignment.CenterEnd) {
            Surface(
                modifier = Modifier.fillMaxWidth(BUBBLE_SHARE).wrapContentWidth(Alignment.End).semantics { contentDescription = said },
                shape = MaterialTheme.shapes.large,
                color = MaterialTheme.colorScheme.surfaceContainerHigh,
            ) {
                Text(words, Modifier.padding(horizontal = 14.dp, vertical = 10.dp), style = MaterialTheme.typography.bodyLarge)
            }
        }
    } else {
        val said = stringResource(R.string.conversation_character_said, conversation.character.name, text)
        Box(modifier, contentAlignment = Alignment.CenterStart) {
            Text(
                words,
                Modifier.fillMaxWidth(BUBBLE_SHARE).semantics { contentDescription = said },
                style = MaterialTheme.typography.bodyLarge,
            )
        }
    }
}

@Composable
private fun CallStatus(
    call: LiveCallState,
    name: String,
    modifier: Modifier = Modifier,
) {
    val status =
        when {
            call.phase == LiveCallPhase.Connecting || call.phase == LiveCallPhase.Idle -> {
                stringResource(if (call.reconnecting) R.string.conversation_reconnecting else R.string.conversation_calling)
            }

            call.micBlocked -> {
                stringResource(R.string.conversation_microphone_off)
            }

            call.muted -> {
                stringResource(R.string.conversation_muted)
            }

            call.characterTalking -> {
                stringResource(R.string.conversation_talking, name)
            }

            else -> {
                stringResource(R.string.conversation_listening)
            }
        }
    Text(
        status,
        modifier.semantics { liveRegion = LiveRegionMode.Polite },
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        style = MaterialTheme.typography.bodySmall,
    )
}

@Composable
private fun CallTip(
    limitNear: EndsAtLimit?,
    nextGoal: String?,
    modifier: Modifier = Modifier,
) {
    when {
        limitNear != null -> {
            val text =
                stringResource(
                    if (limitNear ==
                        EndsAtLimit.MONTH
                    ) {
                        R.string.conversation_almost_up_month
                    } else {
                        R.string.conversation_almost_up_day
                    },
                )
            CallNote(text, R.drawable.ic_schedule, modifier, announce = true)
        }

        nextGoal != null -> {
            CallNote(stringResource(R.string.conversation_tip, nextGoal), R.drawable.ic_lightbulb, modifier)
        }
    }
}

@Composable
private fun Phrases(
    conversation: LanguageConversation,
    modifier: Modifier = Modifier,
) {
    Column(modifier) {
        SectionTitle(stringResource(R.string.conversation_phrases))
        conversation.hints.forEachIndexed { index, hint ->
            if (index > 0) HorizontalDivider()
            Text(
                inLanguage(hint, conversation.targetLanguage),
                Modifier.padding(vertical = 10.dp),
                style = MaterialTheme.typography.bodyLarge,
            )
        }
    }
}

@Composable
private fun LiveBar(
    call: LiveCallState,
    actions: LiveCallActions,
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        CallClock(call)
        TypedReply(call.isOpen, actions.onSend)
        CallControls(call, actions)
    }
}

@Composable
private fun TypedReply(
    canSend: Boolean,
    onSend: (String) -> Unit,
) {
    var text by rememberSaveable { mutableStateOf("") }
    val send = {
        if (text.isNotBlank()) {
            onSend(text)
            text = ""
        }
    }
    val label = stringResource(R.string.conversation_type_reply)
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
        OutlinedTextField(
            value = text,
            onValueChange = { text = it },
            modifier = Modifier.weight(1f).semantics { contentDescription = label },
            enabled = canSend,
            placeholder = { Text(stringResource(R.string.conversation_type_reply_hint)) },
            singleLine = true,
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
            keyboardActions = KeyboardActions(onSend = { send() }),
        )
        FilledIconButton(onClick = send, enabled = canSend && text.isNotBlank()) {
            Icon(painterResource(R.drawable.ic_send), contentDescription = stringResource(R.string.conversation_send))
        }
    }
}

@Composable
private fun CallControls(
    call: LiveCallState,
    actions: LiveCallActions,
) {
    val canMute = call.phase == LiveCallPhase.Live && !call.micBlocked
    val off = call.micBlocked || call.muted
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Control(R.string.conversation_help, Modifier.weight(1f)) { label ->
            FilledTonalIconButton(onClick = actions.onHelp, modifier = Modifier.size(CONTROL_SIZE)) {
                Icon(painterResource(R.drawable.ic_support), contentDescription = label)
            }
        }
        Control(R.string.conversation_mute, Modifier.weight(1f)) { label ->
            FilledTonalIconToggleButton(
                checked = call.muted,
                onCheckedChange = { actions.onMute() },
                enabled = canMute,
                modifier = Modifier.size(CONTROL_SIZE),
            ) {
                Icon(painterResource(if (off) R.drawable.ic_mic_off else R.drawable.ic_mic), contentDescription = label)
            }
        }
        Control(R.string.conversation_end, Modifier.weight(1f)) { label ->
            FilledIconButton(
                onClick = actions.onEnd,
                modifier = Modifier.size(CONTROL_SIZE),
                colors =
                    IconButtonDefaults.filledIconButtonColors(
                        containerColor = MaterialTheme.colorScheme.errorContainer,
                        contentColor = MaterialTheme.colorScheme.onErrorContainer,
                    ),
            ) {
                Icon(painterResource(R.drawable.ic_call_end), contentDescription = label)
            }
        }
    }
}

/** A call control as phones show them: the button, its name under it. */
@Composable
private fun Control(
    label: Int,
    modifier: Modifier = Modifier,
    button: @Composable (label: String) -> Unit,
) {
    val name = stringResource(label)
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        button(name)
        Text(name, Modifier.clearAndSetSemantics {}, style = MaterialTheme.typography.labelMedium, textAlign = TextAlign.Center)
    }
}

private const val BUBBLE_SHARE = 0.8f
private val CONTROL_SIZE = 56.dp
private const val TRANSCRIPT_TAIL = 3
