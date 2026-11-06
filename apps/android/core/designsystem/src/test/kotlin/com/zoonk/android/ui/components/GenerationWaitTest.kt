package com.zoonk.android.ui.components

import org.junit.Assert.assertEquals
import org.junit.Test

class GenerationWaitTest {
    @Test
    fun thePartsFillInOrderEachByItsShareOfTheBar() {
        assertEquals(listOf(0f, 0f, 0f), segmentFills(0f, listOf(1, 1, 2)))
        assertEquals(listOf(1f, 0f, 0f), segmentFills(0.25f, listOf(1, 1, 2)))
        assertEquals(listOf(1f, 0.5f, 0f), segmentFills(0.375f, listOf(1, 1, 2)))
        assertEquals(listOf(1f, 1f, 0.5f), segmentFills(0.75f, listOf(1, 1, 2)))
        assertEquals(listOf(1f, 1f, 1f), segmentFills(1f, listOf(1, 1, 2)))
    }

    @Test
    fun aShareOutsideTheBarStaysOnIt() {
        assertEquals(listOf(0f, 0f), segmentFills(-0.1f, listOf(1, 1)))
        assertEquals(listOf(1f, 1f), segmentFills(1.4f, listOf(1, 1)))
    }

    @Test
    fun aBarWithoutWeightStaysEmpty() {
        assertEquals(listOf(0f, 0f), segmentFills(0.5f, listOf(0, 0)))
        assertEquals(emptyList<Float>(), segmentFills(0.5f, emptyList()))
    }
}
