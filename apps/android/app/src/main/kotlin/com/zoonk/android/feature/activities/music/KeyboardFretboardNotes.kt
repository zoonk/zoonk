package com.zoonk.android.feature.activities.music

import com.zoonk.android.feature.activities.interaction
import com.zoonk.android.feature.player.model.ActivityAnswer
import com.zoonk.api.models.ActivityExpected
import com.zoonk.api.models.ActivityExpectedAnswer
import com.zoonk.api.models.LessonStepAnswerOneOf3AnswerOneOf6
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf31FieldsStart
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf31FieldsStartOneOf
import com.zoonk.api.models.LessonStepAnswerOneOf3Answer.LessonStepAnswerOneOf3AnswerOneOf6Value as NotesAnswerValue
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf31FieldsStart.PlayableLibraryStepAnyOfContentOneOf31FieldsStartOneOf1Value as NotesTargetValue
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf31FieldsStart.PlayableLibraryStepAnyOfContentOneOf31FieldsStartOneOfValue as ChordTargetValue

sealed interface NoteTarget {
    /** Its pitch classes, sorted, or none when a note isn't one. */
    val pitches: List<Int>

    /** Its notes as written, without octaves: a chord spelled from its root (Eb in C minor). */
    val spelling: List<String>

    data class Chord(
        val root: String,
        val quality: ChordQuality,
    ) : NoteTarget {
        override val pitches: List<Int> get() = MusicNotes.chordPitchClasses(root, quality).orEmpty()
        override val spelling: List<String> get() = MusicNotes.spellChord(root, quality)
    }

    data class Notes(
        val notes: List<String>,
    ) : NoteTarget {
        override val pitches: List<Int> get() = MusicNotes.pitchClasses(notes).orEmpty()
        override val spelling: List<String> get() = notes.map(MusicNotes::withoutOctave)
    }

    companion object {
        fun of(field: PlayableLibraryStepAnyOfContentOneOf31FieldsStart): NoteTarget =
            when (field) {
                is ChordTargetValue -> Chord(field.value.root, chordQuality(field.value.quality))
                is NotesTargetValue -> Notes(field.value.notes)
            }

        private fun chordQuality(quality: PlayableLibraryStepAnyOfContentOneOf31FieldsStartOneOf.Quality): ChordQuality =
            when (quality) {
                PlayableLibraryStepAnyOfContentOneOf31FieldsStartOneOf.Quality.AUGMENTED -> ChordQuality.Augmented
                PlayableLibraryStepAnyOfContentOneOf31FieldsStartOneOf.Quality.DIMINISHED -> ChordQuality.Diminished
                PlayableLibraryStepAnyOfContentOneOf31FieldsStartOneOf.Quality.DOMINANT7 -> ChordQuality.Dominant7
                PlayableLibraryStepAnyOfContentOneOf31FieldsStartOneOf.Quality.MAJOR -> ChordQuality.Major
                PlayableLibraryStepAnyOfContentOneOf31FieldsStartOneOf.Quality.MAJOR7 -> ChordQuality.Major7
                PlayableLibraryStepAnyOfContentOneOf31FieldsStartOneOf.Quality.MINOR -> ChordQuality.Minor
                PlayableLibraryStepAnyOfContentOneOf31FieldsStartOneOf.Quality.MINOR7 -> ChordQuality.Minor7
            }
    }
}

enum class NoteMarkKind { Correct, Heard, Kept, Missed, New, Removed, Wrong }

/** Mirrors main's `keyboard-fretboard-notes.ts`. The keyboard shows one octave from middle C: every note has one key. */
object KeyboardFretboard {
    const val KEYBOARD_FROM = 60
    const val KEYBOARD_TO = 71
    const val CHORD_GAP = 0.03
    const val STRUM_GAP = 0.04
    private const val MELODY_GAP = 0.7

    /** How each pitch class is shown: the way the target writes it (Eb in C minor), then the start, then as a chord root. */
    fun spelling(targets: List<NoteTarget?>): (Int) -> String {
        val spelled =
            targets
                .reversed()
                .flatMap { it?.spelling.orEmpty() }
                .mapNotNull { name -> MusicNotes.pitchClass(name)?.let { it to name } }
                .toMap()

        return { pitch -> spelled[Math.floorMod(pitch, MusicNotes.OCTAVE)] ?: MusicNotes.pitchClassName(pitch) }
    }

    fun toggle(
        pitches: List<Int>,
        pitch: Int,
    ): List<Int> = if (pitch in pitches) pitches - pitch else (pitches + pitch).sorted()

