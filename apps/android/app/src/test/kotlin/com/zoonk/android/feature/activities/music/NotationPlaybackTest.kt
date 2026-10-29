package com.zoonk.android.feature.activities.music

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.roundToInt

/**
 * Expected sounds come from main's `tuneSound` over abcjs 6.7.1's note timings for the same melodies, as
 * `start ms/MIDI/length ms` in time order (abcjs rounds starts to the millisecond).
 */
class NotationPlaybackTest {
    private fun sounds(
        notation: String,
        bpm: Int,
    ): String =
        NotationPlayback
            .schedule(AbcTune.parse(notation), bpm)
            .sounds
            .sortedWith(compareBy({ (it.at * 1000).roundToInt() }, { it.midi }))
            .joinToString(" ") { "${(it.at * 1000).roundToInt()}/${it.midi}/${((it.duration ?: 0.0) * 1000).roundToInt()}" }

    @Test
    fun aScaleSoundsEachNoteForABeat() {
        assertEquals(
            "0/60/500 500/62/500 1000/64/500 1500/65/500 2000/67/500 2500/69/500 3000/71/500 3500/72/500 4000/72/500 " +
                "4500/71/500 5000/69/500 5500/67/500 6000/65/500 6500/64/500 7000/62/500 7500/60/500",
            sounds(MusicTunes.SCALE, 120),
        )
    }

    @Test
    fun tiesRingOnAndTripletsShareTheirBeat() {
        assertEquals(
            "0/65/500 500/69/500 1000/72/1000 2000/70/167 2167/69/167 2333/67/167 2500/65/500 3000/64/1500 4500/65/1500",
            sounds(MusicTunes.TIES, 120),
        )
        assertEquals(
            "0/65/667 667/69/667 1333/72/1333 2667/70/222 2889/69/222 3111/67/222 3333/65/667 4000/64/2000 6000/65/2000",
            sounds(MusicTunes.TIES, 90),
        )
    }

    @Test
    fun endingsPlayOnTheirOwnPass() {
        assertEquals(
            "0/62/500 500/66/250 750/69/250 1000/74/500 1500/78/250 1750/74/250 2000/76/500 2500/73/500 3000/69/1000 4000/71/500 " +
                "4500/69/250 4750/67/250 5000/66/500 5500/64/500 6000/62/500 6500/66/250 6750/69/250 7000/74/500 7500/78/250 " +
                "7750/74/250 8000/76/500 8500/73/500 9000/69/1000 10000/71/500 10500/73/250 10750/71/250 11000/69/1000",
            sounds(MusicTunes.ENDINGS, 120),
        )
    }

    @Test
    fun chordsStrikeTogetherAndBrokenRhythmsLeanLongShort() {
        assertEquals(
            "0/67/500 0/71/500 0/74/500 500/72/500 500/76/500 500/79/500 1000/62/500 1000/66/500 1000/70/500 1000/72/500 " +
                "1500/55/500 1500/59/500 1500/62/500 1500/67/500 2000/64/750 2750/66/250 3000/67/250 3250/69/750 4000/71/1000",
            sounds(MusicTunes.CHORDS, 120),
        )
    }

    @Test
    fun keysAccidentalsClefsAndRestsSoundAsAbcjsPlaysThem() {
        assertEquals(
            "0/46/250 250/50/250 500/53/250 750/50/250 1000/51/250 1250/55/250 1500/47/250 1750/48/250 2000/50/1000",
            sounds(MusicTunes.BASS, 120),
        )
        assertEquals(
            "0/69/125 125/71/125 250/73/125 375/74/125 500/76/125 625/78/125 750/80/125 875/81/125 1000/81/250 1250/80/250 " +
                "1500/78/250 1750/76/250 2000/75/500 2500/76/500 3000/78/250 3250/79/250",
            sounds(MusicTunes.CHROMATIC, 120),
        )
        assertEquals("0/64/500 1000/67/500 2500/71/500 4500/76/1500", sounds(MusicTunes.RESTS, 120))
        assertEquals(
            "0/60/125 125/62/125 250/64/125 375/65/125 500/67/125 625/69/125 750/71/125 875/72/125 1000/72/250 1250/71/250 1500/69/500",
            sounds(MusicTunes.UNITLESS, 120),
        )
    }

    @Test
    fun aCompoundMeterCountsItsTempoInDottedQuarters() {
        val jig = NotationPlayback.schedule(AbcTune.parse(MusicTunes.JIG), 120)

        assertEquals(92, jig.sounds.size)
        assertEquals(listOf(0, 167, 333, 500), jig.sounds.take(4).map { (it.at * 1000).roundToInt() })
        assertEquals(15_500, (jig.sounds.last().at * 1000).roundToInt())
        assertEquals(500, ((jig.sounds.last().duration ?: 0.0) * 1000).roundToInt())
    }

    @Test
    fun eachNoteAndRestIsAnEventInPlayingOrder() {
        val schedule = NotationPlayback.schedule(AbcTune.parse(MusicTunes.RESTS), 120)

        assertEquals(
            listOf(0 to 0, 0 to 1, 0 to 2, 1 to 0, 1 to 1, 2 to 0, 3 to 0),
            schedule.events.map { it.element.bar to it.element.index },
        )
        assertEquals(listOf(0, 500, 1000, 1500, 2500, 3000, 4500), schedule.events.map { (it.start * 1000).roundToInt() })
        assertEquals(6.0, schedule.seconds, 1e-9)
    }

    @Test
    fun aTieCarriesItsAccidentalOverTheBarLineButNotToTheNextNote() {
        assertEquals("0/66/1000 1000/65/500", sounds("M:4/4\nL:1/4\nK:C\n^F-|F F|]", 120))
    }

    @Test
    fun aVoiceChosenAgainPlaysOn() {
        assertEquals(
            "0/60/500 500/62/500 1000/64/500 1500/65/500 2000/67/500 2500/69/500 3000/71/500 3500/72/500",
            sounds("M:4/4\nL:1/4\nK:C\nV:1\nC D E F|\nV:1\nG A B c|]", 120),
        )
    }

    @Test
    fun voicesDeclaredInTheHeaderLeaveTheBodyInTheFirst() {
        assertEquals("0/60/500 500/62/500 1000/64/500 1500/65/500", sounds("M:4/4\nL:1/4\nV:1\nV:2\nK:C\nC D E F|]", 120))
    }

    @Test
    fun anInlineKeyChangeSoundsFromWhereItIsWritten() {
        assertEquals("0/65/500 500/66/500 1000/67/500 1500/66/500", sounds("M:4/4\nL:1/4\nK:C\nF [K:G] F G F|]", 120))
    }

    @Test
    fun malformedLengthsMeterAndTupletsStillGiveAFiniteTune() {
        val malformed =
            listOf(
                "M:-1/4\nK:C\nC|",
                "K:C\nCD(3:2:2147483647E|",
                "K:C\nC/\u0662|",
                "L:NaN/1\nK:C\nCD|",
                "K:C\nC${"9".repeat(310)}|",
            )

        for (notation in malformed) {
            val tune = AbcTune.parse(notation)
            val schedule = NotationPlayback.schedule(tune, 120)

            NotationDrawing.of(tune, width = 326f, space = 8f, tabSpace = 12f, textHeight = 16f)
            assertTrue(notation, schedule.seconds.isFinite() && schedule.sounds.all { it.at.isFinite() && (it.duration ?: 0.0).isFinite() })
        }
    }
}
