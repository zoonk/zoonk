package com.zoonk.android.feature.onboarding.setup

import com.zoonk.android.feature.onboarding.suggestion
import com.zoonk.android.feature.onboarding.suggestionFor
import com.zoonk.api.models.OnboardingTimeChoicesInner
import com.zoonk.api.models.OnboardingTimeChoicesInnerSplit
import com.zoonk.api.models.PlanTimeAdvice
import com.zoonk.api.models.PlanTimeToCover
import com.zoonk.api.models.PlanTimeToCoverSuggested
import com.zoonk.api.models.PlanTimeToCoverSuggestedSplit
import kotlinx.datetime.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ScheduleRulesTest {
    /** As the API answers: a passed date has no times, and the suggestion follows from the two times. */
    private fun found(
        recommended: Long? = 35,
        focus: Long? = null,
    ) = PlanTimeToCover(
        fittingDate = null,
        most = null,
        ready = true,
        recommendedMinutes = recommended,
        suggested = suggestionFor(recommended, focus),
        targetDate = LocalDate(2028, 10, 29),
        targetDateNamedMonth = false,
    )

    private val pastDate = found(recommended = null).copy(pastDate = true)

    private fun advice(
        share: Double? = 0.48,
        endDate: LocalDate? = null,
    ) = PlanTimeAdvice(
        coveredShare = share,
        endDate = endDate,
        fullCourseEndDate = null,
        measure = PlanTimeAdvice.Measure.GOAL,
        numbers = null,
        ready = true,
        targetDate = LocalDate(2028, 10, 29),
        targetDateNamedMonth = false,
    )

    private val tooClose = found(recommended = 2_000, focus = 300)

    private val noSuggestion = found(recommended = 2_000, focus = 2_000)

    private fun line(
        advice: PlanTimeAdvice? = null,
        askFailed: Boolean = false,
        dated: Boolean = true,
        findFailed: Boolean = false,
        found: PlanTimeToCover? = found(),
        hasDays: Boolean = true,
        minutes: Int? = 35,
    ) = timeLine(advice, askFailed, dated, findFailed, found, hasDays, minutes)

    @Test
    fun aNewGoalsEveryDayWeekOpensOnWeekdaysButAChosenWeekStays() {
        assertEquals(listOf(1, 2, 3, 4, 5), startingDays(EVERY_DAY))
        assertEquals(listOf(1, 2, 3, 4, 5), startingDays(emptyList()))
        assertEquals(listOf(0, 6), startingDays(listOf(0, 6)))
    }

    @Test
    fun findKeepsTheWeekendsOwnTimeEvenWhenItEqualsTheWeekdayPick() {
        assertEquals(StudyWeek(EVERY_DAY, 60), findWeek(EVERY_DAY, 60))
        assertEquals(StudyWeek(EVERY_DAY), studyWeek(EVERY_DAY, 60, 60))
        assertEquals(StudyWeek(listOf(1, 6), 60, fullCourse = true), studyWeek(listOf(1, 6), 30, 60, fullCourse = true))
    }

    @Test
    fun theTimeStartsOnWhatTheApiSuggestsNotOnTheTimesItSends() {
        val suggested = suggestion(PlanTimeToCoverSuggested.Kind.FOCUS, 50)
        val answer = found(recommended = 35).copy(suggested = suggested)

        assertEquals(50, shownMinutes(60, answer, answer, picked = null, settled = false))
        assertEquals(TimeLine.EveryTopic, line(found = answer, minutes = 50))
    }

    @Test
    fun aFocusThatLeavesTopicsOutSaysOnlyWhatItCoversAndIsNotOfferedAsReachingEveryTopic() {
        val leavesTopicsOut =
            found(recommended = 2_000).copy(suggested = suggestion(PlanTimeToCoverSuggested.Kind.FOCUS, 240, everyTopic = false))

        assertEquals(TimeLine.Share(0.6), line(found = leavesTopicsOut, minutes = 240))
        assertNull(offer(leavesTopicsOut, TimeLine.Share(0.1), 30))
    }

    @Test
    fun theTimeShownStartsOnTheSuggestionFollowsItAndKeepsTheLearnersOwn() {
        fun shown(
            first: PlanTimeToCover? = found(),
            found: PlanTimeToCover? = found(),
            picked: Int? = null,
            settled: Boolean = false,
        ) = shownMinutes(60, first, found, picked, settled)

        assertNull(shown(first = null, found = null))
        assertEquals(35, shown())
        assertEquals(30, shown(found = found(recommended = 30)))
        assertEquals(35, shown(found = noSuggestion))
        assertEquals(90, shown(picked = 90))
        assertEquals(60, shown(first = noSuggestion, found = found()))
        assertEquals(60, shown(first = pastDate, found = null))
        assertEquals(60, shown(first = null, found = null, settled = true))
    }

    @Test
    fun pickingTheSuggestionBackFollowsItAgainWhereItIsFollowed() {
        assertNull(pickedMinutes(found(), found(), 35))
        assertEquals(30, pickedMinutes(found(), found(), 30))
        assertEquals(35, pickedMinutes(noSuggestion, found(), 35))
    }

    @Test
    fun theLineSaysWhatTheTimeShownMeansOrWhyThatIsNotKnownYet() {
        assertEquals(TimeLine.NoDays, line(hasDays = false))
        assertEquals(TimeLine.Everything(suggested = true), line())
        assertEquals(TimeLine.EveryTopic, line(found = found(recommended = 2_000, focus = 45), minutes = 45))
        assertEquals(TimeLine.Asking, line(minutes = 15))
        assertEquals(TimeLine.Share(0.48), line(advice = advice(), minutes = 15))
        assertEquals(TimeLine.Everything(suggested = false), line(advice = advice(share = 1.0), minutes = 60))
        assertEquals(TimeLine.Working, line(found = null, minutes = null))
        assertEquals(TimeLine.FindFailed, line(findFailed = true, found = null, minutes = 15))
        assertEquals(TimeLine.AskFailed, line(askFailed = true, minutes = 15))
        assertEquals(TimeLine.PastDate, line(found = pastDate))
    }

    @Test
    fun anUndatedGoalsLineSaysWhenItWouldFinish() {
        assertEquals(TimeLine.Asking, line(dated = false, found = null, minutes = 15))
        assertEquals(
            TimeLine.Finish(LocalDate(2027, 3, 15)),
            line(advice = advice(share = null, endDate = LocalDate(2027, 3, 15)), dated = false, found = null, minutes = 15),
        )
        assertEquals(TimeLine.NoFinish, line(advice = advice(share = null), dated = false, found = null, minutes = 15))
    }

    @Test
    fun onlyATimeTheSuggestionDoesntExplainIsAskedAbout() {
        assertFalse(asksAboutTime(dated = true, found = found(), fullCourse = false, minutes = 35))
        assertTrue(asksAboutTime(dated = true, found = found(), fullCourse = false, minutes = 30))
        assertTrue(asksAboutTime(dated = true, found = found(), fullCourse = true, minutes = 35))
        assertTrue(asksAboutTime(dated = false, found = null, fullCourse = false, minutes = 35))
        assertFalse(asksAboutTime(dated = true, found = null, fullCourse = false, minutes = 35))
        assertFalse(asksAboutTime(dated = true, found = found(), fullCourse = false, minutes = null))
        assertFalse(asksAboutTime(dated = true, found = pastDate, fullCourse = false, minutes = 30))
    }

    @Test
    fun aTooCloseDateIsSaidOnlyWhenNoDayCoversEverything() {
        val short = TimeLine.Share(0.15)
        assertNull(tooClose(found(), short, studiesEveryDay = true))
        assertNull(tooClose(pastDate, short, studiesEveryDay = true))
        assertEquals(TooClose.Date, tooClose(tooClose, short, studiesEveryDay = true))
        assertEquals(TooClose.Days, tooClose(tooClose, short, studiesEveryDay = false))
        assertNull(tooClose(tooClose, TimeLine.Everything(suggested = false), studiesEveryDay = true))
    }

    @Test
    fun theSuggestionIsOfferedBackOnlyWhileAnotherTimeFallsShort() {
        val short = TimeLine.Share(0.48)
        assertNull(offer(found(), short, 35))
        assertEquals(suggestion(PlanTimeToCoverSuggested.Kind.EVERYTHING, 35), offer(found(), short, 15))
        assertNull(offer(found(recommended = 2_000, focus = 240), TimeLine.Everything(suggested = false), 900))
    }

    @Test
    fun theSplitShownIsCoresForTheTimeShown() {
        val choices =
            listOf(
                OnboardingTimeChoicesInner(30, OnboardingTimeChoicesInnerSplit(mine = 20, others = 1, rest = 10)),
                OnboardingTimeChoicesInner(60, null),
            )
        val suggested =
            found(recommended = 50).copy(
                suggested =
                    suggestion(
                        PlanTimeToCoverSuggested.Kind.EVERYTHING,
                        50,
                        PlanTimeToCoverSuggestedSplit(mine = 35, others = 2, rest = 15),
                    ),
            )

        assertEquals(DaySplit(mine = 20, others = 1, rest = 10), daySplit(30, choices, listOf(suggested)))
        assertEquals(DaySplit(mine = 35, others = 2, rest = 15), daySplit(50, choices, listOf(null, suggested)))
        assertNull(daySplit(60, choices, listOf(suggested)))
        assertNull(daySplit(45, choices, listOf(suggested)))
        assertNull(daySplit(null, choices, listOf(suggested)))
    }

    @Test
    fun continueWaitsForTheNewDaysSuggestionOnlyWhileTheTimeFollowsOne() {
        assertTrue(waitsForSuggestion(failed = false, first = found(), found = null, picked = null))
        assertFalse(waitsForSuggestion(failed = true, first = found(), found = null, picked = null))
        assertFalse(waitsForSuggestion(failed = false, first = found(), found = found(), picked = null))
        assertFalse(waitsForSuggestion(failed = false, first = found(), found = null, picked = 30))
        assertFalse(waitsForSuggestion(failed = false, first = noSuggestion, found = null, picked = null))
    }

    @Test
    fun anExamKeepsStudyingEverythingUntilTheTimePickedCoversItAll() {
        assertTrue(keepsFullCourse(true, TimeLine.Asking))
        assertFalse(keepsFullCourse(true, TimeLine.Everything(suggested = false)))
        assertFalse(keepsFullCourse(false, TimeLine.Share(0.4)))
    }
}
