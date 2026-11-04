package com.zoonk.android.feature.conversation

import android.animation.ValueAnimator
import androidx.activity.compose.BackHandler
import androidx.annotation.DrawableRes
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.animateScrollBy
import androidx.compose.foundation.gestures.scrollBy
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.FilledTonalIconButton
import androidx.compose.material3.FilledTonalIconToggleButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SmallFloatingActionButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.nestedscroll.NestedScrollConnection
import androidx.compose.ui.input.nestedscroll.NestedScrollSource
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.text
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.livecall.EndingReason
import com.zoonk.android.feature.livecall.LiveCallPhase
import com.zoonk.android.feature.livecall.LiveCallState
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.Meter
import com.zoonk.android.ui.components.ModalBottomSheet
import com.zoonk.android.ui.components.OutlinedTextField
import com.zoonk.android.ui.format.WORDS_MARK
import com.zoonk.android.ui.format.formatClock
import com.zoonk.android.ui.scaffold.TaskExitConfirmation
import com.zoonk.android.ui.scaffold.taskAsideBeside
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.LanguageConversation
import com.zoonk.api.models.LanguageConversationTurn.Speaker
import com.zoonk.api.models.SpeakingTask
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.launch

/** What the learner can do during the call. */
internal class LiveCallActions(
    val onEnd: () -> Unit,
    val onHelp: () -> Unit,
    val onMute: () -> Unit,
    val onSend: (String) -> Unit,
    val onTyping: () -> Unit,
)

/** A call that ended, while what it saves is written: its status takes the controls' place. */
internal class EndedCall(
    val save: CallSave,
    val grading: Boolean,
    val onRetry: () -> Unit,
    val onClose: () -> Unit,
)

/**
 * Main's live call: who's talking and the goals over the transcript, which follows the newest words;
 * the bar under it says whose turn it is, takes typed replies and holds Help, Mute and End. Back and
 * the close action ask before ending a live call, which End does at once; while it connects, they go
 * back to the intro as End does. Once it ends the transcript stays, and the bar says how its save goes.
 */
@Composable
internal fun ConversationLive(
    conversation: LanguageConversation,
    call: LiveCallState,
    actions: LiveCallActions,
    ended: EndedCall? = null,
) {
    val listState = rememberLazyListState()
    val examTask = conversation.examTask
    val metCount = conversation.objectives.count { it.label in call.metLabels }
    val goalsMeta = stringResource(R.string.conversation_goals_met, metCount, conversation.objectives.size)
    val character = conversation.character

    val live = call.phase == LiveCallPhase.Live && ended == null
    BackHandler(enabled = !live && ended == null, onBack = actions.onEnd)
    val endFirst =
        if (live) {
            TaskExitConfirmation(
                title = stringResource(R.string.conversation_end_title),
                description = stringResource(R.string.conversation_end_description),
                confirm = stringResource(R.string.conversation_end_call),
                cancel = stringResource(R.string.conversation_keep_talking),
            )
        } else {
            null
        }

    val said =
        call.turns.size to
            call.turns
                .lastOrNull()
                ?.text
                ?.length
    // The learner starts and stops following the newest words by scrolling, drags and flings alike;
    // the app's own scrolling never passes through nested scrolling, and words arriving never change
    // it, however far a growing turn reaches past the view.
    var following by rememberSaveable { mutableStateOf(true) }
    val scrolled =
        remember(listState) {
            object : NestedScrollConnection {
                override fun onPostScroll(
                    consumed: Offset,
                    available: Offset,
                    source: NestedScrollSource,
                ): Offset {
                    following = listState.isNearEnd()
                    return Offset.Zero
                }
            }
        }
    val scope = rememberCoroutineScope()
    LaunchedEffect(said) { if (following) listState.scrollToEnd(animate = ValueAnimator.areAnimatorsEnabled()) }
    // The keyboard opening shrinks the list: the line being answered stays in view.
    LaunchedEffect(listState) {
        snapshotFlow { listState.layoutInfo.viewportSize }.drop(1).collect { if (following) listState.scrollToEnd(animate = false) }
    }

    CallFrame(
        title = { CallTitle(conversation.title) },
        onClose = ended?.onClose ?: actions.onEnd,
        listState = listState,
        exitConfirmation = endFirst,
        header = { CallClock(call, conversation.talkSeconds) },
        floating = {
            if (!following) {
                ScrollToLatest {
                    following = true
                    scope.launch { listState.scrollToEnd(animate = ValueAnimator.areAnimatorsEnabled()) }
                }
            }
        },
        listModifier = Modifier.nestedScroll(scrolled),
        bottomBar = { LiveBar(conversation, call, actions, ended) },
        aside = {
            if (examTask == null) {
                Column {
                    SectionTitle(stringResource(R.string.conversation_goals), trailing = goalsMeta)
                    Checklist(conversation.objectives, conversation.targetLanguage, met = { it in call.metLabels })
                }
            } else {
                SpeakingCardView(examTask.card, conversation.targetLanguage, compact = true)
            }
            if (call.usedHelp) Phrases(conversation)
        },
    ) { beside ->
        item(key = "character") {
            val detail =
                if (examTask != null) {
                    taskRoleNoun(examTask.task.role == SpeakingTask.Role.PARTNER)
                } else {
                    stringResource(R.string.conversation_character_detail, character.role, character.place)
                }
            CharacterRow(character.name, detail, Modifier.callItem())
        }
        if (!beside && examTask != null) {
            item(key = "card") { SpeakingCardView(examTask.card, conversation.targetLanguage, Modifier.callItem(), compact = true) }
        }
        if (!beside && examTask == null) {
            item(key = "goals") {
                Column(Modifier.callItem()) {
                    SectionTitle(stringResource(R.string.conversation_goals), trailing = goalsMeta)
                    Checklist(conversation.objectives, conversation.targetLanguage, met = { it in call.metLabels })
                }
            }
        }
        call.turns.forEachIndexed { index, turn ->
            // Turns only grow at the end, so their position identifies them.
            item(key = "turn-$index", contentType = turn.speaker) {
                Turn(turn.speaker, turn.text, conversation, Modifier.callItem())
            }
        }
    }
}

