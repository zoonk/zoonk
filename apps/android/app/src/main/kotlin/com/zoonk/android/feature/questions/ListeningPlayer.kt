package com.zoonk.android.feature.questions

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.zoonk.android.R
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DraftStore
import com.zoonk.android.feature.audio.SpeechPlayer
import com.zoonk.android.feature.audio.SpeechState
import com.zoonk.android.feature.audio.SpokenText
import com.zoonk.android.ui.components.Meter
import com.zoonk.android.ui.theme.withTabularFigures
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlin.time.TimeSource

/** A recording's plays on this device: [played] counted, [playing] while one runs, and the one restart practice gives back. */
@Serializable
data class PlaysState(
    val played: Int = 0,
    val playing: Boolean = false,
    val restart: Restart = Restart.None,
) {
    enum class Restart { None, Given, Used }
}

/**
 * Main's `useListeningPlays`: a recording's plays kept on the device, so leaving or a closed app
 * never gives one back, except a practice's one cut-off play, given back once. Exam fidelity, not
 * security: the file is public.
 */
class ListeningPlays(
    private val drafts: DraftStore,
    private val scope: CoroutineScope,
) {
    fun state(
        session: AuthenticatedSession,
        key: String,
    ): Flow<PlaysState> = handle(session, key).value.map { it ?: PlaysState() }

    fun started(
        session: AuthenticatedSession,
        key: String,
    ) = update(session, key) {
        PlaysState(
            played = it.played + 1,
            playing = true,
            restart =
                if (it.restart ==
                    PlaysState.Restart.Given
                ) {
                    PlaysState.Restart.Used
                } else {
                    it.restart
                },
        )
    }

    fun ended(
        session: AuthenticatedSession,
        key: String,
    ) = update(session, key) { it.copy(playing = false) }

    /** A play under way as the recording shows again was cut off too. */
    fun interrupted(
        session: AuthenticatedSession,
        key: String,
        restartOnce: Boolean,
    ) = update(session, key) {
        when {
            !it.playing -> {
                it
            }

            restartOnce && it.restart == PlaysState.Restart.None -> {
                PlaysState(
                    played = it.played - 1,
                    playing = false,
                    restart = PlaysState.Restart.Given,
                )
            }

            else -> {
                it.copy(playing = false)
            }
        }
    }

    private fun update(
        session: AuthenticatedSession,
        key: String,
        change: (PlaysState) -> PlaysState,
    ) {
        scope.launch {
            val handle = handle(session, key)
            val state = handle.value.first() ?: PlaysState()
            val next = change(state)
            if (next != state) handle.save(next)
        }
    }

    private fun handle(
        session: AuthenticatedSession,
        key: String,
    ) = drafts.open(session, "listening:$key", PlaysState.serializer())
}

/** The questions a recording's set asks, so the learner reads them before it plays; [current] is the one on screen. */
data class ListeningQuestions(
    val current: Int,
    val prompts: List<String>,
)

/**
 * Main's `ListeningStimulus`: a recording heard as in the exam, a set number of times from its
 * start, never paused, a play counted once its sound starts. The questions to read first fold away
 * after the first play, and the transcript shows once the set is answered (then plays are free).
 * [count] counts a play elsewhere too (a mock's server) and is false when none were left there,
 * which stops the sound; [plays] are this device's.
 */
@Composable
fun ListeningStimulus(
    listening: ItemSet.Listening,
    playsKey: String,
    session: AuthenticatedSession,
    speech: SpeechPlayer,
    plays: ListeningPlays,
    modifier: Modifier = Modifier,
    countedElsewhere: Int = 0,
    count: (suspend () -> Boolean)? = null,
    practice: Boolean = false,
    questions: ListeningQuestions? = null,
) {
    val audio = listening.audio ?: return
    val local by remember(playsKey, session) { plays.state(session, playsKey) }.collectAsStateWithLifecycle(PlaysState())
    val played = maxOf(local.played, countedElsewhere)
    val answered = listening.transcript != null
    var toggled by rememberSaveable(playsKey) { mutableStateOf<Boolean?>(null) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(playsKey, session) { plays.interrupted(session, playsKey, restartOnce = practice) }

    Column(modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        listening.task?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium) }

        ListeningPlayer(
            url = audio.url,
            durationMs = audio.durationMs,
            title = listening.title,
            played = played,
            plays = if (answered) null else listening.plays,
            restarted = local.restart == PlaysState.Restart.Given,
            speech = speech,
            onPlayed = { stop ->
                toggled = null
                plays.started(session, playsKey)
                count?.let { scope.launch { if (!it()) stop() } }
            },
            onEnded = { plays.ended(session, playsKey) },
            onInterrupted = { plays.interrupted(session, playsKey, restartOnce = practice) },
        )

        if (questions != null && questions.prompts.size > 1 && !answered) {
            val open = toggled ?: (played == 0)
            Fold(pluralStringResource(R.plurals.listening_questions, questions.prompts.size, questions.prompts.size), open, onToggle = {
                toggled =
                    !open
            }) {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    questions.prompts.forEachIndexed { index, prompt ->
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            val current = index == questions.current
                            val color = if (current) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant
                            Text("${index + 1}.", color = color, style = MaterialTheme.typography.bodyMedium.withTabularFigures())
                            ItemLine(
                                prompt,
                                style =
                                    MaterialTheme.typography.bodyMedium.copy(
                                        color = color,
                                        fontWeight = if (current) FontWeight.Medium else FontWeight.Normal,
                                    ),
                            )
                        }
                    }
                }
            }
        }

        listening.transcript?.let { transcript ->
            var open by rememberSaveable(playsKey) { mutableStateOf(false) }
            Fold(stringResource(R.string.listening_transcript), open, onToggle = { open = !open }) {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    transcript.forEachIndexed { index, turn ->
                        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            if (transcript.getOrNull(index - 1)?.speaker !=
                                turn.speaker
                            ) {
                                Text(turn.speaker, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
                            }
                            Text(turn.text, style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                }
            }
        }
    }
}

