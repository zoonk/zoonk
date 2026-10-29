package com.zoonk.android.feature.activities.music

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedIconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.isTraversalGroup
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.activities.ActivityBadge
import com.zoonk.android.feature.activities.ActivityCanvas
import com.zoonk.android.feature.activities.ActivityCanvasLabel
import com.zoonk.android.feature.activities.ActivityProps
import com.zoonk.android.feature.activities.ActivityRenderer
import com.zoonk.android.feature.player.model.ActivityStepContent
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf31Fields
import com.zoonk.api.models.PlayableLibraryStepAnyOfContent.PlayableLibraryStepAnyOfContentOneOf31Value as KeyboardFretboardContent
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOfCheck.PlayableLibraryStepAnyOfContentOneOfCheckOneOf1Value as InteractionCheckValue

val keyboardFretboardRenderer =
    ActivityRenderer(
        badge = { content ->
            if (fields(content).byEar == true) {
                ActivityBadge(R.string.activities_music_badge_ear_training, R.drawable.ic_hearing)
            } else {
                ActivityBadge(R.string.activities_music_badge_play_it, R.drawable.ic_piano)
            }
        },
        canvas = { KeyboardFretboardActivity(it) },
    )

private fun fields(content: ActivityStepContent) = (content as KeyboardFretboardContent).value.fields

/** What both boards read from the step: the answer, graded by pitch class; with a choice check the instrument is free to explore. */
private class Board(
    props: ActivityProps,
) {
    private val fields = fields(props.content)
    val target = NoteTarget.of(fields.target)
    val start = fields.start?.let(NoteTarget::of)
    val byEar = fields.byEar == true
    val showsGuitar = PlayableLibraryStepAnyOfContentOneOf31Fields.Instruments.GUITAR in fields.instruments
    val showsPiano = PlayableLibraryStepAnyOfContentOneOf31Fields.Instruments.PIANO in fields.instruments
    val isInteraction = (props.content as KeyboardFretboardContent).value.check is InteractionCheckValue

    /** A target found by ear shows once answered, even when the question only asked to name it. */
    val showsAnswer = props.isChecked && (isInteraction || byEar)
    val spell = KeyboardFretboard.spelling(listOf(target, start))
    val expected = KeyboardFretboard.expectedPitches(props.expected, target.pitches)
    val initialPitches = KeyboardFretboard.initialPitches(props.answer, isInteraction, byEar, start, target)
}

@Composable
private fun KeyboardFretboardActivity(props: ActivityProps) {
    val board = Board(props)
    val audio = rememberMusicAudio()
    val labels = rememberMusicLabels()

    ActivityCanvas {
        if (board.showsPiano) PianoBoard(props, board, audio, labels) else GuitarOnlyBoard(props, board, audio, labels)
        MusicSoundNote(audio)
    }
}

@Composable
private fun PianoBoard(
    props: ActivityProps,
    board: Board,
    audio: MusicAudio,
    labels: MusicLabels,
) {
    var pressed by rememberSaveable { mutableStateOf(board.initialPitches) }
    val shown = if (board.showsAnswer) board.expected else pressed
    val marks =
        if (board.showsAnswer) {
            KeyboardFretboard.checkedMarks(shown, if (board.isInteraction) pressed else shown)
        } else {
            KeyboardFretboard.answeringMarks(pressed, board.start?.pitches.orEmpty())
        }

    fun press(midi: Int) {
        val pitch = midi % MusicNotes.OCTAVE
        val next = KeyboardFretboard.toggle(pressed, pitch)
        pressed = next

        if (pitch in next) audio.play(listOf(MusicSound(0.0, midi)), MusicInstrument.Piano) else audio.stop()
        if (board.isInteraction) props.onAnswerChange(next.takeIf { it.isNotEmpty() }?.let { notesAnswer(KeyboardFretboard.notes(it)) })
    }

    KeyboardFretboardHeader(
        board = board,
        notes = shown.map(board.spell),
        isRevealed = props.isChecked,
        labels = labels,
        onPlayTarget = { audio.play(KeyboardFretboard.targetSound(board.target), MusicInstrument.Piano) },
        onHear = {
            audio.play(
                MusicSound.together(shown.map { KeyboardFretboard.KEYBOARD_FROM + it }, gap = KeyboardFretboard.CHORD_GAP),
                MusicInstrument.Piano,
            )
        },
    )

    PianoKeyboard(
        label = stringResource(R.string.activities_music_piano_keys),
        marks = marks,
        nameOf = { labels.display(board.spell(it)) },
        spokenNameOf = { labels.spoken(board.spell(it)) },
        isPressed = { it % MusicNotes.OCTAVE in pressed },
        onPress = if (props.isChecked) null else ::press,
        enabled = !props.isLocked,
    )

    if (board.showsGuitar) GuitarMirror(shown, board.spell, isChecked = board.showsAnswer, labels = labels)
}

