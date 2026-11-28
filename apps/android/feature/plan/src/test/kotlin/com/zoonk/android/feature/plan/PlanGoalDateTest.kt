package com.zoonk.android.feature.plan

import androidx.compose.ui.res.stringResource
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.api.models.Plan
import com.zoonk.api.models.PlanFinishReason
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** Main's date setting beside the plan: it says the finish as the time picker does, in every state. */
@RunWith(AndroidJUnit4::class)
class PlanGoalDateTest {
    @get:Rule
    val compose: ComposeContentTestRule = createComposeRule()

    @Test
    fun anUndatedPlanPastTheYearsItLaysOutFinishesIn10PlusYears() {
        assertEquals("You finish" to "10+ years", setting(undated(PlanFinishReason.BEYOND_HORIZON)))
    }

    @Test
    fun anUndatedPlanWithNoForecastHasNoEndDateSet() {
        assertEquals("End date" to "None set", setting(undated(reason = null)))
    }

    private fun undated(reason: PlanFinishReason?): Plan =
        learnPlan().let {
            it.copy(
                schedule = it.schedule.copy(targetDate = null),
                estimate = it.estimate.copy(endDate = null, precision = null, finishReason = reason),
            )
        }

    private fun setting(plan: Plan): Pair<String, String> {
        val summary = learnerSummary()
        val page = PlanPageState(summary.goals.first(), plan, summary)
        lateinit var shown: Pair<String, String>
        compose.setContent { shown = stringResource(goalDateLabel(page)) to goalDateValue(page).text }
        compose.waitForIdle()
        return shown
    }
}