    fun answeringMarks(
        pressed: List<Int>,
        start: List<Int>,
    ): Map<Int, NoteMarkKind> =
        start.filterNot { it in pressed }.associate { KEYBOARD_FROM + it to NoteMarkKind.Removed } +
            pressed.associate { KEYBOARD_FROM + it to if (it in start) NoteMarkKind.Kept else NoteMarkKind.New }

    fun checkedMarks(
        expected: List<Int>,
        pressed: List<Int>,
    ): Map<Int, NoteMarkKind> =
        expected.filterNot { it in pressed }.associate { KEYBOARD_FROM + it to NoteMarkKind.Missed } +
            pressed.associate { KEYBOARD_FROM + it to if (it in expected) NoteMarkKind.Correct else NoteMarkKind.Wrong }

    /** The notes of an answer, one per pressed key, named the way core grades them. */
    fun notes(pitches: List<Int>): List<String> = pitches.map { MusicNotes.midiToNote(KEYBOARD_FROM + it) }

    /** The bass of a guitar shape: the chord's root when the notes form one, else the lowest note. */
    private fun bass(pitches: List<Int>): Int =
        MusicNotes.nameChord(pitches)?.let { MusicNotes.pitchClass(it.first) } ?: pitches.firstOrNull() ?: 0

    /** A guitar shape for the notes, or null when one hand can't play them. */
    fun voicing(pitches: List<Int>): GuitarVoicing? = if (pitches.isEmpty()) null else Guitar.voicing(bass(pitches), pitches)

    fun pitches(voicing: GuitarVoicing): List<Int> = midis(voicing).map { it % MusicNotes.OCTAVE }.distinct().sorted()

    fun midis(voicing: GuitarVoicing): List<Int> = voicing.mapIndexedNotNull { string, fret -> fret?.let { Guitar.noteMidi(string, it) } }

    /** The frets shown for a shape: from the nut unless the shape sits higher up the neck. */
    fun fretWindowStart(
        voicing: GuitarVoicing?,
        span: Int = Guitar.FRETBOARD_SPAN,
    ): Int {
        val fretted = voicing.orEmpty().filterNotNull().filter { it > 0 }
        val highest = fretted.maxOrNull() ?: 0

        return if (highest <= span) 1 else fretted.min()
    }

    /** The server's notes for the target, or the target's own before it answers. */
    fun expectedPitches(
        expected: ActivityExpected?,
        fallback: List<Int>,
    ): List<Int> =
        (expected.interaction as? ActivityExpectedAnswer.PitchclassesWrapper)?.value?.pitchClasses?.map { it.toInt() } ?: fallback

    /**
     * Where the notes start: the learner's answer when there is one, else the start, else (for a question about the target)
     * the target itself to explore. A target found by ear stays hidden until it's answered.
     */
    fun initialPitches(
        answer: ActivityAnswer?,
        isInteraction: Boolean,
        byEar: Boolean,
        start: NoteTarget?,
        target: NoteTarget,
    ): List<Int> {
        answer.notes?.let { notes -> MusicNotes.pitchClasses(notes)?.let { return it } }

        val showsTarget = !byEar && !isInteraction
        return (start ?: target.takeIf { showsTarget })?.pitches.orEmpty()
    }

    /** A chord is struck together; notes sound one after the other, each above the one before, so an interval is heard as a leap up. */
    fun targetSound(target: NoteTarget): List<MusicSound> =
        when (target) {
            is NoteTarget.Chord -> {
                MusicSound.together(MusicNotes.chordMidis(target.root, target.quality), gap = CHORD_GAP)
            }

            is NoteTarget.Notes -> {
                val midis =
                    target.notes.fold(listOf<Int>()) { played, note ->
                        val midi = MusicNotes.noteToMidi(note) ?: KEYBOARD_FROM
                        val previous = played.lastOrNull()
                        played + if (previous == null || midi > previous) midi else midi + MusicNotes.OCTAVE
                    }
                MusicSound.together(midis, gap = MELODY_GAP)
            }
        }
}

fun notesAnswer(notes: List<String>): ActivityAnswer =
    NotesAnswerValue(LessonStepAnswerOneOf3AnswerOneOf6(LessonStepAnswerOneOf3AnswerOneOf6.Kind.NOTES, notes))

val ActivityAnswer?.notes: List<String>? get() = (this as? NotesAnswerValue)?.value?.notes
