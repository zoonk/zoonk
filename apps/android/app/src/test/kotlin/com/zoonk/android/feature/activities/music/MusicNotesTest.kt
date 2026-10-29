package com.zoonk.android.feature.activities.music

import org.junit.Assert.assertEquals
import org.junit.Test

/** Expected values come from running main's `music-notes.ts` and core's `music.ts`. */
class MusicNotesTest {
    @Test
    fun pitchClassesReadOnlyTheNotesCoreAccepts() {
        val expected =
            mapOf(
                "C" to 0,
                "C#" to 1,
                "Db" to 1,
                "B#" to 0,
                "Cb" to 11,
                "E#" to 5,
                "Fb" to 4,
                "Bb4" to 10,
                "A#0" to 10,
                "H" to null,
                "C9" to null,
                "c" to null,
                "C##" to null,
            )

        assertEquals(expected, expected.mapValues { MusicNotes.pitchClass(it.key) })
        assertEquals(listOf(0, 4, 7), MusicNotes.pitchClasses(listOf("E4", "C4", "G4", "C5")))
        assertEquals(null, MusicNotes.pitchClasses(listOf("C", "X")))
    }

    @Test
    fun midiNumbersAndNoteNamesConvertBothWays() {
        val names = mapOf(0 to "C-1", 21 to "A0", 59 to "B3", 60 to "C4", 61 to "C#4", 70 to "A#4", 108 to "C8", 127 to "G9", -1 to "B-2")
        val midis = mapOf("C4" to 60, "A4" to 69, "Cb4" to 59, "B#3" to 60, "Eb" to 63, "F#2" to 42, "Bb0" to 22, "X4" to null)

        assertEquals(names, names.mapValues { MusicNotes.midiToNote(it.key) })
        assertEquals(midis, midis.mapValues { MusicNotes.noteToMidi(it.key) })
        assertEquals(72, MusicNotes.noteToMidi("C", defaultOctave = 5))
    }

    @Test
    fun pitchClassesAreNamedAsChordRoots() {
        val expected = mapOf(0 to "C", 1 to "Db", 3 to "Eb", 6 to "F#", 8 to "Ab", 10 to "Bb", 11 to "B", 13 to "Db", -1 to "B")

        assertEquals(expected, expected.mapValues { MusicNotes.pitchClassName(it.key) })
    }

    @Test
    fun chordsAreSpelledFromTheirLettersAndPlayedFromTheRoot() {
        val chords =
            listOf(
                Triple("C", ChordQuality.Major, listOf("C", "E", "G")),
                Triple("C", ChordQuality.Minor, listOf("C", "Eb", "G")),
                Triple("D", ChordQuality.Dominant7, listOf("D", "F#", "A", "C")),
                Triple("Eb", ChordQuality.Major7, listOf("Eb", "G", "Bb", "D")),
                Triple("F#", ChordQuality.Minor7, listOf("F#", "A", "C#", "E")),
                Triple("B", ChordQuality.Diminished, listOf("B", "D", "F")),
                Triple("Ab", ChordQuality.Augmented, listOf("Ab", "C", "E")),
                Triple("G4", ChordQuality.Dominant7, listOf("G", "B", "D", "F")),
                Triple("Db", ChordQuality.Minor, listOf("Db", "Fb", "Ab")),
                Triple("E", ChordQuality.Augmented, listOf("E", "G#", "B#")),
            )
        val midis =
            listOf(
                listOf(60, 64, 67),
                listOf(60, 63, 67),
                listOf(62, 66, 69, 72),
                listOf(63, 67, 70, 74),
                listOf(66, 69, 73, 76),
                listOf(71, 74, 77),
                listOf(68, 72, 76),
                listOf(67, 71, 74, 77),
                listOf(61, 64, 68),
                listOf(64, 68, 72),
            )
        val pitchClasses =
            listOf(
                listOf(0, 4, 7),
                listOf(0, 3, 7),
                listOf(0, 2, 6, 9),
                listOf(2, 3, 7, 10),
                listOf(1, 4, 6, 9),
                listOf(2, 5, 11),
                listOf(0, 4, 8),
                listOf(2, 5, 7, 11),
                listOf(1, 4, 8),
                listOf(0, 4, 8),
            )

        assertEquals(chords.map { it.third }, chords.map { MusicNotes.spellChord(it.first, it.second) })
        assertEquals(midis, chords.map { MusicNotes.chordMidis(it.first, it.second) })
        assertEquals(pitchClasses, chords.map { MusicNotes.chordPitchClasses(it.first, it.second) })
    }

    @Test
    fun aSetOfPitchClassesTakesTheFirstChordNameThatFits() {
        assertEquals("C" to ChordQuality.Major, MusicNotes.nameChord(listOf(0, 4, 7)))
        assertEquals("C" to ChordQuality.Major, MusicNotes.nameChord(listOf(7, 0, 4)))
        assertEquals("C" to ChordQuality.Minor, MusicNotes.nameChord(listOf(0, 3, 7)))
        assertEquals("D" to ChordQuality.Dominant7, MusicNotes.nameChord(listOf(2, 6, 9, 0)))
        assertEquals("C" to ChordQuality.Augmented, MusicNotes.nameChord(listOf(0, 4, 8)))
        assertEquals("C" to ChordQuality.Diminished, MusicNotes.nameChord(listOf(0, 3, 6)))
        assertEquals("B" to ChordQuality.Diminished, MusicNotes.nameChord(listOf(11, 2, 5)))
        assertEquals(null, MusicNotes.nameChord(listOf(0, 1)))
    }

    @Test
    fun blackKeysAreThePitchesWhosePlainNameNeedsASharp() {
        assertEquals(listOf(1, 3, 6, 8, 10), (0..12).filter { MusicNotes.isBlackKey(it) })
    }

    @Test
    fun noteNamesShowRealSignsAndTheGermanH() {
        val expected =
            listOf(
                Triple("C#", "en", "C♯"),
                Triple("Eb", "en", "E♭"),
                Triple("Bb", "de", "B"),
                Triple("B", "de", "H"),
                Triple("B", "en", "B"),
                Triple("F##", "en", "F♯♯"),
                Triple("Ebb", "pt", "E♭♭"),
                Triple("Bb", "de-AT", "B"),
                Triple("C#4", "en", "C♯4"),
            )

        assertEquals(expected.map { it.third }, expected.map { MusicNotes.displayName(it.first, it.second) })
    }
}
