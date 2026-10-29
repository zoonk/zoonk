package com.zoonk.android.feature.onboarding.setup

import com.zoonk.api.models.PlanTimeAdvice
import com.zoonk.api.models.PlanTimeToCover
import kotlinx.datetime.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

class ScheduleRulesTest {
    private val advice =
        PlanTimeAdvice(
            coveredShare = 0.6,
            fullCourseEndDate = null,
            measure = PlanTimeAdvice.Measure.EXAM,
            numbers = null,
            ready = true,
            targetDate = LocalDate(2026, 11, 8),
            targetDateNamedMonth = false,
        )

    private fun found(recommended: Long?) =
        PlanTimeToCover(
            coreMinutes = null,
            fittingDate = null,
            ready = true,
            recommendedMinutes = recommended,
            targetDate = null,
            targetDateNamedMonth = false,
        )

    private fun answerFor(
        minutes: Int,
        days: List<Int> = EVERY_DAY,
        advice: PlanTimeAdvice = this.advice,
    ) = AdviceAnswer(advice, studyWeek(days, 60, null), minutes)

    private val unknown = PickedShare(false, null)

    @Test
    fun aNewGoalsEveryDayWeekOpensOnWeekdaysButAChosenWeekStays() {
        assertEquals(listOf(1, 2, 3, 4, 5), startingDays(EVERY_DAY))
        assertEquals(listOf(1, 2, 3, 4, 5), startingDays(emptyList()))
        assertEquals(listOf(0, 6), startingDays(listOf(0, 6)))
    }

    @Test
    fun theTimesListedKeepAPickedOrOfferedTimeOutsideTheUsualOnes() {
        assertEquals(listOf(15, 30, 45, 60, 70, 90, 120, 180, 240), timeChoices(70, null, 30))
        assertEquals(DAILY_TIMES, otherTimes(45))
        assertTrue(100 in otherTimes(100))
        assertEquals(1440, DAILY_TIMES.last())
    }

    @Test
    fun findKeepsTheWeekendsOwnTimeEvenWhenItEqualsTheWeekdayPick() {
        assertEquals(StudyWeek(EVERY_DAY, 60), findWeek(EVERY_DAY, 60))
        assertEquals(StudyWeek(EVERY_DAY), studyWeek(EVERY_DAY, 60, 60))
        assertEquals(StudyWeek(listOf(1, 2, 3)), findWeek(listOf(1, 2, 3), null))
    }

    @Test
    fun aWeeksAdviceHoldsWhileAnotherTimeIsAskedAboutButNotAnotherWeekOrABuildingPlan() {
        assertSame(advice, weekAdvice(answerFor(45), studyWeek(EVERY_DAY, 90, null)))
        assertNull(weekAdvice(answerFor(45), studyWeek(listOf(1, 2, 3, 4, 5), 90, null)))
        assertNull(weekAdvice(answerFor(45, advice = advice.copy(ready = false)), studyWeek(EVERY_DAY, 45, null)))
    }

    @Test
    fun thePlansShareCountsOnlyForTheTimeItWasAskedAboutOrTheTimeFindFound() {
        val answer = answerFor(45)
        assertEquals(PickedShare(true, 0.6), pickedShare(advice, answer, found(100), 45))
        assertEquals(unknown, pickedShare(advice, answer, found(100), 60))
        assertEquals(PickedShare(true, 1.0), pickedShare(advice, answer, found(100), 100))
        assertEquals(unknown, pickedShare(advice, answer, found(100), 240))
        assertEquals(unknown, pickedShare(advice, answer, null, 100))
        assertEquals(PickedShare(true, 0.6), pickedShare(advice, answerFor(100), found(100), 100))
        assertEquals(unknown, pickedShare(null, null, found(100), 45))
    }

    @Test
    fun moreTimeThanCoversTheSundayExamIsAskedAboutRatherThanAssumed() {
        val whole = advice.copy(coveredShare = 1.0)
        assertEquals(unknown, pickedShare(whole, answerFor(65, listOf(0), whole), found(65), 70))
    }

    @Test
    fun anExamKeepsStudyingEverythingUntilThePickedTimeIsKnownToCoverIt() {
        val half = advice.copy(coveredShare = 0.5)
        val answer = answerFor(45, advice = half)
        assertTrue(keepsFullCourse(true, pickedShare(half, answer, null, 60)))
        assertTrue(keepsFullCourse(true, pickedShare(half, answer, null, 45)))
        assertFalse(keepsFullCourse(false, pickedShare(half, answer, null, 45)))
        assertFalse(keepsFullCourse(true, PickedShare(true, 1.0)))
    }

    @Test
    fun theEstimateDimsTheLastShareWhileAnotherTimeIsAskedAboutAndSaysWhenAskingStopped() {
        val answer = answerFor(45)
        assertEquals(Estimate(advice, 0.6, false, null, false), estimate(advice, answer, PickedShare(true, 0.6), PollStatus.Idle))
        assertEquals(Estimate(advice, 0.6, true, 45, false), estimate(advice, answer, unknown, PollStatus.Polling))
        assertEquals(Estimate(advice, 0.6, true, 45, false), estimate(null, answer, unknown, PollStatus.Polling))
        assertEquals(Estimate(null, null, true, null, false), estimate(null, null, unknown, PollStatus.Polling))
        assertEquals(Estimate(advice, 0.6, true, 45, true), estimate(advice, answer, unknown, PollStatus.Failed))
    }

    @Test
    fun theEstimateShowsWhileAShareIsComingOrKeptAndLeavesWhenThereIsNone() {
        val none = Estimate(null, null, true, null, false)
        assertTrue(showsEstimate(none, unknown, PollStatus.Polling))
        assertFalse(showsEstimate(none, PickedShare(true, null), PollStatus.Idle))
        assertFalse(showsEstimate(none, unknown, PollStatus.Failed))
        assertTrue(showsEstimate(none.copy(share = 0.6, failed = true), unknown, PollStatus.Failed))
        assertTrue(showsEstimate(none.copy(failed = true), unknown, PollStatus.Failed))
    }

    @Test
    fun theFullCourseEndIsSaidOnlyForTheTimeItWasWorkedOutFor() {
        val ends = advice.copy(fullCourseEndDate = LocalDate(2027, 1, 10))
        assertEquals(
            Finish(45, LocalDate(2027, 1, 10), LocalDate(2026, 11, 8), false),
            fullCourseEnd(ends, answerFor(45, advice = ends), 45),
        )
        assertNull(fullCourseEnd(ends, answerFor(45, advice = ends), 60))
        assertNull(fullCourseEnd(advice, answerFor(45), 45))
    }

    @Test
    fun theOfferedTimeCoversEverythingOrElseBringsInEveryTopic() {
        assertEquals(100, offeredMinutes(found(100)))
        assertEquals(300, offeredMinutes(found(null).copy(coreMinutes = 300)))
        assertNull(offeredMinutes(null))
    }
}
