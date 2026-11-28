package com.zoonk.android.feature.onboarding.setup

import com.zoonk.android.feature.onboarding.planOf
import com.zoonk.android.feature.plan.PlanForecast
import com.zoonk.api.models.PlanFinishPrecision
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.time.LocalDate

class RevealShapeTest {
    private val today = LocalDate.now()

    @Test
    fun factsCountTheDaysToTheGoal() {
        assertEquals(
            RevealFacts(days = 53, daysEstimated = false, forecast = null),
            planOf().revealFacts(today),
        )
    }

    @Test
    fun aPlanWithoutADateEndsWhenItsForecastSays() {
        val plan = planOf(targetDate = null, endDate = today.plusDays(900))
        val facts = plan.copy(estimate = plan.estimate.copy(precision = PlanFinishPrecision.YEAR)).revealFacts(today)

        assertEquals(PlanForecast.On(today.plusDays(900), year = true), facts.forecast)
        assertNull(facts.days)
    }
}