@Composable
private fun GuitarOnlyBoard(
    props: ActivityProps,
    board: Board,
    audio: MusicAudio,
    labels: MusicLabels,
) {
    var voicing by rememberSaveable { mutableStateOf(KeyboardFretboard.voicing(board.initialPitches) ?: Guitar.unplayed) }
    var firstFret by rememberSaveable { mutableIntStateOf(KeyboardFretboard.fretWindowStart(voicing)) }
    val played = KeyboardFretboard.pitches(voicing)

    fun markOf(string: Int): NoteMarkKind {
        val fret = voicing[string]
        if (!board.showsAnswer || !board.isInteraction || fret == null) return NoteMarkKind.New
        return if (Guitar.noteMidi(string, fret) % MusicNotes.OCTAVE in board.expected) NoteMarkKind.Correct else NoteMarkKind.Wrong
    }

    fun change(
        string: Int,
        fret: Int?,
    ) {
        val next = voicing.mapIndexed { index, current -> if (index == string) fret else current }
        voicing = next

        if (fret != null) audio.play(listOf(MusicSound(0.0, Guitar.noteMidi(string, fret))), MusicInstrument.Guitar)
        if (board.isInteraction) {
            val midis = KeyboardFretboard.midis(next)
            props.onAnswerChange(midis.takeIf { it.isNotEmpty() }?.let { notesAnswer(it.map(MusicNotes::midiToNote)) })
        }
    }

    KeyboardFretboardHeader(
        board = board,
        notes = played.map(board.spell),
        isRevealed = props.isChecked,
        labels = labels,
        onPlayTarget = { audio.play(KeyboardFretboard.targetSound(board.target), MusicInstrument.Guitar) },
        onHear = {
            audio.play(MusicSound.together(KeyboardFretboard.midis(voicing), gap = KeyboardFretboard.STRUM_GAP), MusicInstrument.Guitar)
        },
    )

    val strings = stringResource(R.string.activities_music_guitar_strings)
    GuitarFretboard(
        firstFret = firstFret,
        voicing = voicing,
        labels = labels,
        markOf = ::markOf,
        nameOf = { labels.display(board.spell(it)) },
        modifier =
            Modifier.semantics {
                contentDescription = strings
                isTraversalGroup = true
            },
        onChange = if (props.isChecked) null else ::change,
        enabled = !props.isLocked,
    )

    if (!props.isChecked) FretWindow(firstFret) { firstFret = it }

    if (board.showsAnswer) {
        GuitarMirror(
            board.expected,
            board.spell,
            isChecked = true,
            labels = labels,
            caption = stringResource(R.string.activities_music_answer_on_guitar),
        )
    }
}

