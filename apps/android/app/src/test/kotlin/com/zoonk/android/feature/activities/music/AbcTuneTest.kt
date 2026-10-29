package com.zoonk.android.feature.activities.music

import org.junit.Assert.assertEquals
import org.junit.Test

/** Expected notes come from main's abcjs 6.7.1 reading the same melodies (`TimingCallbacks` after `setUpAudio`). */
class AbcTuneTest {
    @Test
    fun eachDrawnBarIsReadAloudOnceWithTheNotesItStrikes() {
        val expected =
            mapOf(
                "scale" to listOf(listOf(60, 62, 64, 65), listOf(67, 69, 71, 72), listOf(72, 71, 69, 67), listOf(65, 64, 62, 60)),
                "jig" to
                    listOf(
                        listOf(67, 69, 67, 67, 69, 71),
                        listOf(69, 71, 69, 69, 71, 74),
                        listOf(76, 74, 74, 79, 74, 74),
                        listOf(76, 74, 71, 74, 71, 69),
                        listOf(67, 69, 67, 67, 69, 71),
                        listOf(69, 71, 69, 69, 71, 74),
                        listOf(76, 74, 74, 79, 74, 71),
                        listOf(69, 67, 66, 67),
                    ),
                "endings" to listOf(listOf(62, 66, 69, 74, 78, 74), listOf(76, 73, 69), listOf(71, 69, 67, 66, 64), listOf(71, 73, 71, 69)),
                "ties" to listOf(listOf(65, 69, 72), listOf(70, 69, 67, 65), listOf(64), listOf(65)),
                "chords" to listOf(listOf(67, 71, 74, 72, 76, 79, 62, 66, 70, 72, 55, 59, 62, 67), listOf(64, 66, 67, 69, 71)),
                "bass" to listOf(listOf(46, 50, 53, 50), listOf(51, 55, 47, 48), listOf(50)),
                "chromatic" to listOf(listOf(69, 71, 73, 74, 76, 78, 80, 81, 81, 80, 78, 76), listOf(75, 76, 78, 79)),
                "rests" to listOf(listOf(64, 67), listOf(71), emptyList(), listOf(76)),
                "unitless" to listOf(listOf(60, 62, 64, 65, 67, 69, 71, 72), listOf(72, 71, 69)),
            )

        assertEquals(expected, MusicTunes.all.mapValues { AbcTune.parse(it.value).outline })
    }

    @Test
    fun theHeaderGivesTitleComposerMeterClefAndKey() {
        val chromatic = AbcTune.parse(MusicTunes.CHROMATIC)
        val bass = AbcTune.parse(MusicTunes.BASS)
        val rests = AbcTune.parse(MusicTunes.RESTS)

        assertEquals("Chromatic", chromatic.title)
        assertEquals("Traditional", chromatic.composer)
        assertEquals(AbcTune.Meter.Common, chromatic.meter)
        assertEquals(3, chromatic.fifths)
        assertEquals(-3, chromatic.bars[1].fifths)
        assertEquals(AbcTune.Clef.Bass, bass.clef)
        assertEquals(-2, bass.fifths)
        assertEquals(null, rests.title)
        assertEquals(AbcTune.Meter.Fraction(3, 4), rests.meter)
        assertEquals(1, rests.fifths)
    }

    @Test
    fun aBeatIsADottedQuarterInCompoundMetersAsAbcjsCountsIt() {
        assertEquals(0.375, AbcTune.parse(MusicTunes.JIG).meter.beatLength, 0.0)
        assertEquals(0.25, AbcTune.parse(MusicTunes.SCALE).meter.beatLength, 0.0)
        assertEquals(0.25, AbcTune.parse(MusicTunes.CHROMATIC).meter.beatLength, 0.0)
    }

    @Test
    fun repeatsPlayAgainAndEachEndingPlaysOnItsOwnPass() {
        assertEquals(listOf(0, 1, 2, 0, 1, 3), AbcTune.parse(MusicTunes.ENDINGS).playOrder)
        assertEquals(listOf(0, 1, 2, 3, 4, 5, 6, 7, 0, 1, 2, 3, 4, 5, 6, 7), AbcTune.parse(MusicTunes.JIG).playOrder)
        assertEquals(listOf(0, 1, 2, 3), AbcTune.parse(MusicTunes.SCALE).playOrder)
    }

    @Test
    fun onlyAccidentalsWrittenInTheBarAreDrawn() {
        val chromatic = AbcTune.parse(MusicTunes.CHROMATIC)
        val drawn = chromatic.bars.map { bar -> bar.elements.flatMap { element -> element.pitches.mapNotNull { it.accidental } } }

        assertEquals(listOf(emptyList(), listOf(AbcTune.Accidental.Natural, AbcTune.Accidental.Sharp)), drawn)
    }

    @Test
    fun tripletsSoundShorterThanTheyAreWrittenAndMarkTheirFirstNote() {
        val triplet = AbcTune.parse(MusicTunes.TIES).bars[1].elements

        assertEquals(AbcTune.Tuplet(3, 3), triplet[1].tuplet)
        assertEquals(listOf(0.125, 0.125, 0.125), triplet.subList(1, 4).map { it.written })
        assertEquals(listOf(1.0 / 12, 1.0 / 12, 1.0 / 12), triplet.subList(1, 4).map { it.sounding })
    }
}
