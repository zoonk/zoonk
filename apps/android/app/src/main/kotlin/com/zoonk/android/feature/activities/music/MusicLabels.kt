package com.zoonk.android.feature.activities.music

import android.content.res.Resources
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalResources
import com.zoonk.android.R
import com.zoonk.android.ui.format.currentLocale

/**
 * Mirrors main's `use-music-labels.ts` and `use-fretboard-labels.ts`. Names come in with "#" and "b" and an optional octave,
 * like "Eb4"; they're shown with real sharp and flat signs in the learner's notation (H for B in German) and read aloud as words.
 */
@Stable
class MusicLabels internal constructor(
    private val resources: Resources,
    private val language: String,
) {
    fun display(name: String): String = MusicNotes.displayName(MusicNotes.withoutOctave(name), language)

    fun spoken(name: String): String {
        val shown = display(name)
        val letter = shown.take(1)

        return when {
            '♯' in shown -> resources.getString(R.string.activities_music_note_sharp, letter)
            '♭' in shown -> resources.getString(R.string.activities_music_note_flat, letter)
            else -> letter
        }
    }

    fun spokenList(names: List<String>): String = names.joinToString(", ") { spoken(it) }

    fun displayList(names: List<String>): String = names.joinToString(", ") { display(it) }

    fun chord(
        root: String,
        quality: ChordQuality,
    ): String =
        resources.getString(
            when (quality) {
                ChordQuality.Augmented -> R.string.activities_music_chord_augmented
                ChordQuality.Diminished -> R.string.activities_music_chord_diminished
                ChordQuality.Dominant7 -> R.string.activities_music_chord_dominant7
                ChordQuality.Major -> R.string.activities_music_chord_major
                ChordQuality.Major7 -> R.string.activities_music_chord_major7
                ChordQuality.Minor -> R.string.activities_music_chord_minor
                ChordQuality.Minor7 -> R.string.activities_music_chord_minor7
            },
            display(root),
        )

    val stringNames: List<String> get() = OPEN_STRINGS.map(::display)

    fun string(index: Int): String =
        when (index) {
            0 -> resources.getString(R.string.activities_music_string_low_e)
            Guitar.tuning.lastIndex -> resources.getString(R.string.activities_music_string_high_e)
            else -> resources.getString(R.string.activities_music_string, spoken(OPEN_STRINGS[index]))
        }

    fun position(
        string: Int,
        fret: Int?,
    ): String {
        val note = fret?.let { spoken(MusicNotes.midiToNote(Guitar.noteMidi(string, it))) }

        return when {
            fret == null || note == null -> resources.getString(R.string.activities_music_not_played)
            fret == 0 -> resources.getString(R.string.activities_music_open_string, note)
            else -> resources.getString(R.string.activities_music_fret, fret, note)
        }
    }

    /** Each string of a guitar shape in words, low E first, like "A string: Fret 3, C". */
    fun shape(voicing: GuitarVoicing): List<String> =
        Guitar.tuning.indices.map { resources.getString(R.string.activities_music_string_position, string(it), position(it, voicing[it])) }

    private companion object {
        val OPEN_STRINGS = listOf("E", "A", "D", "G", "B", "E")
    }
}

@Composable
fun rememberMusicLabels(): MusicLabels {
    val resources = LocalResources.current
    val language = currentLocale().language
    return remember(resources, language) { MusicLabels(resources, language) }
}
