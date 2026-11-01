package com.zoonk.android.feature.language

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class SkillLevelsTest {
    @Test
    fun aLevelIsHalfStepsFromA1() {
        assertEquals(0.0, parseCefrScore("A1")!!, DELTA)
        assertEquals(2.0, parseCefrScore("B1")!!, DELTA)
        assertEquals(2.5, parseCefrScore(" b1+ ")!!, DELTA)
        assertEquals(5.0, parseCefrScore("C2+")!!, DELTA)
    }

    @Test
    fun anythingElseIsNoLevel() {
        assertNull(parseCefrScore("B3"))
        assertNull(parseCefrScore(""))
    }

    private companion object {
        const val DELTA = 1e-9
    }
}
