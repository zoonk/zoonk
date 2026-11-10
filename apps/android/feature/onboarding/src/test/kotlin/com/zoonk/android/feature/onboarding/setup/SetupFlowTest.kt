package com.zoonk.android.feature.onboarding.setup

import com.zoonk.api.models.OnboardingStep.BUDDY
import com.zoonk.api.models.OnboardingStep.FOLLOW_UPS
import com.zoonk.api.models.OnboardingStep.LEVEL
import com.zoonk.api.models.OnboardingStep.PLAN
import com.zoonk.api.models.OnboardingStep.PURPOSE
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
    fun allProfileQuestionsShareOneProgressDot() {
        val profile =
            com.zoonk.api.models.OnboardingStep.entries.filter {
                it.value in
                    com.zoonk.api.models.ProfileQuestion.entries
                        .map { question -> question.value }
            }
        val current = SetupFlow(GOAL, com.zoonk.api.models.OnboardingStep.WATCH, listOf(PURPOSE) + profile.take(3))
        assertEquals(SetupProgress(answered = 1, total = 3), setupProgress(current, profile.drop(3) + SCHEDULE + PLAN))
    }

    @Test
    fun backSkipsProfileAnswersWhileTheyStillCountAsOneProgressDot() {
        val work = com.zoonk.api.models.OnboardingStep.WORK
        val watch = com.zoonk.api.models.OnboardingStep.WATCH
        val support = com.zoonk.api.models.OnboardingStep.LEARNING_SUPPORT
        assertEquals(
            SetupFlow(GOAL, LEVEL, listOf(PURPOSE)),
            SetupFlow(GOAL, SCHEDULE, listOf(PURPOSE, LEVEL, work, watch, support)).goingBack(),
        )
        assertEquals(SetupFlow(GOAL, LEVEL, listOf(PURPOSE)), SetupFlow(GOAL, watch, listOf(PURPOSE, LEVEL, work)).goingBack())
        assertNull(SetupFlow(GOAL, watch, listOf(work)).goingBack())
        assertNull(SetupFlow(GOAL, work).goingBack())
    }

    private companion object {
        const val GOAL = "goal-1"
    }
}
