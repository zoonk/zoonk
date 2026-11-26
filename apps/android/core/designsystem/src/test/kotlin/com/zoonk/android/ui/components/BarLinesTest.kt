package com.zoonk.android.ui.components

import org.junit.Assert.assertEquals
import org.junit.Test

class BarLinesTest {
    @Test
    fun twoLabelsThatFitShareTheLineAndTheMainActionTakesTheRest() {
        val lines = barLines(listOf(BarSlot(120), BarSlot(90, main = true)), width = 328, gap = 8, roomy = false)

        assertEquals(listOf(listOf(0 to 120, 1 to 200)), lines)
    }

    @Test
    fun labelsThatDontFitTakeALineEachAtTheBarsWidthTheMainOneLast() {
        val lines = barLines(listOf(BarSlot(200), BarSlot(150, main = true)), width = 328, gap = 8, roomy = false)

        assertEquals(listOf(listOf(0 to 328), listOf(1 to 328)), lines)
    }

    @Test
    fun theWayBackKeepsItsSizeBesideTheMainAction() {
        val lines = barLines(listOf(BarSlot(44, glyph = true, start = true), BarSlot(90, main = true)), width = 328, gap = 8, roomy = false)

        assertEquals(listOf(listOf(0 to 44, 1 to 276)), lines)
    }

    @Test
    fun anOptionTakesALineOfItsOwnOnAPhoneAndTwoOthersShareTheLineAboveIt() {
        val slots = listOf(BarSlot(110), BarSlot(100), BarSlot(70, main = true, ownLine = true))

        assertEquals(listOf(listOf(0 to 165, 1 to 155), listOf(2 to 328)), barLines(slots, width = 328, gap = 8, roomy = false))
    }

    @Test
    fun aRoomyBarKeepsEachButtonAtItsOwnWidthOnOneLine() {
        val slots = listOf(BarSlot(110), BarSlot(160, main = true, ownLine = true))

        assertEquals(listOf(listOf(0 to 110, 1 to 160)), barLines(slots, width = 600, gap = 8, roomy = true))
    }
}
