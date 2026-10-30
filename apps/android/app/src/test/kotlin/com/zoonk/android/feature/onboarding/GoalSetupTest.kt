package com.zoonk.android.feature.onboarding

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class GoalSetupTest {
    @Test
    fun onlyACourseStartWithQuestionsLeftHoldsItsReadyPlanBack() {
        assertTrue(setupView(listOf("schedule", "plan"), details = COURSE_START).courseSetupLeft)
        assertFalse(setupView(listOf("schedule", "plan")).courseSetupLeft)
        assertFalse(setupView(listOf("buddy", "plan"), details = COURSE_START).courseSetupLeft)
    }

    @Test
    fun aPlanBeingBuiltWaitsOnEveryQuestionLeftBuddyIncluded() {
        assertTrue(setupView(listOf("buddy", "plan")).questionsLeft)
        assertFalse(setupView(listOf("plan")).questionsLeft)
    }

    private companion object {
        const val COURSE_START = """{"answered":[],"courseStart":{"courseId":"c0ffee00-0000-4000-8000-000000000001"}}"""
    }
}
