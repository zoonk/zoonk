package com.zoonk.android.feature.conversation

import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.audio.MicrophoneOff
import com.zoonk.android.feature.subscription.PlusNotice
import com.zoonk.android.ui.components.Eyebrow
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.LanguageConversationIntro

/** What the intro's Start does now. */
enum class CallIntroStart { Idle, Starting, Failed, PlusRequired }

/**
 * Main's call intro: about how long and at what level, the situation, who answers, how the call
 * goes, and the goals to get across, with the call's main action (or See Plus for a locked call).
 * The microphone is asked for on that action; a refusal stays here, with nothing reserved.
 */
@Composable
internal fun CallIntro(
    conversation: LanguageConversationIntro,
    start: CallIntroStart,
    launcher: CallLauncher?,
    onSeePlus: () -> Unit,
    onClose: () -> Unit,
    actions: (@Composable ColumnScope.() -> Unit)? = null,
) {
    val locale = currentLocale()
    val character = conversation.character
    val time = formatMinutes(conversation.minutes.toInt(), locale)
    // A role-play's character answers a phone call; an exam's examiner runs its own format.
    val rolePlay =
        conversation.kind == LanguageConversationIntro.Kind.PRACTICE || conversation.kind == LanguageConversationIntro.Kind.CHECKPOINT
    val goals: @Composable () -> Unit = {
        Column {
            SectionTitle(stringResource(R.string.conversation_get_across))
            Checklist(conversation.objectives, conversation.targetLanguage, met = { false }, describe = true)
        }
    }

    CallFrame(
        title = { CallTitle(conversationTitle(conversation)) },
        onClose = onClose,
        bottomBar = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                when {
                    actions != null -> {
                        actions()
                    }

                    start == CallIntroStart.PlusRequired || launcher == null -> {
                        PlusNotice(onSeePlus = null, description = stringResource(R.string.conversation_challenge_plus), inset = true)
                        Button(
                            onClick = onSeePlus,
                            modifier = Modifier.barAction(),
                        ) { Text(stringResource(R.string.subscription_see_plus)) }
                    }

                    else -> {
                        val label = if (rolePlay) stringResource(R.string.conversation_call, character.name) else null
                        CallStartActions(
                            launcher,
                            character.name,
                            starting = start == CallIntroStart.Starting,
                            failed =
                                start == CallIntroStart.Failed,
                            label = label,
                        )
                    }
                }
            }
        },
        aside = { goals() },
    ) { beside ->
        item(key = "header") {
            Column(Modifier.callItem(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Eyebrow(stringResource(R.string.conversation_intro_meta, time, conversation.level.value))
                Text(conversation.title, Modifier.semantics { heading() }, style = MaterialTheme.typography.headlineMedium)
                Text(conversation.situation, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyLarge)
            }
        }
        item(key = "character") {
            CharacterRow(
                character.name,
                stringResource(R.string.conversation_character_detail, character.role, character.place),
                Modifier.callItem(),
            )
        }
        if (rolePlay) {
            item(key = "how") { HowTheCallWorks(character.name, time, Modifier.callItem()) }
        } else {
            item(
                key = "ends",
            ) { CallNote(stringResource(R.string.conversation_ends_after, time), R.drawable.ic_schedule, Modifier.callItem()) }
        }
        if (!beside) {
            item(key = "goals") { Column(Modifier.callItem()) { goals() } }
        }
        item(key = "sound") {
            CallNote(stringResource(R.string.conversation_sound_note), R.drawable.ic_mic, Modifier.callItem())
        }
    }
}

@Composable
private fun HowTheCallWorks(
    name: String,
    time: String,
    modifier: Modifier = Modifier,
) {
    val steps =
        listOf(
            stringResource(R.string.conversation_how_answers_first, name),
            stringResource(R.string.conversation_how_your_turn),
            stringResource(R.string.conversation_how_it_ends, time, name),
        )
    Surface(modifier, shape = MaterialTheme.shapes.large, color = MaterialTheme.colorScheme.surfaceContainerHigh) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                stringResource(R.string.conversation_how_it_works),
                Modifier.semantics { heading() },
                style = MaterialTheme.typography.titleSmall,
            )
            steps.forEachIndexed { index, step ->
                Row(Modifier.semantics(mergeDescendants = true) {}, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        "${index + 1}.",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodyMedium.withTabularFigures(),
                    )
                    Text(step, style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
    }
}

/**
 * The call's main action, or, once the microphone was refused, a way to call by typing and the way
 * to the settings that allow it. [label] names the action; without one it starts the call.
 */
@Composable
internal fun CallStartActions(
    launcher: CallLauncher,
    characterName: String,
    starting: Boolean = false,
    failed: Boolean = false,
    label: String? = null,
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (launcher.micBlocked) {
            // The message takes the place of the button that had focus, so focus moves to it.
            val message = remember { FocusRequester() }
            LaunchedEffect(Unit) { message.requestFocus() }
            MicrophoneOff(stringResource(R.string.conversation_mic_off, characterName), Modifier.focusRequester(message).focusable())
            Button(onClick = launcher.typeInstead, modifier = Modifier.barAction()) {
                Icon(painterResource(R.drawable.ic_keyboard), contentDescription = null, modifier = Modifier.size(ButtonDefaults.IconSize))
                Spacer(Modifier.size(ButtonDefaults.IconSpacing))
                Text(stringResource(R.string.conversation_type_instead))
            }
            return@Column
        }
        if (failed) {
            Text(
                stringResource(R.string.conversation_start_failed),
                Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
        StartCallButton(
            starting = starting,
            onClick = { launcher.start(false) },
            modifier = Modifier.barAction(),
            label = label ?: stringResource(R.string.conversation_start),
        )
    }
}

@Composable
internal fun StartCallButton(
    starting: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    label: String = stringResource(R.string.conversation_start),
) {
    Button(onClick = onClick, enabled = !starting, modifier = modifier) {
        if (starting) {
            CircularProgressIndicator(Modifier.size(ButtonDefaults.IconSize), strokeWidth = 2.dp)
        } else {
            Icon(painterResource(R.drawable.ic_call), contentDescription = null, modifier = Modifier.size(ButtonDefaults.IconSize))
        }
        Spacer(Modifier.size(ButtonDefaults.IconSpacing))
        Text(if (starting) stringResource(R.string.conversation_starting) else label)
    }
}
