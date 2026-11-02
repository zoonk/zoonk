package com.zoonk.android.feature.onboarding.setup

import com.zoonk.android.feature.onboarding.planOf
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.time.LocalDate

class RevealShapeTest {
    private val today = LocalDate.now()

    @Test
    fun factsCountTheDaysToTheGoal() {
        assertEquals(
            RevealFacts(days = 53, daysEstimated = false, end = null, endAsMonth = false),
            planOf().revealFacts(today),
        )
    }

    @Test
    fun aPlanWithoutADateEndsAtItsPaceAsAMonthWhenFarOff() {
        val near = planOf(targetDate = null, endDate = today.plusDays(30)).revealFacts(today)
        val far = planOf(targetDate = null, endDate = today.plusDays(200)).revealFacts(today)

        assertEquals(today.plusDays(30) to false, near.end to near.endAsMonth)
        assertEquals(today.plusDays(200) to true, far.end to far.endAsMonth)
        assertNull(far.days)
    }

    @Test
    fun theCurrentPhaseCountsItsDays() {
        val phase = planOf().roadmapPhases.first()

        assertEquals(PhaseDay(day = 1, days = 21), phase.dayOf(today))
        assertEquals(PhaseDay(day = 21, days = 21), phase.dayOf(today.plusDays(90)))
    }
}
