package com.zoonk.android.feature.plan

import com.zoonk.api.models.OnboardingStep.BUDDY
import com.zoonk.api.models.OnboardingStep.PLAN
import com.zoonk.api.models.OnboardingStep.SCHEDULE
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class GoalSetupTest {
    @Test
    fun onlyACourseStartWithQuestionsLeftHoldsItsReadyPlanBack() {
        assertTrue(GoalSetup(listOf(SCHEDULE, PLAN), courseStart = true).courseSetupLeft)
        assertFalse(GoalSetup(listOf(SCHEDULE, PLAN), courseStart = false).courseSetupLeft)
        assertFalse(GoalSetup(listOf(BUDDY, PLAN), courseStart = true).courseSetupLeft)
    }

    @Test
    fun aPlanBeingBuiltWaitsOnEveryQuestionLeftBuddyIncluded() {
        assertTrue(GoalSetup(listOf(BUDDY, PLAN), courseStart = false).questionsLeft)
        assertFalse(GoalSetup(listOf(PLAN), courseStart = false).questionsLeft)
    }
}
