package com.zoonk.android.feature.onboarding

import com.zoonk.android.feature.profile.profileQuestion
import com.zoonk.api.models.OnboardingStep
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ProfileSetupLeftTest {
    @Test
    fun optionalProfileStepsNeverLeaveSetupOwed() {
        val view = setupView(listOf("plan"))
        val profile = OnboardingStep.entries.filter { it.profileQuestion != null }
        assertFalse(view.copy(steps = profile + OnboardingStep.PLAN).questionsLeft)
        profile.forEach { assertFalse(view.copy(steps = listOf(it, OnboardingStep.PLAN)).questionsLeft) }
        assertTrue(view.copy(steps = profile + OnboardingStep.SCHEDULE + OnboardingStep.PLAN).questionsLeft)
    }
}
