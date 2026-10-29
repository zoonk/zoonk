package com.zoonk.android.feature.audio

import androidx.activity.compose.LocalActivity
import androidx.annotation.DrawableRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.size
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.intl.LocaleList
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LimitActions
import com.zoonk.android.ui.components.LimitSubject
import com.zoonk.android.ui.components.limitMessage
import java.util.UUID

/** What a screen's listen buttons read and do; the clip is asked for only in [speak], from a tap. */
class SpokenAudio internal constructor(
    private val player: SpeechPlayer,
    private val owner: String,
    private val language: String,
    val state: SpeechState,
    /** The segment playing or about to, while [state] isn't idle. */
    val segment: Int,
) {
    val isBusy: Boolean
        get() = state == SpeechState.Loading || state == SpeechState.Playing

    fun speak(
        segments: List<SpokenText>,
        rate: Float = 1f,
        onDone: () -> Unit = {},
    ) = player.speak(owner, language, segments, rate, onDone)

    fun cancel() = player.stop(owner)
}

/** The sound stops when the screen leaves, and keeps playing through rotation. */
@Composable
fun rememberSpokenAudio(
    player: SpeechPlayer,
    language: String,
): SpokenAudio {
    val owner = rememberSaveable { UUID.randomUUID().toString() }
    val activity = LocalActivity.current
    val playback by player.playback.collectAsState()
    DisposableEffect(player, owner) {
        onDispose { if (activity?.isChangingConfigurations != true) player.stop(owner) }
    }
    val mine = playback?.takeIf { it.owner == owner }
    return SpokenAudio(player, owner, language, mine?.state ?: SpeechState.Idle, mine?.segment ?: 0)
}

/**
 * Plays [segments] on tap and stops them on the next one. A screen that shows [SpeechFailedNote]
 * passes `audio.state.withoutFailure()` as [state], so the note's Try again is the only retry.
 * Two buttons with their own [SpokenAudio] (normal and slow) stop each other, since one sound
 * plays at a time.
 */
@Composable
fun ListenButton(
    audio: SpokenAudio,
    segments: List<SpokenText>,
    label: String,
    modifier: Modifier = Modifier,
    state: SpeechState = audio.state,
    rate: Float = 1f,
    @DrawableRes icon: Int = R.drawable.ic_volume_up,
) {
    val description = if (state == SpeechState.Idle) null else speechActionLabel(state, label)
    FilledTonalButton(
        onClick = { if (audio.isBusy) audio.cancel() else audio.speak(segments, rate) },
        modifier = modifier.semantics { description?.let { stateDescription = it } },
    ) {
        SpeechStatusIcon(state) { Icon(painterResource(icon), contentDescription = null, modifier = Modifier.size(buttonIconSize())) }
        Spacer(Modifier.size(ButtonDefaults.IconSpacing))
        Text(label)
    }
}

/** The note beside the button says why it failed and offers the retry. */
fun SpeechState.withoutFailure(): SpeechState = if (this is SpeechState.Failed) SpeechState.Idle else this

/** A button icon that grows with the font, since it's what tells the states apart. */
@Composable
internal fun buttonIconSize(): Dp = ButtonDefaults.IconSize * LocalDensity.current.fontScale

/** Sized for a button; [idle] should be too, with [buttonIconSize]. */
@Composable
fun SpeechStatusIcon(
    state: SpeechState,
    idle: @Composable () -> Unit,
) {
    val size = Modifier.size(buttonIconSize())
    when (state) {
        SpeechState.Loading -> CircularProgressIndicator(modifier = size, strokeWidth = 2.dp)
        SpeechState.Playing -> Icon(painterResource(R.drawable.ic_stop_filled), contentDescription = null, modifier = size)
        is SpeechState.Failed -> Icon(painterResource(R.drawable.ic_refresh), contentDescription = null, modifier = size)
        SpeechState.Idle -> idle()
    }
}

/** An icon-only listen button's name; a labeled one keeps its label and says this as its state. */
@Composable
fun speechActionLabel(
    state: SpeechState,
    idle: String,
): String =
    when (state) {
        SpeechState.Loading -> stringResource(R.string.audio_getting_ready)
        SpeechState.Playing -> stringResource(R.string.audio_stop)
        is SpeechState.Failed -> stringResource(R.string.audio_try_again_label)
        SpeechState.Idle -> idle
    }

/** [text] is what the audio says, shown when it couldn't play; a limit that only waits can't be retried. */
@Composable
fun SpeechFailedNote(
    language: String,
    limit: Limit?,
    onRetry: () -> Unit,
    navigator: AppNavigator,
    modifier: Modifier = Modifier,
    text: String? = null,
) {
    Column(
        modifier = modifier.semantics { liveRegion = LiveRegionMode.Polite },
        horizontalAlignment = Alignment.Start,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        val reason = limit?.let { limitMessage(it, LimitSubject.Help) } ?: stringResource(R.string.audio_did_not_play)
        Text(
            text = if (text == null) reason else stringResource(R.string.audio_here_is_what_it_says, reason),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
        if (text != null) {
            Text(
                text = text,
                style = MaterialTheme.typography.bodyLarge.copy(localeList = LocaleList(language), textDirection = TextDirection.Content),
                textAlign = TextAlign.Start,
            )
        }
        if (limit == null || limit is Limit.SlowDown) {
            FilledTonalButton(onClick = onRetry) {
                Icon(painterResource(R.drawable.ic_refresh), contentDescription = null, modifier = Modifier.size(buttonIconSize()))
                Spacer(Modifier.size(ButtonDefaults.IconSpacing))
                Text(stringResource(R.string.audio_try_again))
            }
        }
        limit?.let {
            LimitActions(
                it,
                onCreateAccount = { navigator.open(AppRoute.Login) },
                onSeePlus = { navigator.open(AppRoute.Subscription) },
            )
        }
    }
}
