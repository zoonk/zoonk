package com.zoonk.android.ui.components

import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntRect
import androidx.compose.ui.unit.IntSize
import org.junit.Assert.assertEquals
import org.junit.Test

class ChartTooltipPlacementTest {
    private val card = IntSize(width = 100, height = 50)
    private val column = IntRect(left = 0, top = 0, right = 50, bottom = 300)

    @Test
    fun aColumnTooltipRisesAboveTheChartWhenTheRoomIsVisible() {
        assertEquals(IntOffset(0, -58), tooltipOffset(column, card, width = 400, room = -200..900, gap = 8))
    }

    @Test
    fun aColumnTooltipScrolledUnderTheViewportsTopMovesBesideTheColumnInsideIt() {
        val placed = tooltipOffset(column, card, width = 400, room = 20..300, gap = 8)

        assertEquals(IntOffset(58, 125), placed)
    }

    @Test
    fun aColumnTooltipWithNoRoomAboveOrBesideStaysAtTheTopOfTheVisibleArea() {
        val middle = IntRect(left = 100, top = 0, right = 200, bottom = 300)

        assertEquals(IntOffset(25, 20), tooltipOffset(middle, IntSize(250, 50), width = 300, room = 20..300, gap = 8))
    }

    @Test
    fun aPointWithoutRoomAboveItShowsItsTooltipBelowIt() {
        val day = IntRect(left = 0, top = 30, right = 20, bottom = 50)

        assertEquals(IntOffset(0, 58), tooltipOffset(day, card, width = 400, room = 0..200, gap = 8))
    }
}
