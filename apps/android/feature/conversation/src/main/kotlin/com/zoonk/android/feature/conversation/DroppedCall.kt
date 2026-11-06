package com.zoonk.android.feature.conversation

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Button
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.audio.MicrophoneOff
import com.zoonk.android.feature.livecall.LiveCallFailure
import com.zoonk.android.feature.livecall.LiveCallPhase
import com.zoonk.android.feature.subscription.PlusNotice
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LimitActions
import com.zoonk.android.ui.components.LimitPeriod
import com.zoonk.android.ui.components.LimitSubject
import com.zoonk.android.ui.components.LimitTier
import com.zoonk.android.ui.components.limitMessage

internal enum class DroppedReason { CallInProgress, CallsPaused, Ended, Limit, Microphone, PlusRequired }

internal enum class DroppedRetry { CallAgain, Microphone, Takeover }

/** Why the call can't go on (null keeps the plain "call dropped" line) and how to call again, when that can work. */
internal data class DroppedCall(
    val reason: DroppedReason?,
    val retry: DroppedRetry?,
)

/**
 * Null when the screen isn't a dropped call. A call that dropped stays dropped whatever stops its
 * reconnect ([continuing]), so it can still be ended and saved; a microphone refused since is why.
 */
internal fun droppedCall(
    continuing: Boolean,
    phase: LiveCallPhase,
    failure: LiveCallFailure?,
    micBlocked: Boolean,
): DroppedCall? {
    if (phase != LiveCallPhase.Failed || !(continuing || failure == LiveCallFailure.Dropped)) return null
    if (micBlocked) return DroppedCall(DroppedReason.Microphone, DroppedRetry.Microphone)
    return when (failure) {
        LiveCallFailure.CallInProgress -> DroppedCall(DroppedReason.CallInProgress, DroppedRetry.Takeover)
        LiveCallFailure.CallsPaused -> DroppedCall(DroppedReason.CallsPaused, DroppedRetry.CallAgain)
        LiveCallFailure.Ended -> DroppedCall(DroppedReason.Ended, retry = null)
        LiveCallFailure.Limit -> DroppedCall(DroppedReason.Limit, retry = null)
        LiveCallFailure.PlusRequired -> DroppedCall(DroppedReason.PlusRequired, retry = null)
        LiveCallFailure.Connect, LiveCallFailure.Dropped, null -> DroppedCall(reason = null, DroppedRetry.CallAgain)
    }
}

internal class DroppedCallActions(
    val onEnd: () -> Unit,
    val onRetry: () -> Unit,
    val onTakeover: () -> Unit,
    val onTypeInstead: () -> Unit,
    val onCreateAccount: () -> Unit,
    val onSeePlus: () -> Unit,
)

/** A call that dropped can always be ended and saved, and called again when that can work. */
@Composable
internal fun DroppedCallScreen(
    dropped: DroppedCall,
    limit: Limit.Reached?,
    characterName: String,
    title: String,
    actions: DroppedCallActions,
) {
    // Leaving a dropped call ends it, so what was said still gets its feedback.
    BackHandler(onBack = actions.onEnd)
    CallFrame(
        title = { CallTitle(title) },
        onClose = actions.onEnd,
        bottomBar = { DroppedActions(dropped.retry, actions) },
        lonePage = true,
    ) {
        item(key = "dropped") {
            CallOffMessage(stringResource(R.string.conversation_dropped_title), Modifier.callItem()) {
                DroppedReasonText(dropped.reason, limit, characterName, actions)
            }
        }
    }
}

@Composable
private fun DroppedReasonText(
    reason: DroppedReason?,
    limit: Limit.Reached?,
    characterName: String,
    actions: DroppedCallActions,
) {
    when (reason) {
        null -> {
            Muted(stringResource(R.string.conversation_dropped))
        }

        DroppedReason.CallsPaused -> {
            Reason(stringResource(R.string.conversation_paused_title)) { Muted(stringResource(R.string.conversation_paused)) }
        }

        DroppedReason.Ended -> {
            Reason(stringResource(R.string.conversation_ended_title)) { Muted(stringResource(R.string.conversation_ended)) }
        }

        DroppedReason.CallInProgress -> {
            Reason(stringResource(R.string.conversation_in_progress_title)) { Muted(stringResource(R.string.conversation_in_progress)) }
        }

        DroppedReason.Limit -> {
            val reached = limit ?: Limit.Reached(LimitTier.Plus, LimitPeriod.Day)
            Reason(callLimitTitle(reached)) {
                Muted(limitMessage(reached, LimitSubject.Calls))
                LimitActions(reached, actions.onCreateAccount, actions.onSeePlus)
            }
        }

        DroppedReason.PlusRequired -> {
            PlusNotice(onSeePlus = actions.onSeePlus, description = stringResource(R.string.conversation_challenge_plus))
        }

        DroppedReason.Microphone -> {
            MicrophoneOff(stringResource(R.string.conversation_mic_off, characterName))
        }
    }
}

@Composable
private fun Reason(
    title: String,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(title, Modifier.semantics { heading() }, style = MaterialTheme.typography.titleMedium)
        content()
    }
}

@Composable
private fun Muted(text: String) {
    Text(text, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyLarge)
}

@Composable
private fun DroppedActions(
    retry: DroppedRetry?,
    actions: DroppedCallActions,
) {
    val end = stringResource(R.string.conversation_end_call)
    when (retry) {
        null -> {
            Button(onClick = actions.onEnd, modifier = Modifier.barAction()) { Text(end) }
        }

        DroppedRetry.CallAgain -> {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilledTonalButton(onClick = actions.onEnd) { Text(end) }
                Button(onClick = actions.onRetry, modifier = Modifier.weight(1f)) { Text(stringResource(R.string.conversation_call_again)) }
            }
        }

        DroppedRetry.Takeover -> {
            CrowdedActions { fill ->
                FilledTonalButton(onClick = actions.onEnd, modifier = fill) { Text(end) }
                Button(onClick = actions.onTakeover, modifier = fill) { Text(stringResource(R.string.conversation_take_over)) }
            }
        }

        DroppedRetry.Microphone -> {
            CrowdedActions { fill ->
                FilledTonalButton(onClick = actions.onEnd, modifier = fill) { Text(end) }
                FilledTonalButton(onClick = actions.onRetry, modifier = fill) { Text(stringResource(R.string.conversation_try_again)) }
                Button(onClick = actions.onTypeInstead, modifier = fill) { Text(stringResource(R.string.conversation_type_instead)) }
            }
        }
    }
}

/** Three actions, or a long label, don't fit a phone's row: they stack. */
@Composable
private fun CrowdedActions(content: @Composable (Modifier) -> Unit) {
    if (LocalWideBar.current) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { content(Modifier) }
    } else {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) { content(Modifier.fillMaxWidth()) }
    }
}
