package com.zoonk.android.feature.onboarding.setup

import com.zoonk.api.models.OnboardingStep.BUDDY
import com.zoonk.api.models.OnboardingStep.FOLLOW_UPS
import com.zoonk.api.models.OnboardingStep.LEVEL
import com.zoonk.api.models.OnboardingStep.PLAN
import com.zoonk.api.models.OnboardingStep.PURPOSE
import com.zoonk.api.models.OnboardingStep.REASON
import com.zoonk.api.models.OnboardingStep.SCHEDULE
import com.zoonk.api.models.OnboardingStep.TARGET_DATE
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class SetupFlowTest {
    private val onTime = SetupFlow(GOAL, SCHEDULE, listOf(PURPOSE, LEVEL, TARGET_DATE))

    @Test
    fun theDateOpenedFromTheTimeAndAnsweredComesBackWithBackGoingWhereItWentBefore() {
        val onDate = onTime.opening(TARGET_DATE)
        assertEquals(SetupFlow(GOAL, TARGET_DATE, listOf(PURPOSE, LEVEL, TARGET_DATE, SCHEDULE)), onDate)

        assertEquals(onTime, onDate.arriving(GOAL, TARGET_DATE, SCHEDULE))
    }

    @Test
    fun aQuestionTheNewDateRaisesComesFirstAndTheTimeAfterItKeepsItsBack() {
        val onFollowUps = onTime.opening(TARGET_DATE).arriving(GOAL, TARGET_DATE, FOLLOW_UPS)
        assertEquals(SetupFlow(GOAL, FOLLOW_UPS, listOf(PURPOSE, LEVEL, TARGET_DATE, SCHEDULE, TARGET_DATE)), onFollowUps)

        assertEquals(onTime, onFollowUps.arriving(GOAL, FOLLOW_UPS, SCHEDULE))
    }

    @Test
    fun aDateTheLearnerNeverSawOpensFromTheTimeAndAddsNothingToBack() {
        val noticeDated = SetupFlow(GOAL, SCHEDULE, listOf(LEVEL))

        assertEquals(noticeDated, noticeDated.opening(TARGET_DATE).arriving(GOAL, TARGET_DATE, SCHEDULE))
    }

    @Test
    fun answersThatMoveOnKeepEveryScreenBehind() {
        assertEquals(SetupFlow(GOAL, BUDDY, listOf(PURPOSE, LEVEL, TARGET_DATE, SCHEDULE)), onTime.arriving(GOAL, SCHEDULE, BUDDY))
    }

    @Test
    fun noDashesWhileTheQuestionThatCanAddOneIsCurrentOrAhead() {
        assertNull(setupProgress(SetupFlow(GOAL, LEVEL), listOf(PURPOSE, SCHEDULE, PLAN)))
        assertNull(setupProgress(SetupFlow(GOAL, PURPOSE, listOf(LEVEL)), listOf(SCHEDULE, PLAN)))
        assertEquals(SetupProgress(answered = 1, total = 3), setupProgress(SetupFlow(GOAL, LEVEL, listOf(PURPOSE)), listOf(SCHEDULE, PLAN)))
    }

    @Test
    fun theCountryToShowCountsAsAQuestion() {
        val country = com.zoonk.api.models.OnboardingStep.CONTENT_COUNTRY

        assertEquals(SetupProgress(answered = 0, total = 3), setupProgress(SetupFlow(GOAL, country), listOf(LEVEL, SCHEDULE, PLAN)))
        assertEquals(SetupProgress(answered = 1, total = 3), setupProgress(SetupFlow(GOAL, LEVEL, listOf(country)), listOf(SCHEDULE, PLAN)))
    }

    @Test
    fun noDashesWhileTheLanguageReasonCanAddExamQuestions() {
        assertNull(setupProgress(SetupFlow(GOAL, REASON, listOf(LEVEL, FOLLOW_UPS, TARGET_DATE, SCHEDULE)), listOf(PLAN)))
    }

    @Test
    fun theDateOpenedFromTheTimeHoldsItsFirstPlaceAndCountsOnce() {
        val steps = listOf(SCHEDULE, BUDDY, PLAN)

        assertEquals(SetupProgress(answered = 3, total = 5), setupProgress(onTime, steps))
        assertEquals(SetupProgress(answered = 2, total = 5), setupProgress(onTime.opening(TARGET_DATE), steps))
    }

    @Test
    fun aDateTheLearnerNeverSawCountsAsOneMoreStepAfterTheAnsweredOnes() {
        val noticeDated = SetupFlow(GOAL, SCHEDULE, listOf(LEVEL))
        val steps = listOf(SCHEDULE, PLAN)

        assertEquals(SetupProgress(answered = 1, total = 2), setupProgress(noticeDated, steps))
        assertEquals(SetupProgress(answered = 1, total = 3), setupProgress(noticeDated.opening(TARGET_DATE), steps))
    }

    @Test
    fun aDateThePlanAsksAgainKeepsItsFirstPlace() {
        val steps = listOf(TARGET_DATE, SCHEDULE, PLAN)

        assertEquals(SetupProgress(answered = 2, total = 4), setupProgress(onTime.opening(TARGET_DATE), steps))
    }

    @Test
    fun aMovedGoalDoesNotKeepTheLanguageQuestionInBack() {
        val language = SetupFlow(GOAL, com.zoonk.api.models.OnboardingStep.REASON)
        assertEquals(SetupFlow("exam", LEVEL), language.arriving("exam", com.zoonk.api.models.OnboardingStep.REASON, LEVEL))
    }

    @Test
    fun aboutYouScreensShareOnePlaceInTheCount() {
        val work = com.zoonk.api.models.OnboardingStep.WORK
        val tools = com.zoonk.api.models.OnboardingStep.TOOLS
        val watch = com.zoonk.api.models.OnboardingStep.WATCH
        val listen = com.zoonk.api.models.OnboardingStep.LISTEN
        val onWatch = SetupFlow(GOAL, watch, listOf(PURPOSE, LEVEL, work, tools))
        assertEquals(SetupProgress(answered = 2, total = 5), setupProgress(onWatch, listOf(watch, listen, BUDDY, SCHEDULE, PLAN)))
        val onBuddy = SetupFlow(GOAL, BUDDY, listOf(PURPOSE, LEVEL, work, tools, watch, listen))
        assertEquals(SetupProgress(answered = 3, total = 5), setupProgress(onBuddy, listOf(BUDDY, SCHEDULE, PLAN)))
    }

    @Test
    fun backReturnsToThePreviousProfileAnswer() {
        val work = com.zoonk.api.models.OnboardingStep.WORK
        val watch = com.zoonk.api.models.OnboardingStep.WATCH
        val support = com.zoonk.api.models.OnboardingStep.LEARNING_SUPPORT
        assertEquals(
            SetupFlow(GOAL, support, listOf(PURPOSE, LEVEL, work, watch)),
            SetupFlow(GOAL, SCHEDULE, listOf(PURPOSE, LEVEL, work, watch, support)).goingBack(),
        )
        assertEquals(SetupFlow(GOAL, work, listOf(PURPOSE, LEVEL)), SetupFlow(GOAL, watch, listOf(PURPOSE, LEVEL, work)).goingBack())
        assertEquals(SetupFlow(GOAL, work), SetupFlow(GOAL, watch, listOf(work)).goingBack())
        assertNull(SetupFlow(GOAL, work).goingBack())
    }

    private companion object {
        const val GOAL = "goal-1"
    }
}
