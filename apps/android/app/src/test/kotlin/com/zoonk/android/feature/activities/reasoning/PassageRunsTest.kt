package com.zoonk.android.feature.activities.reasoning

import org.junit.Assert.assertEquals
import org.junit.Test

class PassageRunsTest {
    @Test
    fun joinsTouchingGlyphsAndKeepsAPassagesSeparateStretchesApart() {
        assertEquals(listOf(0f..30f, 50f..60f), visualRuns(listOf(50f..55f, 0f..10f, 10f..30f, 55.5f..60f)))
    }
}
