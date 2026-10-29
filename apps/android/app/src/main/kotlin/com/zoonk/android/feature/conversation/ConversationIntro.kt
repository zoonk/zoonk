package com.zoonk.android.feature.conversation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.subscription.PlusNotice
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.api.models.LanguageConversationIntro

/** What the intro's Start does now. */
enum class CallIntroStart { Idle, Starting, Failed, PlusRequired }

/**
 * Main's call intro: how long and at what level, the situation, who answers, and the goals to get
 * across, with Start (or See Plus for a locked call). The microphone is asked for on Start.
 */
@Composable
internal fun CallIntro(
    conversation: LanguageConversationIntro,
    start: CallIntroStart,
    onStart: () -> Unit,
    onSeePlus: () -> Unit,
    onClose: () -> Unit,
    actions: (@Composable ColumnScope.() -> Unit)? = null,
) {
    val locale = currentLocale()
    val character = conversation.character
    val goals: @Composable () -> Unit = {
        Column {
            SectionTitle(stringResource(R.string.conversation_get_across))
            Checklist(conversation.objectives, conversation.targetLanguage, met = { false }, describe = true)
        }
    }

    CallFrame(
        title = conversationTitle(conversation),
        onClose = onClose,
        bottomBar = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                if (actions != null) actions() else IntroActions(start, onStart, onSeePlus)
            }
        },
        aside = { goals() },
    ) { beside ->
        item(key = "header") {
            Column(Modifier.callItem(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    stringResource(
                        R.string.conversation_intro_meta,
                        formatMinutes(conversation.minutes.toInt(), locale),
                        conversation.level.value,
                    ),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.labelLarge,
                )
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
        if (!beside) {
            item(key = "goals") { Column(Modifier.callItem()) { goals() } }
        }
        item(key = "mic") {
            CallNote(stringResource(R.string.conversation_mic_note), R.drawable.ic_mic, Modifier.callItem())
        }
    }
}

@Composable
private fun IntroActions(
    start: CallIntroStart,
    onStart: () -> Unit,
    onSeePlus: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (start == CallIntroStart.PlusRequired) {
            PlusNotice(onSeePlus = null, description = stringResource(R.string.conversation_challenge_plus), inset = true)
            Button(onClick = onSeePlus, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.subscription_see_plus)) }
            return@Column
        }
        if (start == CallIntroStart.Failed) {
            Text(
                stringResource(R.string.conversation_start_failed),
                Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
        StartCallButton(starting = start == CallIntroStart.Starting, onClick = onStart, modifier = Modifier.fillMaxWidth())
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
