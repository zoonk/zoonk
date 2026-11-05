package com.zoonk.android.ui.richtext

import androidx.compose.ui.geometry.Offset
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class UnderlineStrokeTest {
    private val em = 12f

    // A 260-wide phrase that wraps after 200, leaving a short word on the next line.
    private val wrapped = listOf(LineSpan(100f, 300f, 50f), LineSpan(0f, 60f, 100f))

    private fun List<Offset>.depths(baseline: Float) = map { it.y - baseline }

    @Test
    fun givesEachLineItsSliceOfTheStrokeAnUnbrokenPhraseWouldGet() {
        val unbroken = underlineStroke(listOf(LineSpan(0f, 260f, 50f)), em)
        val split = underlineStroke(wrapped, em)

        listOf(unbroken.pen to split.pen, unbroken.echo to split.echo).forEach { (whole, lines) ->
            val joined = lines[0].depths(50f) + lines[1].depths(100f).drop(1)
            assertArrayEquals(whole.single().depths(50f).toFloatArray(), joined.toFloatArray(), 0.001f)
        }
        assertEquals(listOf(0f, 60f), listOf(split.pen[1].first().x, split.pen[1].last().x))
    }

    @Test
    fun curlsOnlyWhereThePhraseEndsNeverAtALineBreak() {
        val pen = underlineStroke(wrapped, em).pen
        val longer = underlineStroke(listOf(LineSpan(0f, 400f, 50f)), em).pen.single().depths(50f)
        val alongLonger = { at: Int -> longer[at / 2] }

        assertEquals(alongLonger(200), pen[0].last().y - 50f, 0.001f)
        assertTrue(pen[1].last().y - 100f < alongLonger(260) - em * 0.1f)
    }

    @Test
    fun startsAtTheRightEdgeOfLinesReadRightToLeft() {
        val pen = underlineStroke(listOf(LineSpan(100f, 300f, 50f, rtl = true), LineSpan(240f, 300f, 100f, rtl = true)), em).pen

        assertEquals(listOf(300f, 100f, 300f, 240f), listOf(pen[0].first().x, pen[0].last().x, pen[1].first().x, pen[1].last().x))
    }
}
