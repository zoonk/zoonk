package com.zoonk.android.feature.player.language

import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.size
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.FilledTonalIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import com.zoonk.android.R
import com.zoonk.android.feature.audio.SpeechPlayer
import com.zoonk.android.feature.audio.SpeechState
import com.zoonk.android.feature.audio.SpeechStatusIcon
import com.zoonk.android.feature.audio.SpokenAudio
import com.zoonk.android.feature.audio.SpokenText
import com.zoonk.android.feature.audio.buttonIconSize
import com.zoonk.android.feature.audio.rememberSpokenAudio
import com.zoonk.android.feature.audio.speechActionLabel
import com.zoonk.android.feature.audio.withoutFailure
import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.model.StepContent
import com.zoonk.android.feature.player.model.StepKind

/**
 * A language screen's own recording (a letter, a word, a sentence to hear). Once one has played,
 * the next screens' recordings play as they open, as on main; a recording that won't play is never
 * voiced in its place.
 */
@Stable
class PromptAudio internal constructor(
    private val audio: SpokenAudio,
    private val autoplay: () -> Boolean,
    private val autoplayed: () -> String?,
    private val onAutoplayed: (String) -> Unit,
) {
    val state: SpeechState get() = audio.state

    fun toggle(url: String) = if (audio.isBusy) audio.cancel() else play(url)

    internal fun play(url: String) = audio.speak(listOf(SpokenText(null, recording = url)))

    internal fun cancel() = audio.cancel()

    internal fun autoplays(stepId: String) = autoplay() && autoplayed() != stepId

    internal fun markAutoplayed(stepId: String) = onAutoplayed(stepId)
}

@Composable
fun rememberPromptAudio(
    speech: SpeechPlayer,
    language: String,
): PromptAudio {
    val audio = rememberSpokenAudio(speech, language)
    var autoplay by rememberSaveable { mutableStateOf(false) }
    var autoplayed by rememberSaveable { mutableStateOf<String?>(null) }
    // Main turns autoplay on once a sound has actually started.
    LaunchedEffect(audio.state) { if (audio.state == SpeechState.Playing) autoplay = true }
    return PromptAudio(audio, autoplay = { autoplay }, autoplayed = { autoplayed }, onAutoplayed = { autoplayed = it })
}

fun promptAudioUrl(step: LessonStep): String? {
    val language = step.content as? StepContent.Language ?: return null
    val exercise = language.exercise.toExercise()
    return when (language.kind) {
        StepKind.Alphabet -> (exercise.content as? ExerciseContent.Alphabet)?.content?.audioUrl
        StepKind.Listening -> exercise.sentence?.audioUrl
        StepKind.Vocabulary -> exercise.word?.audioUrl
        else -> null
    }
}

/**
 * The previous screen's sound stops, including when the lesson ends; this one's starts once a sound
 * has played before, and only once, so rotating or resizing doesn't play it again.
 */
@Composable
fun PromptAudioEffect(
    step: LessonStep?,
    prompt: PromptAudio,
) {
    LaunchedEffect(step?.id) {
        prompt.cancel()
        val id = step?.id ?: return@LaunchedEffect
        val url = promptAudioUrl(step) ?: return@LaunchedEffect
        if (prompt.autoplays(id)) {
            prompt.markAutoplayed(id)
            prompt.play(url)
        }
    }
}

/** The action bar's button for a screen that's read, such as a word or a letter. */
@Composable
fun PromptAudioIconButton(
    url: String,
    prompt: PromptAudio,
) {
    val label = speechActionLabel(prompt.state, stringResource(R.string.player_language_play_pronunciation))
    FilledTonalIconButton(onClick = { prompt.toggle(url) }, modifier = Modifier.semantics { contentDescription = label }) {
        SpeechStatusIcon(prompt.state) { PlayIcon() }
    }
}

/** Listening's own button, beside "What do you hear?". */
@Composable
internal fun PromptAudioButton(
    url: String,
    prompt: PromptAudio,
) {
    val state = prompt.state.withoutFailure()
    val playing = state == SpeechState.Playing
    val label = speechActionLabel(state, stringResource(R.string.player_language_play_pronunciation))
    FilledTonalButton(onClick = { prompt.toggle(url) }, modifier = Modifier.semantics { contentDescription = label }) {
        SpeechStatusIcon(state) { PlayIcon() }
        Spacer(Modifier.size(ButtonDefaults.IconSpacing))
        Text(stringResource(if (playing) R.string.player_language_stop else R.string.player_language_play))
    }
}

@Composable
private fun PlayIcon() =
    Icon(painterResource(R.drawable.ic_volume_up), contentDescription = null, modifier = Modifier.size(buttonIconSize()))
