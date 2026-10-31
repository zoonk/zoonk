package com.zoonk.android.feature.stats

import org.junit.Assert.assertEquals
import org.junit.Test

class StatsRulesTest {
    @Test
    fun activityBandsAreRelativeToTheBusiestDay() {
        assertEquals(0, activityBand(0, 9))
        assertEquals(1, activityBand(1, 9))
        assertEquals(4, activityBand(9, 9))
    }

    @Test
    fun energyBandsAreFixedAndFullEnergyStandsAlone() {
        assertEquals(0, energyBand(null))
        assertEquals(1, energyBand(10.0))
        assertEquals(4, energyBand(99.0))
        assertEquals(5, energyBand(100.0))
    }
}
