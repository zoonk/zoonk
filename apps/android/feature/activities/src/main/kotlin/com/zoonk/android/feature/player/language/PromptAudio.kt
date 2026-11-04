package com.zoonk.android.feature.player.language

import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.size
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.FilledTonalIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.Stable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
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
import com.zoonk.android.feature.player.steps.listeningInstead
import com.zoonk.android.ui.components.OutlinedButton

/**
 * A language screen's own recording (a letter, a word, a sentence to hear), which plays as its screen
 * opens, as on main; a recording that won't play is never voiced in its place.
 */
@Stable
class PromptAudio internal constructor(
    private val audio: SpokenAudio,
    private val autoplayed: MutableState<String?>,
) {
    val state: SpeechState get() = audio.state

    fun toggle(url: String) = if (audio.isBusy) audio.cancel() else play(url)

    private fun play(url: String) = audio.speak(listOf(SpokenText(null, recording = url)))

    internal fun cancel() = audio.cancel()

    internal fun autoplay(
        stepId: String,
        url: String,
    ) {
        if (autoplayed.value == stepId) return
        autoplayed.value = stepId
        play(url)
    }

    internal fun forget() {
        autoplayed.value = null
    }
}

@Composable
fun rememberPromptAudio(
    speech: SpeechPlayer,
    language: String,
): PromptAudio {
    val audio = rememberSpokenAudio(speech, language)
    val autoplayed = rememberSaveable { mutableStateOf<String?>(null) }
    return PromptAudio(audio, autoplayed)
}

fun promptAudioUrl(step: LessonStep): String? = (step.content as? StepContent.Language)?.let { promptAudioUrl(it) }

fun promptAudioUrl(language: StepContent.Language): String? {
    val exercise = language.exercise.toExercise()
    return when (language.kind) {
        StepKind.Alphabet -> (exercise.content as? ExerciseContent.Alphabet)?.content?.audioUrl
        StepKind.Listening -> exercise.sentence?.audioUrl
        StepKind.Vocabulary -> exercise.word?.audioUrl
        else -> null
    }
}

/**
 * The previous screen's sound stops, including when the lesson ends; this one's starts once per
 * visit, so going back plays it again while rotating or resizing doesn't. A spoken screen's listening exercise, shown when the
 * learner can't talk, plays each time they switch to it and stops when they switch back, as on main.
 */
@Composable
fun PromptAudioEffect(
    step: LessonStep?,
    cantTalk: Boolean,
    prompt: PromptAudio,
) {
    val url = step?.let { shownPromptUrl(it, cantTalk) }
    LaunchedEffect(step?.id, url) {
        prompt.cancel()
        val id = step?.id ?: return@LaunchedEffect
        if (url == null) prompt.forget() else prompt.autoplay(id, url)
    }
}

private fun shownPromptUrl(
    step: LessonStep,
    cantTalk: Boolean,
): String? =
    when (val content = step.content) {
        is StepContent.SpokenAnswer -> content.listeningInstead(cantTalk)?.let { promptAudioUrl(it) }
        else -> promptAudioUrl(step)
    }

@Composable
fun PromptAudioIconButton(
    url: String,
    prompt: PromptAudio,
) {
    val label = pronunciationLabel(prompt.state)
    FilledTonalIconButton(onClick = { prompt.toggle(url) }, modifier = Modifier.semantics { contentDescription = label }) {
        SpeechStatusIcon(prompt.state) { PlayIcon() }
    }
}

/** A quieter copy of the action bar's button, at the word where learners look first; the bar's stays for the thumb. */
@Composable
internal fun PromptAudioInlineButton(
    url: String,
    prompt: PromptAudio,
) {
    val label = pronunciationLabel(prompt.state)
    val color = if (prompt.state == SpeechState.Playing) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant
    IconButton(
        onClick = { prompt.toggle(url) },
        modifier = Modifier.semantics { contentDescription = label },
        colors = IconButtonDefaults.iconButtonColors(contentColor = color),
    ) {
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
    val label = pronunciationLabel(state)
    OutlinedButton(onClick = { prompt.toggle(url) }, modifier = Modifier.semantics { contentDescription = label }) {
        SpeechStatusIcon(state) { PlayIcon() }
        Spacer(Modifier.size(ButtonDefaults.IconSpacing))
        Text(stringResource(if (playing) R.string.player_language_stop else R.string.player_language_play))
    }
}

@Composable
private fun pronunciationLabel(state: SpeechState) = speechActionLabel(state, stringResource(R.string.player_language_play_pronunciation))

@Composable
private fun PlayIcon() =
    Icon(painterResource(R.drawable.ic_volume_up), contentDescription = null, modifier = Modifier.size(buttonIconSize()))
