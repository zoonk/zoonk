package com.zoonk.android.feature.stats

import org.junit.Assert.assertEquals
import org.junit.Test

class StatsRulesTest {
    private val best = Verdict.Best("monday", 80.0, 12)

    @Test
    fun aPatternNeedsTwoGroupsWithEnoughAnswers() {
        assertEquals(Verdict.NotEnough, verdict(listOf(80.0 to 12L, 60.0 to 9L), best))
        assertEquals(Verdict.NotEnough, verdict(listOf(80.0 to 12L, 60.0 to 12L), strongest = null))
    }

    @Test
    fun aLeadOfAFewPointsIsNoPattern() {
        assertEquals(Verdict.Even(4), verdict(listOf(80.0 to 12L, 76.5 to 20L), best))
        assertEquals(best, verdict(listOf(80.0 to 12L, 60.0 to 20L), best))
    }

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
