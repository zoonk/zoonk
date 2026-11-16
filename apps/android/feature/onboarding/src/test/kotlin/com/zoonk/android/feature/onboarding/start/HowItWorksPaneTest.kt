package com.zoonk.android.feature.onboarding.start

import com.zoonk.android.feature.onboarding.GoalLimitReason
import com.zoonk.android.feature.onboarding.goalsUnderstanding
import com.zoonk.android.feature.onboarding.understoodDraft
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class HowItWorksPaneTest {
    @Test
    fun describesThePlanBesideTheGoalBoxAndAGoalsCard() {
        assertTrue(showsHowItWorks(upFront = null, draft = null))
        assertTrue(showsHowItWorks(upFront = null, draft = understoodDraft(understanding = goalsUnderstanding())))
    }

    @Test
    fun staysOutBesideAnExplanationOffer() {
        val explain = understoodDraft(understanding = """{"status":"explain","question":"How does inflation work?"}""")

        assertFalse(showsHowItWorks(upFront = null, draft = explain))
    }

    @Test
    fun staysOutAtTheGoalsAtOnceLimit() {
        assertFalse(showsHowItWorks(upFront = GoalLimitReason.ActiveGoals, draft = null))
    }
}
