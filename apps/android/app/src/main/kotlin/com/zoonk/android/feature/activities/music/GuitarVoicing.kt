package com.zoonk.android.feature.activities.music

/** One fret per string, low E first; null is a string that isn't played. */
typealias GuitarVoicing = List<Int?>

/** Mirrors main's `guitar-voicing.ts`. */
object Guitar {
    /** Open strings from the low E to the high E (E2 A2 D3 G3 B3 E4). */
    val tuning = listOf(40, 45, 50, 55, 59, 64)

    /** Frets shown at once: one hand's reach plus one. */
    const val FRETBOARD_SPAN = 4

    const val HIGHEST_WINDOW = 12

    val unplayed: GuitarVoicing = tuning.map { null }

    private const val HAND_SPAN = 4
    private const val MAX_FINGERS = 4
    private const val HIGHEST_POSITION = 10

    fun noteMidi(
        string: Int,
        fret: Int,
    ): Int = tuning[string] + fret

    private fun pitch(
        string: Int,
        fret: Int,
    ): Int = noteMidi(string, fret) % MusicNotes.OCTAVE

    /** Fretted notes need fingers; the lowest fret can be barred when nothing open sits under it. */
    private fun fingersNeeded(voicing: GuitarVoicing): Int {
        val fretted = voicing.withIndex().filter { (it.value ?: 0) > 0 }
        val lowest = fretted.minOfOrNull { it.value ?: 0 } ?: return 0
        val barred = fretted.filter { it.value == lowest }
        val openUnderBarre = voicing.subList(barred.first().index, barred.last().index + 1).any { it == 0 }
        val canBarre = barred.size > 1 && !openUnderBarre

        return if (canBarre) fretted.size - barred.size + 1 else fretted.size
    }

    /** Strings that sound must be next to each other, so a strum reaches them all. */
    private fun isContiguous(voicing: GuitarVoicing): Boolean {
        val played = voicing.indices.filter { voicing[it] != null }
        return played.isEmpty() || played.size == played.last() - played.first() + 1
    }

    private fun isPlayable(
        voicing: GuitarVoicing,
        bass: Int,
        pitchClasses: List<Int>,
    ): Boolean {
        val sounding = voicing.mapIndexedNotNull { string, fret -> fret?.let { pitch(string, it) } }

        return sounding.firstOrNull() == bass &&
            sounding.containsAll(pitchClasses) &&
            isContiguous(voicing) &&
            fingersNeeded(voicing) <= MAX_FINGERS
    }

    /** Lower is better: full and near the nut together (each string played is worth a fret of reach), then nearer the nut, then easier to finger. */
    private fun cost(voicing: GuitarVoicing): List<Int> {
        val frets = voicing.filterNotNull()
        val highest = maxOf(0, frets.maxOrNull() ?: 0)

        return listOf(highest - frets.size, highest, fingersNeeded(voicing), frets.sum())
    }

    private fun isCheaper(
        first: List<Int>,
        second: List<Int>,
    ): Boolean {
        val index = first.indices.firstOrNull { first[it] != second[it] } ?: return false
        return first[index] < second[index]
    }

    private fun voicings(
        position: Int,
        pitchClasses: List<Int>,
    ): List<GuitarVoicing> {
        val frets = (listOf(0) + (position until position + HAND_SPAN)).distinct()
        val options = tuning.indices.map { string -> listOf(null) + frets.filter { pitch(string, it) in pitchClasses } }

        return options.fold(listOf(emptyList())) { partials, choices ->
            partials.flatMap { partial -> choices.map { partial + it } }
        }
    }

    /** A playable shape for these pitch classes with [bass] as the lowest note (the chord's root, or the lowest key pressed), or null when one hand can't reach them all. */
    fun voicing(
        bass: Int,
        pitchClasses: List<Int>,
    ): GuitarVoicing? {
        if (pitchClasses.isEmpty() || pitchClasses.size > tuning.size) return null

        var best: Pair<GuitarVoicing, List<Int>>? = null

        for (position in 1..HIGHEST_POSITION) {
            for (voicing in voicings(position, pitchClasses)) {
                if (!isPlayable(voicing, bass, pitchClasses)) continue
                val voicingCost = cost(voicing)
                if (best == null || isCheaper(voicingCost, best.second)) best = voicing to voicingCost
            }
        }

        return best?.first
    }
}
