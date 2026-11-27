package com.zoonk.android.feature.player.language

import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.MaterialTheme
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
import com.zoonk.android.feature.player.engine.LessonPlayerState
import com.zoonk.android.feature.player.engine.isReadStep
import com.zoonk.android.feature.player.engine.shownStep
import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.model.StepContent
import com.zoonk.android.feature.player.model.StepKind
import com.zoonk.android.feature.player.steps.StepActions
import com.zoonk.android.ui.components.OutlinedIconButton
import com.zoonk.android.ui.components.TakeTaskBarKey
import com.zoonk.android.ui.components.TaskBarKey

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

fun promptAudioUrl(
    language: StepContent.Language,
    cantListen: Boolean,
): String? {
    val exercise = language.exercise.toExercise() ?: return null
    return when (language.kind) {
        StepKind.Alphabet -> (exercise.content as? ExerciseContent.Alphabet)?.content?.audioUrl
        StepKind.Listening -> exercise.sentence?.let { listeningAudioUrl(it, cantListen) }
        StepKind.Vocabulary -> exercise.word?.audioUrl
        else -> null
    }
}

/** A listening sentence's recording, which stays quiet for a learner who can't listen today: they read the sentence instead. */
internal fun listeningAudioUrl(
    sentence: ExerciseSentence,
    cantListen: Boolean,
): String? = sentence.audioUrl?.takeUnless { cantListen }

/**
 * The previous screen's sound stops, including when the lesson ends; this one's starts once per
 * visit, so going back plays it again while rotating or resizing doesn't. A spoken screen's listening exercise, shown when the
 * learner can't talk, plays each time they switch to it and stops when they switch back, as on main, and an answered one plays
 * only when it was answered by ear; a learner who can't listen today hears neither, and the sound plays again once they can.
 */
@Composable
fun PromptAudioEffect(
    step: LessonStep?,
    state: LessonPlayerState?,
    cantTalk: Boolean,
    cantListen: Boolean,
    prompt: PromptAudio,
) {
    val url = if (step == null || state == null) null else shownPromptUrl(step, state, cantTalk, cantListen)
    LaunchedEffect(step?.id, url) {
        prompt.cancel()
        val id = step?.id ?: return@LaunchedEffect
        if (url == null) prompt.forget() else prompt.autoplay(id, url)
    }
}

internal fun shownPromptUrl(
    step: LessonStep,
    state: LessonPlayerState,
    cantTalk: Boolean,
    cantListen: Boolean,
): String? = (state.shownStep(step, cantTalk, cantListen).content as? StepContent.Language)?.let { promptAudioUrl(it, cantListen) }

/**
 * The bar's sound, between back and the main action, which P plays and pauses too, as on main: the word or letter a reading
 * screen shows, or the sentence a listening screen asks about, which stays quiet once the learner can't listen. Listening says
 * on its screen when its sentence didn't play, with that note's Try again.
 */
@Composable
fun PromptAudioBarButton(
    step: LessonStep,
    lesson: LessonPlayerState,
    actions: StepActions,
    prompt: PromptAudio,
) {
    val url = shownPromptUrl(step, lesson, actions.cantTalk, actions.cantListen) ?: return
    val state = if (step.isReadStep) prompt.state else prompt.state.withoutFailure()
    val label = pronunciationLabel(state)
    val toggle = { prompt.toggle(url) }
    TakeTaskBarKey(TaskBarKey.Sound, toggle)
    OutlinedIconButton(onClick = toggle, modifier = Modifier.semantics { contentDescription = label }) {
        SpeechStatusIcon(state) { PlayIcon() }
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

@Composable
private fun pronunciationLabel(state: SpeechState) = speechActionLabel(state, stringResource(R.string.player_language_play_pronunciation))

@Composable
private fun PlayIcon() =
    Icon(painterResource(R.drawable.ic_volume_up), contentDescription = null, modifier = Modifier.size(buttonIconSize()))
