package com.zoonk.android.feature.stats

import org.junit.Assert.assertEquals
import org.junit.Test

class BeltNameSpotsTest {
    @Test fun everyNameShowsCenteredUnderItsBeltWhenAllFit() {
        val spots = beltNameSpots(width = 1000, names = List(10) { 40 }, current = 1, gap = 8)

        assertEquals((0 until 10).map { it to it * 100 + 30 }, spots)
    }

    /** "Yellow" is wider than its column on a 360dp phone: it spills past the column instead of losing letters. */
    @Test fun onlyTheCurrentNameShowsWhenTwoWouldTouchAndItKeepsItsWholeWidth() {
        val spots = beltNameSpots(width = 328, names = listOf(30, 35, 38, 30, 25, 34, 34, 20, 25, 30), current = 1, gap = 8)

        assertEquals(listOf(1 to 31), spots)
    }

    @Test fun aLongNameAtTheRowsEndStaysInsideTheRow() {
        val first = beltNameSpots(width = 328, names = List(10) { 60 }, current = 0, gap = 8)
        val last = beltNameSpots(width = 328, names = List(10) { 60 }, current = 9, gap = 8)

        assertEquals(listOf(0 to 0), first)
        assertEquals(listOf(9 to 268), last)
    }
}