/**
 * Main's `ListeningPlayer`. [plays] null is review: play and stop freely. [onPlayed] gets a way to
 * stop the sound, for a play counted nowhere else.
 */
@Composable
private fun ListeningPlayer(
    url: String,
    durationMs: Long?,
    title: String?,
    played: Int,
    plays: Int?,
    restarted: Boolean,
    speech: SpeechPlayer,
    onPlayed: (stop: () -> Unit) -> Unit,
    onEnded: () -> Unit,
    onInterrupted: () -> Unit,
) {
    val owner = remember { Any() }
    val playback by speech.playback.collectAsStateWithLifecycle()
    val state = playback?.takeIf { it.owner == owner }?.state ?: SpeechState.Idle
    var startedAt by remember { mutableStateOf<TimeSource.Monotonic.ValueTimeMark?>(null) }
    var elapsedMs by remember { mutableStateOf(0L) }
    val review = plays == null
    val usedUp = plays != null && played >= plays
    val playing = state == SpeechState.Playing
    val loading = state == SpeechState.Loading

    DisposableEffect(owner) { onDispose { speech.stop(owner) } }

    LaunchedEffect(startedAt) {
        val start = startedAt ?: return@LaunchedEffect
        while (true) {
            elapsedMs = start.elapsedNow().inWholeMilliseconds
            delay(TICK_MS)
        }
    }

    var ended by remember { mutableStateOf(false) }

    // A play counts once its sound starts; one that stops short of its end was cut off.
    LaunchedEffect(state) {
        when {
            state == SpeechState.Playing && startedAt == null -> {
                startedAt = TimeSource.Monotonic.markNow()
                if (!review) onPlayed { speech.stop(owner) }
            }

            state != SpeechState.Playing && state != SpeechState.Loading && startedAt != null -> {
                startedAt = null
                if (ended) {
                    onEnded()
                } else if (!review) {
                    onInterrupted()
                }
            }
        }
    }

    fun play() {
        elapsedMs = 0
        ended = false
        speech.speak(owner, language = "", segments = listOf(SpokenText(text = null, recording = url))) { ended = true }
    }

    OutlinedCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                val label =
                    when {
                        playing && review -> stringResource(R.string.listening_stop)
                        playing -> stringResource(R.string.listening_playing)
                        played > 0 -> stringResource(R.string.listening_play_again)
                        else -> stringResource(R.string.listening_play)
                    }
                FilledIconButton(
                    onClick = { if (playing && review) speech.stop(owner) else play() },
                    enabled = (playing && review) || !(usedUp || playing || loading),
                    modifier = Modifier.size(48.dp).semantics { contentDescription = label },
                ) {
                    Icon(
                        painterResource(
                            when {
                                playing && review -> R.drawable.ic_stop_filled
                                played > 0 && !review -> R.drawable.ic_replay
                                else -> R.drawable.ic_play_arrow
                            },
                        ),
                        contentDescription = null,
                    )
                }
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(painterResource(R.drawable.ic_headphones), contentDescription = null, modifier = Modifier.size(16.dp))
                        Text(
                            title ?: stringResource(R.string.listening_recording),
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.Medium,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                    val total = durationMs ?: 0
                    Meter(if (total > 0) elapsedMs / total.toFloat() else 0f)
                    Text(
                        stringResource(R.string.listening_elapsed, formatClock(elapsedMs), formatClock(total)),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.labelSmall.withTabularFigures(),
                    )
                }
            }

            Text(
                text =
                    when {
                        state is SpeechState.Failed -> stringResource(R.string.listening_failed)
                        playing && !review -> stringResource(R.string.listening_playing_note)
                        else -> playsNote(played, plays, restarted)
                    },
                modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
    }
}

@Composable
private fun playsNote(
    played: Int,
    plays: Int?,
    restarted: Boolean,
): String =
    when {
        plays == null -> stringResource(R.string.listening_note_free)
        restarted && played < plays -> stringResource(R.string.listening_note_restarted)
        played >= plays -> stringResource(R.string.listening_note_used)
        played > 0 -> stringResource(R.string.listening_note_one_more)
        plays == 1 -> stringResource(R.string.listening_note_once)
        else -> stringResource(R.string.listening_note_twice)
    }

@Composable
private fun Fold(
    label: String,
    open: Boolean,
    onToggle: () -> Unit,
    content: @Composable () -> Unit,
) {
    val state = stringResource(if (open) R.string.listening_expanded else R.string.listening_collapsed)

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        FilledTonalButton(onClick = onToggle, modifier = Modifier.semantics { stateDescription = state }) {
            Text(label)
            Icon(
                painterResource(R.drawable.ic_expand_more),
                contentDescription = null,
                modifier = Modifier.padding(start = 8.dp).size(18.dp).rotate(if (open) 180f else 0f),
            )
        }
        if (open) content()
    }
}

private const val TICK_MS = 250L
