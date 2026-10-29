package com.zoonk.android.feature.activities.music

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class NotationLayoutTest {
    private fun drawing(
        notation: String,
        width: Float = 326f,
        tab: Boolean = false,
    ) = NotationDrawing.of(AbcTune.parse(notation), width, space = 8f, tabSpace = if (tab) 12f else null, textHeight = 16f)

    private fun NotationDrawing.lines() = items.count { (it.mark as? NotationDrawing.Mark.Glyph)?.glyph == MusicGlyph.TrebleClef }

    private fun NotationDrawing.frets(element: NotationElementId) =
        items
            .filter { it.element == element }
            .mapNotNull { (it.mark as? NotationDrawing.Mark.Text)?.takeIf { text -> text.kind == NotationDrawing.TextKind.TabFret } }

    @Test
    fun aNarrowStaffSetsTwoBarsALineAndAWideOneFourAsMainAsksAbcjs() {
        assertEquals(2, drawing(MusicTunes.SCALE, width = 326f).lines())
        assertEquals(1, drawing(MusicTunes.SCALE, width = 640f).lines())
    }

    @Test
    fun everyNoteAndRestThatPlaysCanBeLitWhilePlaying() {
        for ((name, notation) in MusicTunes.all) {
            val tune = AbcTune.parse(notation)
            val lit = drawing(notation, tab = true).items.mapNotNull { it.element }.toSet()
            val played = NotationPlayback.schedule(tune, 120).events.map { it.element }

            assertTrue(name, lit.containsAll(played))
        }
    }

    /** As abcjs's guitar tab shows the second bar of [MusicTunes.CHORDS]: E and F♯ on the D string, G and A on the G string, B open. */
    @Test
    fun aNoteTakesItsFretOnTheHighestStringThatReachesIt() {
        val drawing = drawing(MusicTunes.CHORDS, tab = true)
        val frets = (0..4).map { drawing.frets(NotationElementId(1, it)).single() }
        val b = frets.last().y

        assertEquals(listOf("2", "4", "0", "2", "0"), frets.map { it.text })
        assertEquals(listOf(24f, 24f, 12f, 12f, 0f), frets.map { it.y - b })
    }

    @Test
    fun aChordPutsOneNoteOnEachStringFromTheHighestDown() {
        val frets = drawing(MusicTunes.CHORDS, tab = true).frets(NotationElementId(0, 0))

        assertEquals(listOf("3", "4", "5"), frets.map { it.text })
        assertEquals(3, frets.map { it.y }.distinct().size)
    }

    @Test
    fun aTieOverTheBarLineReachesTheNoteItHolds() {
        val drawing = drawing(MusicTunes.TIES)
        val tie =
            drawing.items
                .single {
                    it.element == NotationElementId(0, 2) && it.mark is NotationDrawing.Mark.Tie
                }.mark as NotationDrawing.Mark.Tie
        val held =
            drawing.items
                .first {
                    it.element == NotationElementId(1, 0) && it.mark is NotationDrawing.Mark.Glyph
                }.mark as NotationDrawing.Mark.Glyph

        assertEquals(held.x - 1.6f, tie.toX, 1e-3f)
    }
}
