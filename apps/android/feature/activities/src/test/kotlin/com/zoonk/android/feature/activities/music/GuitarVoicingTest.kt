package com.zoonk.android.feature.activities.music

import org.junit.Assert.assertEquals
import org.junit.Test

/** Expected shapes come from running main's `guitar-voicing.ts`. */
class GuitarVoicingTest {
    @Test
    fun openChordsUseTheirFamiliarShapes() {
        assertEquals(listOf(null, 3, 2, 0, 1, 0), Guitar.voicing(0, listOf(0, 4, 7)))
        assertEquals(listOf(null, 0, 2, 2, 1, 0), Guitar.voicing(9, listOf(9, 0, 4)))
        assertEquals(listOf(3, 2, 0, 0, 0, 3), Guitar.voicing(7, listOf(7, 11, 2)))
        assertEquals(listOf(null, null, 0, 2, 3, 2), Guitar.voicing(2, listOf(2, 6, 9)))
        assertEquals(listOf(0, 2, 2, 0, 0, 0), Guitar.voicing(4, listOf(4, 7, 11)))
        assertEquals(listOf(3, 2, 0, 0, 0, 1), Guitar.voicing(7, listOf(7, 11, 2, 5)))
    }

    @Test
    fun chordsWithoutAnOpenShapeAreBarred() {
        assertEquals(listOf(1, 3, 3, 2, 1, 1), Guitar.voicing(5, listOf(5, 9, 0)))
        assertEquals(listOf(2, 4, 4, 3, 2, 2), Guitar.voicing(6, listOf(6, 10, 1)))
        assertEquals(listOf(null, 2, 1, 4, 0, 2), Guitar.voicing(11, listOf(11, 3, 6)))
        assertEquals(listOf(null, 4, 3, 1, 2, 1), Guitar.voicing(1, listOf(1, 5, 8)))
        assertEquals(listOf(null, null, 1, 3, 4, 3), Guitar.voicing(3, listOf(3, 7, 10)))
        assertEquals(listOf(null, 1, 0, 3, 3, 1), Guitar.voicing(10, listOf(10, 2, 5)))
    }

    @Test
    fun aSingleNoteTakesTheStringNearestTheNut() {
        assertEquals(listOf(null, null, null, null, 1, null), Guitar.voicing(0, listOf(0)))
        assertEquals(listOf(null, null, null, null, null, 0), Guitar.voicing(4, listOf(4)))
    }

    @Test
    fun nothingIsReturnedWhenOneHandCantPlayIt() {
        assertEquals(null, Guitar.voicing(0, listOf(0, 1, 2, 3, 4, 5, 6)))
        assertEquals(null, Guitar.voicing(0, emptyList()))
    }
}
