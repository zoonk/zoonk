package com.zoonk.android.feature.plan

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

class PlanTimeToCoverTest {
    @Test
    fun anAnswerIsKeyedToThePlanItWasFoundForNeverToAnotherGoalsThatLooksTheSame() {
        val other = coveragePlan().copy(planId = java.util.UUID.fromString(CHANGE_ID))

        assertNotEquals(timeToCoverRevision(coveragePlan()), timeToCoverRevision(other))
    }

    @Test
    fun theSamePlanReadAgainKeepsTheAnswerEvenWhenItsWeekMoved() {
        val read = coveragePlan()
        val nextDay = read.copy(week = read.week.copy(startDate = kotlinx.datetime.LocalDate.parse("2026-10-27")))
        val answered = TimeToCoverState.Answered(timeToCoverRevision(read), timeToCover())

        assertEquals(answered, answered.forPlan(coveragePlan()))
        assertEquals(answered, answered.forPlan(nextDay))
    }

    @Test
    fun aReplannedPlanDropsTheAnswer() {
        val answered = TimeToCoverState.Answered(timeToCoverRevision(coveragePlan()), timeToCover())

        assertEquals(TimeToCoverState.Idle, answered.forPlan(coveragePlan(timeCovers = true)))
    }

    @Test
    fun theOfferedTimeIsTheOneThatCoversEverythingElseTheOneEveryTopicNeeds() {
        assertEquals(45, timeToCover(recommended = 45).answer().offeredMinutes)
        assertEquals(240, timeToCover(recommended = null, core = 240).answer().offeredMinutes)
        assertEquals(null, timeToCover(recommended = null).answer().offeredMinutes)
    }
}
