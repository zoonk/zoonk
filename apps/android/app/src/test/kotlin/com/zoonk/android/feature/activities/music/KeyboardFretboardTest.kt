package com.zoonk.android.feature.activities.music

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** Expected values come from running main's `keyboard-fretboard-notes.ts`. */
class KeyboardFretboardTest {
    private val cMinor = NoteTarget.Chord("C", ChordQuality.Minor)
    private val cMajor = NoteTarget.Chord("C", ChordQuality.Major)

    @Test
    fun targetsReadAsPitchClasses() {
        assertEquals(listOf(0, 3, 7), cMinor.pitches)
        assertEquals(listOf(2, 7, 11), NoteTarget.Notes(listOf("G", "B", "D4")).pitches)
    }

    @Test
    fun keysAreSpelledTheWayTheTargetWritesThem() {
        val spell = KeyboardFretboard.spelling(listOf(cMinor, cMajor))

        assertEquals(listOf("Eb", "E", "F#", "Bb"), listOf(3, 4, 6, 10).map(spell))
    }

    @Test
    fun keysToggleAndTheAnswerIsNamedForGrading() {
        assertEquals(listOf(0, 7), KeyboardFretboard.toggle(listOf(0, 4, 7), 4))
        assertEquals(listOf(0, 3, 7), KeyboardFretboard.toggle(listOf(0, 7), 3))
        assertEquals(listOf("C4", "D#4", "G4"), KeyboardFretboard.notes(listOf(0, 3, 7)))
    }

    @Test
    fun marksShowKeptNewAndRemovedNotesThenRightWrongAndMissedOnes() {
        assertEquals(
            mapOf(64 to NoteMarkKind.Removed, 60 to NoteMarkKind.Kept, 63 to NoteMarkKind.New, 67 to NoteMarkKind.Kept),
            KeyboardFretboard.answeringMarks(pressed = listOf(0, 3, 7), start = listOf(0, 4, 7)),
        )
        assertEquals(
            mapOf(63 to NoteMarkKind.Missed, 60 to NoteMarkKind.Correct, 62 to NoteMarkKind.Wrong, 67 to NoteMarkKind.Correct),
            KeyboardFretboard.checkedMarks(expected = listOf(0, 3, 7), pressed = listOf(0, 2, 7)),
        )
    }

    @Test
    fun aChordIsVoicedFromItsRootAndReadBack() {
        val shape = KeyboardFretboard.voicing(listOf(0, 3, 7))

        assertEquals(listOf(null, 3, 1, 0, 1, 3), shape)
        assertEquals(listOf(0, 3, 7), KeyboardFretboard.pitches(shape.orEmpty()))
        assertNull(KeyboardFretboard.voicing(emptyList()))
    }

    @Test
    fun theFretWindowStartsAtTheNutUnlessTheShapeSitsHigher() {
        assertEquals(1, KeyboardFretboard.fretWindowStart(listOf(null, 3, 1, 0, 1, 3)))
        assertEquals(7, KeyboardFretboard.fretWindowStart(listOf(null, 7, 9, 9, 8, 7)))
        assertEquals(1, KeyboardFretboard.fretWindowStart(null))
    }

    @Test
    fun aTargetFoundByEarStaysHiddenUntilAnswered() {
        assertEquals(
            emptyList<Int>(),
            KeyboardFretboard.initialPitches(null, isInteraction = false, byEar = true, start = null, target = cMinor),
        )
        assertEquals(
            listOf(0, 3, 7),
            KeyboardFretboard.initialPitches(null, isInteraction = false, byEar = false, start = null, target = cMinor),
        )
        assertEquals(
            listOf(0, 4, 7),
            KeyboardFretboard.initialPitches(null, isInteraction = true, byEar = false, start = cMajor, target = cMinor),
        )
        assertEquals(
            listOf(0, 7),
            KeyboardFretboard.initialPitches(
                notesAnswer(listOf("G4", "C4")),
                isInteraction = true,
                byEar = false,
                start = cMajor,
                target = cMinor,
            ),
        )
    }

    @Test
    fun aChordSoundsTogetherAndNotesOneAfterTheOtherEachAboveTheLast() {
        assertEquals(
            listOf(MusicSound(0.0, 69), MusicSound(0.03, 72), MusicSound(0.06, 76)),
            KeyboardFretboard.targetSound(NoteTarget.Chord("A", ChordQuality.Minor)).map { it.copy(at = Math.round(it.at * 100) / 100.0) },
        )
        assertEquals(
            listOf(MusicSound(0.0, 60), MusicSound(0.7, 67), MusicSound(1.4, 76)),
            KeyboardFretboard.targetSound(NoteTarget.Notes(listOf("C", "G", "E"))).map { it.copy(at = Math.round(it.at * 10) / 10.0) },
        )
    }
}