@Composable
private fun FretWindow(
    firstFret: Int,
    onMove: (Int) -> Unit,
) {
    // The frets run left to right in every language, so the arrows do too.
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            val lower = stringResource(R.string.activities_music_lower_frets)
            val higher = stringResource(R.string.activities_music_higher_frets)

            OutlinedIconButton(onClick = { onMove(firstFret - 1) }, enabled = firstFret > 1) {
                Icon(painterResource(R.drawable.ic_chevron_left), contentDescription = lower)
            }
            Text(
                stringResource(R.string.activities_music_frets, firstFret, firstFret + Guitar.FRETBOARD_SPAN - 1),
                Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium.withTabularFigures(),
            )
            OutlinedIconButton(onClick = { onMove(firstFret + 1) }, enabled = firstFret < Guitar.HIGHEST_WINDOW) {
                Icon(painterResource(R.drawable.ic_chevron_right), contentDescription = higher)
            }
        }
    }
}

/** Found by ear, the target isn't named until it's answered; a learner who can't listen can read its notes instead. */
@Composable
private fun KeyboardFretboardHeader(
    board: Board,
    notes: List<String>,
    isRevealed: Boolean,
    labels: MusicLabels,
    onPlayTarget: () -> Unit,
    onHear: () -> Unit,
) {
    val isHidden = board.byEar && !isRevealed
    val title =
        when {
            isHidden -> {
                stringResource(R.string.activities_music_by_ear)
            }

            board.target is NoteTarget.Chord -> {
                labels.chord(board.target.root, board.target.quality)
            }

            else -> {
                val count = (board.target as NoteTarget.Notes).notes.size
                pluralStringResource(R.plurals.activities_music_note_count, count, count)
            }
        }
    val noNotes = stringResource(R.string.activities_music_no_notes)
    val spoken = if (notes.isEmpty()) noNotes else stringResource(R.string.activities_music_on_the_keys, labels.spokenList(notes))

    FlowRow(
        Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Column(Modifier.padding(end = 12.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold))
            Text(
                if (notes.isEmpty()) noNotes else labels.displayList(notes),
                Modifier.semantics {
                    contentDescription = spoken
                    liveRegion = LiveRegionMode.Polite
                },
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (board.byEar) MusicSoundButton(stringResource(R.string.activities_music_play_sound), onPlayTarget)
            MusicSoundButton(stringResource(R.string.activities_music_hear_it), onHear, enabled = notes.isNotEmpty())
        }
    }

    if (isHidden) SoundAsText(board.target, labels)
}

@Composable
private fun SoundAsText(
    target: NoteTarget,
    labels: MusicLabels,
) {
    var isShown by rememberSaveable { mutableStateOf(false) }

    if (isShown) {
        val spoken = stringResource(R.string.activities_music_sound_notes, labels.spokenList(target.spelling))
        Text(
            stringResource(R.string.activities_music_sound_notes, labels.displayList(target.spelling)),
            Modifier.semantics {
                contentDescription = spoken
                liveRegion = LiveRegionMode.Polite
            },
            style = MaterialTheme.typography.bodyMedium,
        )
    } else {
        TextButton(onClick = { isShown = true }) { Text(stringResource(R.string.activities_music_show_notes)) }
    }
}

@Composable
private fun GuitarMirror(
    pitches: List<Int>,
    spell: (Int) -> String,
    isChecked: Boolean,
    labels: MusicLabels,
    caption: String? = null,
) {
    if (pitches.isEmpty()) return

    val voicing = KeyboardFretboard.voicing(pitches)
    val title =
        when {
            caption != null -> caption
            MusicNotes.nameChord(pitches) == null -> stringResource(R.string.activities_music_same_notes_guitar)
            else -> stringResource(R.string.activities_music_same_chord_guitar)
        }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        HorizontalDivider(Modifier.padding(bottom = 4.dp))
        ActivityCanvasLabel(title)
        if (voicing == null) {
            Text(
                stringResource(R.string.activities_music_no_hand_shape),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
        } else {
            GuitarFretboard(
                firstFret = KeyboardFretboard.fretWindowStart(voicing),
                voicing = voicing,
                labels = labels,
                markOf = { if (isChecked) NoteMarkKind.Correct else NoteMarkKind.New },
                nameOf = { labels.display(spell(it)) },
            )
        }
    }
}
