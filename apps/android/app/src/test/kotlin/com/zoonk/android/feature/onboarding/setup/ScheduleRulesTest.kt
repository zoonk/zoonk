package com.zoonk.android.feature.onboarding.setup

import com.zoonk.api.models.PlanTimeAdvice
import com.zoonk.api.models.PlanTimeToCover
import kotlinx.datetime.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ScheduleRulesTest {
    private fun found(
        recommended: Long? = 35,
        core: Long? = null,
        pastDate: Boolean = false,
    ) = FoundTime(
        PlanTimeToCover(
            coreMinutes = core,
            fittingDate = null,
            ready = true,
            recommendedMinutes = recommended,
            suggested = null,
            targetDate = LocalDate(2028, 10, 29),
            targetDateNamedMonth = false,
        ),
        pastDate = pastDate,
    )

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

    private val tooClose = found(recommended = 900, core = 300)

    private fun line(
        advice: PlanTimeAdvice? = null,
        askFailed: Boolean = false,
        dated: Boolean = true,
        findFailed: Boolean = false,
        found: FoundTime? = found(),
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
    fun theSuggestionCoversEverythingUpToFourHoursOrElseReachesEveryTopic() {
        assertEquals(240, suggestedMinutes(found(recommended = 240)))
        assertEquals(45, suggestedMinutes(found(recommended = 300, core = 45)))
        assertNull(suggestedMinutes(tooClose))
        assertNull(suggestedMinutes(found(recommended = null)))
        assertNull(suggestedMinutes(found(pastDate = true)))
    }

    @Test
    fun theTimeShownStartsOnTheSuggestionFollowsItAndKeepsTheLearnersOwn() {
        fun shown(
            first: FoundTime? = found(),
            found: FoundTime? = found(),
            picked: Int? = null,
            settled: Boolean = false,
        ) = shownMinutes(60, first, found, picked, settled)

        assertNull(shown(first = null, found = null))
        assertEquals(35, shown())
        assertEquals(30, shown(found = found(recommended = 30)))
        assertEquals(35, shown(found = tooClose))
        assertEquals(90, shown(picked = 90))
        assertEquals(60, shown(first = tooClose, found = found()))
        assertEquals(60, shown(first = found(recommended = null, pastDate = true), found = null))
        assertEquals(60, shown(first = null, found = null, settled = true))
    }

    @Test
    fun pickingTheSuggestionBackFollowsItAgainWhereItIsFollowed() {
        assertNull(pickedMinutes(found(), found(), 35))
        assertEquals(30, pickedMinutes(found(), found(), 30))
        assertEquals(35, pickedMinutes(tooClose, found(), 35))
    }

    @Test
    fun theLineSaysWhatTheTimeShownMeansOrWhyThatIsNotKnownYet() {
        assertEquals(TimeLine.NoDays, line(hasDays = false))
        assertEquals(TimeLine.Everything(suggested = true), line())
        assertEquals(TimeLine.EveryTopic, line(found = found(recommended = 300, core = 45), minutes = 45))
        assertEquals(TimeLine.Asking, line(minutes = 15))
        assertEquals(TimeLine.Share(0.48), line(advice = advice(), minutes = 15))
        assertEquals(TimeLine.Everything(suggested = false), line(advice = advice(share = 1.0), minutes = 60))
        assertEquals(TimeLine.Working, line(found = null, minutes = null))
        assertEquals(TimeLine.FindFailed, line(findFailed = true, found = null, minutes = 15))
        assertEquals(TimeLine.AskFailed, line(askFailed = true, minutes = 15))
        assertEquals(TimeLine.PastDate, line(found = found(recommended = null, pastDate = true)))
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
        assertFalse(asksAboutTime(dated = true, found = found(pastDate = true), fullCourse = false, minutes = 30))
    }

    @Test
    fun aTooCloseDateIsSaidOnlyWhenNoSensibleTimeCoversEverything() {
        val short = TimeLine.Share(0.15)
        assertNull(tooClose(found(), short))
        assertNull(tooClose(found(pastDate = true), short))
        assertEquals(TooClose(900), tooClose(tooClose, short))
        assertNull(tooClose(tooClose, TimeLine.Everything(suggested = false)))
    }

    @Test
    fun theSuggestionIsOfferedBackOnlyWhileAnotherTimeFallsShort() {
        val short = TimeLine.Share(0.48)
        assertNull(offer(found(), short, 35))
        assertEquals(SuggestedTime(coversEverything = true, minutes = 35), offer(found(), short, 15))
        assertNull(offer(found(recommended = 900, core = 240), TimeLine.Everything(suggested = false), 900))
    }

    @Test
    fun anExamKeepsStudyingEverythingUntilTheTimePickedCoversItAll() {
        assertTrue(keepsFullCourse(true, TimeLine.Asking))
        assertFalse(keepsFullCourse(true, TimeLine.Everything(suggested = false)))
        assertFalse(keepsFullCourse(false, TimeLine.Share(0.4)))
    }

    @Test
    fun aDateBeforeTodayHasPassed() {
        val time = found().time
        assertTrue(foundTime(time, LocalDate(2028, 10, 30)).pastDate)
        assertFalse(foundTime(time, LocalDate(2028, 10, 29)).pastDate)
    }
}
