package com.zoonk.android.feature.activities.music

/** Mirrors core's `music.ts` and main's `music-notes.ts`: a pitch class is 0 for C up to 11 for B, and MIDI 60 is middle C. */
object MusicNotes {
    const val OCTAVE = 12

    /** Note letters placed on the 12 semitones of an octave from C; "_" marks the black keys. */
    private const val CHROMATIC_LETTERS = "C_D_EF_G_A_B"
    private const val LETTERS = "CDEFGAB"
    private const val DEFAULT_OCTAVE = 4

    /** How the keys are named in an answer: sharps, which core's pitch-class grading accepts. */
    private val sharpNames = listOf("C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B")

    /** Chord roots the way musicians usually write them: Eb and Bb, but F#. */
    private val rootNames = listOf("C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B")

    /** Chords stack thirds, so each tone above the root is two more letters up (C, E, G, B). */
    private const val LETTERS_PER_THIRD = 2
    private const val MAX_ACCIDENTAL = 2
    private val accidentals = mapOf(-2 to "bb", -1 to "b", 0 to "", 1 to "#", 2 to "##")
    private val notePattern = Regex("^[A-G](?:#|b)?[0-8]?$")
    private val writtenAccidental = Regex("^(?:#{1,2}|b{1,2})")

    fun isNote(note: String): Boolean = notePattern.matches(note)

    fun pitchClass(note: String): Int? =
        if (isNote(note)) Math.floorMod(CHROMATIC_LETTERS.indexOf(note[0]) + accidentalShift(note), OCTAVE) else null

    private fun accidentalShift(note: String): Int =
        when (note.getOrNull(1)) {
            '#' -> 1
            'b' -> -1
            else -> 0
        }

    /** Sorted and once each, or null when one isn't a note. */
    fun pitchClasses(notes: List<String>): List<Int>? = notes.map { pitchClass(it) ?: return null }.distinct().sorted()

    fun chordPitchClasses(
        root: String,
        quality: ChordQuality,
    ): List<Int>? {
        val rootClass = pitchClass(root) ?: return null
        return (listOf(rootClass) + quality.semitones.map { Math.floorMod(rootClass + it, OCTAVE) }).distinct().sorted()
    }

    fun midiToNote(midi: Int): String = "${sharpNames[Math.floorMod(midi, OCTAVE)]}${Math.floorDiv(midi, OCTAVE) - 1}"

    /** Notes written without an octave sit in [defaultOctave]. Cb and B# cross the octave line: Cb4 sits just below C4. */
    fun noteToMidi(
        note: String,
        defaultOctave: Int = DEFAULT_OCTAVE,
    ): Int? {
        if (pitchClass(note) == null) return null
        val octave = note.last().digitToIntOrNull() ?: defaultOctave
        return (octave + 1) * OCTAVE + CHROMATIC_LETTERS.indexOf(note[0]) + accidentalShift(note)
    }

    /** Named as a chord root would be: Eb rather than D#. */
    fun pitchClassName(pitch: Int): String = rootNames[Math.floorMod(pitch, OCTAVE)]

    fun withoutOctave(note: String): String = if (note.lastOrNull()?.isDigit() == true) note.dropLast(1) else note

    /** The note [letterSteps] letters and [distance] semitones above [root], spelled from the letter, so a minor third above C is Eb, never D#. */
    private fun spellAbove(
        root: String,
        distance: Int,
        letterSteps: Int,
    ): String {
        val rootPitch = pitchClass(root) ?: 0
        val letter = LETTERS[Math.floorMod(LETTERS.indexOf(root[0]) + letterSteps, LETTERS.length)]
        val natural = pitchClass(letter.toString()) ?: 0
        val offset = Math.floorMod(rootPitch + distance - natural + MAX_ACCIDENTAL, OCTAVE) - MAX_ACCIDENTAL

        return "$letter${accidentals[offset].orEmpty()}"
    }

    fun spellChord(
        root: String,
        quality: ChordQuality,
    ): List<String> {
        val name = withoutOctave(root)

        return listOf(name) +
            quality.semitones.mapIndexed { index, distance ->
                spellAbove(name, distance, (index + 1) * LETTERS_PER_THIRD)
            }
    }

    fun chordMidis(
        root: String,
        quality: ChordQuality,
    ): List<Int> {
        val base = noteToMidi(root) ?: 0
        return listOf(base) + quality.semitones.map { base + it }
    }

    fun nameChord(pitchClasses: List<Int>): Pair<String, ChordQuality>? {
        val target = pitchClasses.distinct().sorted()

        return rootNames.firstNotNullOfOrNull { root ->
            ChordQuality.entries.firstOrNull { chordPitchClasses(root, it) == target }?.let { root to it }
        }
    }

    fun isBlackKey(pitch: Int): Boolean = sharpNames[Math.floorMod(pitch, OCTAVE)].length > 1

    /** With real sharp and flat signs, in the learner's convention: German readers see B natural as "H" and B flat as "B". */
    fun displayName(
        name: String,
        languageCode: String,
    ): String {
        val local =
            when {
                !languageCode.startsWith("de") || !name.startsWith("B") -> name
                name.startsWith("Bb") -> "B${name.drop(2)}"
                else -> "H${name.drop(1)}"
            }
        val accidental = writtenAccidental.find(local.drop(1))?.value.orEmpty()
        val signs = accidental.replace('#', '♯').replace('b', '♭')

        return "${local.take(1)}$signs${local.drop(1 + accidental.length)}"
    }
}

/** In core's order (`CHORD_QUALITIES`), which decides the name a set of notes gets first; each with its tones' semitones above the root. */
enum class ChordQuality(
    val semitones: List<Int>,
) {
    Augmented(listOf(4, 8)),
    Diminished(listOf(3, 6)),
    Dominant7(listOf(4, 7, 10)),
    Major(listOf(4, 7)),
    Major7(listOf(4, 7, 11)),
    Minor(listOf(3, 7)),
    Minor7(listOf(3, 7, 10)),
}
