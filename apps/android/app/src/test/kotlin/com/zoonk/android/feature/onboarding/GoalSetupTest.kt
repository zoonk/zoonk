package com.zoonk.android.feature.onboarding

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class GoalSetupTest {
    @Test
    fun aPlanBeingBuiltWaitsOnEveryQuestionLeftBuddyIncluded() {
        assertTrue(setupView(listOf("buddy", "plan")).questionsLeft)
        assertFalse(setupView(listOf("plan")).questionsLeft)
    }
}