/** Main's header detail and task bar: the time talked, and a bar filling toward the call's length; neither shows before it connects. */
@Composable
private fun CallClock(
    call: LiveCallState,
    talkSeconds: Long,
) {
    val started = call.phase != LiveCallPhase.Connecting && call.phase != LiveCallPhase.Idle
    val share = if (talkSeconds > 0) call.elapsedSeconds.toFloat() / talkSeconds else 0f
    Column(
        Modifier.callItem().padding(top = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(
            Modifier.alpha(if (started) 1f else 0f).then(if (started) Modifier else Modifier.clearAndSetSemantics {}),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            val live = call.phase == LiveCallPhase.Live
            Box(
                Modifier
                    .size(8.dp)
                    .background(if (live) MaterialTheme.colorScheme.tertiary else MaterialTheme.colorScheme.outlineVariant, CircleShape),
            )
            Text(
                formatClock(call.elapsedSeconds * 1000),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.labelMedium.withTabularFigures(),
            )
        }
        Meter(if (started) share else 0f, contentDescription = stringResource(R.string.conversation_call_time))
    }
}

@Composable
private fun BoxScope.ScrollToLatest(onClick: () -> Unit) {
    val label = stringResource(R.string.conversation_scroll_to_latest)
    SmallFloatingActionButton(
        onClick = onClick,
        modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 16.dp),
        containerColor = MaterialTheme.colorScheme.surfaceContainerHigh,
        contentColor = MaterialTheme.colorScheme.onSurface,
    ) {
        Icon(painterResource(R.drawable.ic_arrow_downward), contentDescription = label)
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
        val said = spokenAs(stringResource(R.string.conversation_you_said, WORDS_MARK), text, conversation.targetLanguage)
        Box(modifier, contentAlignment = Alignment.CenterEnd) {
            Surface(
                modifier = Modifier.fillMaxWidth(BUBBLE_SHARE).wrapContentWidth(Alignment.End).clearAndSetSemantics { this.text = said },
                shape = MaterialTheme.shapes.large,
                color = MaterialTheme.colorScheme.surfaceContainerHigh,
            ) {
                Text(words, Modifier.padding(horizontal = 14.dp, vertical = 10.dp), style = MaterialTheme.typography.bodyLarge)
            }
        }
    } else {
        val said =
            spokenAs(
                stringResource(R.string.conversation_character_said, conversation.character.name, WORDS_MARK),
                text,
                conversation.targetLanguage,
            )
        Box(modifier, contentAlignment = Alignment.CenterStart) {
            Text(
                words,
                Modifier.fillMaxWidth(BUBBLE_SHARE).clearAndSetSemantics { this.text = said },
                style = MaterialTheme.typography.bodyLarge,
            )
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

/** Beside an aside, Help's phrases join it; on a phone they open in a sheet, so the transcript keeps its place. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun LiveBar(
    conversation: LanguageConversation,
    call: LiveCallState,
    actions: LiveCallActions,
    ended: EndedCall?,
) {
    if (ended != null) {
        EndedStatus(ended)
        return
    }
    val beside = taskAsideBeside()
    var phrasesOpen by rememberSaveable { mutableStateOf(false) }
    val next = if (conversation.examTask == null) conversation.objectives.firstOrNull { it.label !in call.metLabels } else null
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        CallTurn(call, conversation.character.name, next?.description)
        TypedReply(call.isOpen, actions.onSend, actions.onTyping, focusOnStart = call.micBlocked)
        CallControls(
            call,
            actions,
            onHelp = {
                actions.onHelp()
                if (!beside) phrasesOpen = true
            },
        )
    }
    if (phrasesOpen && !beside) {
        ModalBottomSheet(onDismissRequest = { phrasesOpen = false }) {
            Phrases(conversation, Modifier.padding(start = 24.dp, end = 24.dp, bottom = 24.dp))
        }
    }
}

private enum class TurnState { Calling, Reconnecting, Goodbye, Character, Muted, Typed, Listening, Yours }

/**
 * Main's turn row: whose turn it is, and what to do. It's read when TalkBack reaches it; only the
 * wrap-up line and reconnecting announce themselves, since every other change is already heard.
 */
@Composable
private fun CallTurn(
    call: LiveCallState,
    name: String,
    nextGoal: String?,
) {
    val state =
        when {
            // The intro says the character answers first: until it does, the call is still ringing.
            call.phase != LiveCallPhase.Live || !call.answered -> if (call.reconnecting) TurnState.Reconnecting else TurnState.Calling

            call.sayingGoodbye && !call.learnerSpeaking -> TurnState.Goodbye

            call.characterTalking -> TurnState.Character

            call.muted -> TurnState.Muted

            call.micBlocked -> TurnState.Typed

            call.learnerSpeaking -> TurnState.Listening

            else -> TurnState.Yours
        }
    val wrapUp = wrapUpLine(call, name)
    val firstTurn = call.turns.none { it.speaker == Speaker.LEARNER }
    val title =
        when (state) {
            TurnState.Calling -> stringResource(R.string.conversation_calling, name)
            TurnState.Reconnecting -> stringResource(R.string.conversation_reconnecting)
            TurnState.Goodbye -> stringResource(R.string.conversation_saying_goodbye, name)
            TurnState.Character -> stringResource(R.string.conversation_talking, name)
            TurnState.Muted -> stringResource(R.string.conversation_muted)
            TurnState.Typed, TurnState.Yours -> stringResource(R.string.conversation_your_turn)
            TurnState.Listening -> stringResource(R.string.conversation_listening)
        }
    val detail =
        when (state) {
            TurnState.Calling -> stringResource(R.string.conversation_answers_first, name)
            TurnState.Reconnecting, TurnState.Goodbye -> null
            TurnState.Character -> wrapUp ?: stringResource(R.string.conversation_listen_then_answer).takeIf { firstTurn }
            TurnState.Muted -> wrapUp ?: stringResource(R.string.conversation_muted_detail)
            TurnState.Typed -> wrapUp ?: stringResource(R.string.conversation_type_below)
            TurnState.Listening -> wrapUp
            TurnState.Yours -> wrapUp ?: yourTurnDetail(call, name, nextGoal)
        }

    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
        TurnMark(state, name)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                title,
                Modifier.semantics { if (state == TurnState.Reconnecting) liveRegion = LiveRegionMode.Polite },
                style = MaterialTheme.typography.titleSmall,
            )
            detail?.let {
                Text(
                    it,
                    Modifier.semantics { if (it == wrapUp) liveRegion = LiveRegionMode.Polite },
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        }
    }
}

@Composable
private fun yourTurnDetail(
    call: LiveCallState,
    name: String,
    nextGoal: String?,
): String? =
    when {
        call.quietHint -> stringResource(R.string.conversation_take_your_time)
        !call.learnerSpoke -> stringResource(R.string.conversation_answer_out_loud, name)
        nextGoal != null -> stringResource(R.string.conversation_tip, nextGoal)
        else -> null
    }

/** From the talk time, or once every goal is met, until the goodbye: the character says goodbye after the learner's answer. */
@Composable
private fun wrapUpLine(
    call: LiveCallState,
    name: String,
): String? {
    if (call.sayingGoodbye) return null
    return when (call.ending) {
        EndingReason.Time -> {
            stringResource(R.string.conversation_wrap_up_time, name)
        }

        EndingReason.Done -> {
            stringResource(R.string.conversation_wrap_up_done, name)
        }

        EndingReason.Goodbye, EndingReason.Quiet, null -> {
            null
        }
    }
}

/** The turn row's mark: the character's avatar with its talking ring, the learner's microphone, or the phone while it calls. */
@Composable
private fun TurnMark(
    state: TurnState,
    name: String,
) {
    when (state) {
        TurnState.Calling, TurnState.Reconnecting -> {
            Box(contentAlignment = Alignment.Center) {
                MarkDisc(R.drawable.ic_call, MaterialTheme.colorScheme.surfaceContainerHigh)
                if (ValueAnimator.areAnimatorsEnabled()) {
                    CircularProgressIndicator(Modifier.size(MARK_SIZE), strokeWidth = 2.dp)
                }
            }
        }

        TurnState.Goodbye, TurnState.Character -> {
            CharacterAvatar(name, talking = true)
        }

        TurnState.Muted -> {
            MarkDisc(R.drawable.ic_mic_off, MaterialTheme.colorScheme.surfaceContainerHigh)
        }

        TurnState.Typed -> {
            MarkDisc(R.drawable.ic_keyboard, MaterialTheme.colorScheme.surfaceContainerHigh)
        }

        TurnState.Listening -> {
            MarkDisc(
                R.drawable.ic_mic,
                MaterialTheme.colorScheme.surfaceContainerHigh,
                ring = BorderStroke(2.dp, MaterialTheme.colorScheme.primary.copy(alpha = HEARD_RING_ALPHA)),
            )
        }

        TurnState.Yours -> {
            MarkDisc(R.drawable.ic_mic, MaterialTheme.colorScheme.primary, MaterialTheme.colorScheme.onPrimary)
        }
    }
}

@Composable
private fun MarkDisc(
    @DrawableRes icon: Int,
    color: Color,
    contentColor: Color = MaterialTheme.colorScheme.onSurface,
    ring: BorderStroke? = null,
) {
    Surface(shape = CircleShape, color = color, contentColor = contentColor, border = ring, modifier = Modifier.size(MARK_SIZE)) {
        Box(contentAlignment = Alignment.Center) {
            Icon(painterResource(icon), contentDescription = null, modifier = Modifier.size(20.dp))
        }
    }
}

/** On a call made by typing, the field is where the learner goes next, so it takes focus when the call opens. */
@Composable
private fun TypedReply(
    canSend: Boolean,
    onSend: (String) -> Unit,
    onTyping: () -> Unit,
    focusOnStart: Boolean,
) {
    val field = remember { FocusRequester() }
    LaunchedEffect(Unit) { if (focusOnStart) field.requestFocus() }
    var text by rememberSaveable { mutableStateOf("") }
    val send = {
        if (text.isNotBlank()) {
            onSend(text)
            text = ""
        }
    }
    val label = stringResource(R.string.conversation_type_reply)
    OutlinedTextField(
        value = text,
        onValueChange = {
            text = it
            onTyping()
        },
        modifier = Modifier.fillMaxWidth().focusRequester(field).semantics { contentDescription = label },
        enabled = canSend,
        placeholder = { Text(stringResource(R.string.conversation_type_reply_hint)) },
        trailingIcon = {
            IconButton(onClick = send, enabled = canSend && text.isNotBlank()) {
                Icon(painterResource(R.drawable.ic_send), contentDescription = stringResource(R.string.conversation_send))
            }
        },
        singleLine = true,
        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
        keyboardActions = KeyboardActions(onSend = { send() }),
    )
}

@Composable
private fun CallControls(
    call: LiveCallState,
    actions: LiveCallActions,
    onHelp: () -> Unit,
) {
    val canMute = call.phase == LiveCallPhase.Live && !call.micBlocked
    val off = call.micBlocked || call.muted
    val calling = call.phase != LiveCallPhase.Live
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Control(R.string.conversation_help, Modifier.weight(1f)) { label ->
            FilledTonalIconButton(onClick = onHelp, modifier = Modifier.size(CONTROL_SIZE)) {
                Icon(painterResource(R.drawable.ic_support), contentDescription = label)
            }
        }
        Control(R.string.conversation_mute, Modifier.weight(1f)) { label ->
            FilledTonalIconToggleButton(
                checked = call.muted,
                onCheckedChange = { actions.onMute() },
                enabled = canMute,
                modifier = Modifier.size(CONTROL_SIZE),
                // Muted reads as a pick: the ink fill, not a lighter tonal one.
                colors =
                    IconButtonDefaults.filledTonalIconToggleButtonColors(
                        checkedContainerColor = MaterialTheme.colorScheme.primary,
                        checkedContentColor = MaterialTheme.colorScheme.onPrimary,
                    ),
            ) {
                Icon(painterResource(if (off) R.drawable.ic_mic_off else R.drawable.ic_mic), contentDescription = label)
            }
        }
        Control(if (calling) R.string.conversation_cancel else R.string.conversation_end, Modifier.weight(1f)) { label ->
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

/** A call's feedback takes a few seconds, an exam's grade 13 to 33 s (about 23 for most). */
@Composable
private fun EndedStatus(ended: EndedCall) {
    if (ended.save == CallSave.Saving) {
        val slow by produceState(false) {
            delay(if (ended.grading) SLOW_GRADE_MS else SLOW_FEEDBACK_MS)
            value = true
        }
        val line =
            when {
                ended.grading && slow -> R.string.conversation_rating_slow
                ended.grading -> R.string.conversation_rating
                slow -> R.string.conversation_writing_feedback_slow
                else -> R.string.conversation_writing_feedback
            }
        Row(
            Modifier.fillMaxWidth().semantics(mergeDescendants = true) { liveRegion = LiveRegionMode.Polite },
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(stringResource(R.string.conversation_call_ended), style = MaterialTheme.typography.titleSmall)
                Text(stringResource(line), color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
            }
        }
        return
    }

    val message = if (ended.save == CallSave.Closing) R.string.conversation_still_closing else R.string.conversation_save_failed
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            stringResource(message),
            Modifier.semantics { liveRegion = LiveRegionMode.Polite },
            style = MaterialTheme.typography.bodyLarge,
        )
        Button(onClick = ended.onRetry, modifier = Modifier.barAction()) { Text(stringResource(R.string.conversation_try_again)) }
    }
}

/**
 * Within a few items and a little scrolling of the end, as the newest words arrive; further up,
 * even inside a long last turn, the learner is reading earlier words.
 */
private fun LazyListState.isNearEnd(): Boolean {
    val info = layoutInfo
    val last = info.visibleItemsInfo.lastOrNull() ?: return true
    if (last.index < info.totalItemsCount - TRANSCRIPT_TAIL) return false
    return last.offset + last.size - info.viewportEndOffset <= info.viewportSize.height / FOLLOW_SLACK
}

private suspend fun LazyListState.scrollToEnd(animate: Boolean) {
    val total = layoutInfo.totalItemsCount
    if (total == 0) return
    if ((layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: -1) < total - 1) {
        if (animate) animateScrollToItem(total - 1) else scrollToItem(total - 1)
    }
    // The newest turn can be taller than the view: what's left of it comes into view too.
    val info = layoutInfo
    val last = info.visibleItemsInfo.lastOrNull() ?: return
    val rest = (last.offset + last.size + info.afterContentPadding - info.viewportEndOffset).toFloat()
    if (rest <= 0f) return
    if (animate) animateScrollBy(rest) else scrollBy(rest)
}

private const val BUBBLE_SHARE = 0.8f
private val CONTROL_SIZE = 56.dp
private val MARK_SIZE = 40.dp
private const val HEARD_RING_ALPHA = 0.4f
private const val TRANSCRIPT_TAIL = 3

/** A quarter of the view below its end still follows: a fragment or two grows the newest turn by about a line. */
private const val FOLLOW_SLACK = 4
private const val SLOW_FEEDBACK_MS = 20_000L
private const val SLOW_GRADE_MS = 45_000L
