package com.zoonk.android.feature.plan

import com.zoonk.android.feature.onboarding.adviceOf
import com.zoonk.api.models.PlanFinishPrecision
import com.zoonk.api.models.PlanFinishReason
import kotlinx.datetime.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class PlanForecastTest {
    private val undated = adviceOf(share = null, targetDate = null)

    @Test
    fun aFarFinishIsSaidByItsYear() {
        assertEquals(
            PlanForecast.On(java.time.LocalDate.of(2031, 3, 4), year = true),
            undated.copy(endDate = LocalDate(2031, 3, 4), precision = PlanFinishPrecision.YEAR).forecast,
        )
        assertEquals(
            PlanForecast.On(java.time.LocalDate.of(2027, 3, 4), year = false),
            undated.copy(endDate = LocalDate(2027, 3, 4), precision = PlanFinishPrecision.MONTH).forecast,
        )
    }

    @Test
    fun onlyWorkPastTheYearsAPlanLaysOutIsBeyondThem() {
        assertEquals(PlanForecast.Beyond, undated.copy(finishReason = PlanFinishReason.BEYOND_HORIZON).forecast)
        assertNull(undated.copy(finishReason = PlanFinishReason.NOTHING_LEFT).forecast)
        assertNull(undated.copy(finishReason = PlanFinishReason.NO_STUDY_DAYS).forecast)
    }
}
