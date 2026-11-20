package com.zoonk.android.feature.plan

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

class PlanTimeToCoverTest {
    @Test
    fun anAnswerIsKeyedToThePlanItWasFoundForNeverToAnotherGoalsThatLooksTheSame() {
        val other = coveragePlan().copy(planId = java.util.UUID.fromString(CHANGE_ID))

        assertNotEquals(planAdviceRevision(coveragePlan()), planAdviceRevision(other))
    }

    @Test
    fun theSamePlanReadAgainKeepsTheAnswer() {
        val answered = TimeToCoverState.Answered(planAdviceRevision(coveragePlan()), timeToCover())

        assertEquals(answered, answered.forPlan(coveragePlan()))
    }

    @Test
    fun aNewDayDropsTheAnswerSinceTheDaysLeftChangeIt() {
        val read = coveragePlan()
        val nextDay = read.copy(week = read.week.copy(startDate = kotlinx.datetime.LocalDate.parse("2026-10-27")))
        val answered = TimeToCoverState.Answered(planAdviceRevision(read), timeToCover())

        assertEquals(TimeToCoverState.Idle, answered.forPlan(nextDay))
    }

    @Test
    fun aReplannedPlanDropsTheAnswer() {
        val answered = TimeToCoverState.Answered(planAdviceRevision(coveragePlan()), timeToCover())

        assertEquals(TimeToCoverState.Idle, answered.forPlan(coveragePlan(timeCovers = true)))
    }
}
