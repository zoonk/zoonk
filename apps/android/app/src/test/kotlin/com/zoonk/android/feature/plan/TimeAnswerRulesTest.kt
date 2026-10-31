package com.zoonk.android.feature.plan

import com.zoonk.api.models.PlanTimeToCover
import com.zoonk.api.models.PlanTimeToCoverMost
import com.zoonk.api.models.PlanTimeToCoverSuggested
import kotlinx.datetime.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class TimeAnswerRulesTest {
    private fun found(
        recommended: Long? = 35,
        suggested: PlanTimeToCoverSuggested? = everythingAt(35),
        most: PlanTimeToCoverMost? = null,
        pastDate: Boolean = false,
    ) = PlanTimeToCover(
        fittingDate = null,
        most = most,
        pastDate = pastDate,
        ready = true,
        recommendedMinutes = recommended,
        suggested = suggested,
        targetDate = LocalDate(2028, 10, 29),
        targetDateNamedMonth = false,
    )

    private fun everythingAt(minutes: Long) =
        PlanTimeToCoverSuggested(
            coveredShare = 1.0,
            everyTopic = true,
            kind = PlanTimeToCoverSuggested.Kind.EVERYTHING,
            minutes = minutes,
            split = null,
        )

    private val focus =
        PlanTimeToCoverSuggested(
            coveredShare = 0.32,
            everyTopic = false,
            kind = PlanTimeToCoverSuggested.Kind.FOCUS,
            minutes = 240,
            split = null,
        )

    /** 805 minutes a day cover everything, so core suggests 4 hours that focus. */
    private val focusFound = found(recommended = 805, suggested = focus)

    /** No day covers everything by the date. */
    private val tooClose = found(recommended = null, suggested = focus)

    private fun plateauAt(minutes: Long) = tooClose.copy(most = PlanTimeToCoverMost(coveredShare = 0.99, minutes = minutes))

    private fun line(
        advice: LineAdvice? = null,
        askFailed: Boolean = false,
        dated: Boolean = true,
        findFailed: Boolean = false,
        found: PlanTimeToCover? = found(),
        hasDays: Boolean = true,
        minutes: Int? = 35,
    ) = timeLine(advice, askFailed, dated, findFailed, found, hasDays, minutes)

    private val short = TimeLine.Share(0.15)
    private val covers = TimeLine.Everything(suggested = false)

    @Test
    fun theLineSaysWhyTheSuggestedTimeWithoutAskingThePlanAgain() {
        assertEquals(TimeLine.NoDays, line(hasDays = false))
        assertEquals(TimeLine.Everything(suggested = true), line())
        assertEquals(TimeLine.Focus(coveredShare = 0.32, everyTopic = false), line(found = focusFound, minutes = 240))
    }

    @Test
    fun theLineSaysWhatAnotherTimeCoversOnceThePlanAnswersForIt() {
        assertEquals(TimeLine.Asking, line(minutes = 15))
        assertEquals(TimeLine.Share(0.48), line(advice = LineAdvice(0.48, null), minutes = 15))
        assertEquals(covers, line(advice = LineAdvice(1.0, null), minutes = 60))
        assertEquals(TimeLine.Share(0.29), line(advice = LineAdvice(0.29, null), found = null, minutes = 120))
    }

    @Test
    fun theLineSaysTheTimeIsBeingWorkedOutOrThatItCouldntBe() {
        assertEquals(TimeLine.Working, line(found = null, minutes = null))
        assertEquals(TimeLine.FindFailed, line(findFailed = true, found = null, minutes = 15))
        assertEquals(TimeLine.AskFailed, line(askFailed = true, minutes = 15))
        assertEquals(TimeLine.PastDate, line(found = found(recommended = null, suggested = null, pastDate = true)))
    }

    @Test
    fun anUndatedGoalsLineSaysWhenItWouldFinish() {
        assertEquals(TimeLine.Asking, line(dated = false, found = null, minutes = 15))
        assertEquals(
            TimeLine.Finish(LocalDate(2027, 3, 15)),
            line(advice = LineAdvice(null, LocalDate(2027, 3, 15)), dated = false, found = null, minutes = 15),
        )
        assertEquals(TimeLine.NoFinish, line(advice = LineAdvice(null, null), dated = false, found = null, minutes = 15))
    }

    @Test
    fun whatEverythingTakesIsSaidOnlyBesideAFocusSuggestion() {
        assertNull(fullTimeNote(found(), short, studiesEveryDay = true))
        assertNull(fullTimeNote(found(recommended = null, suggested = null, pastDate = true), short, studiesEveryDay = true))
        assertEquals(
            FullTimeNote.Takes(FullTime(coveredShare = 1.0, everything = true, minutes = 805), moreDays = false),
            fullTimeNote(focusFound, short, studiesEveryDay = true),
        )
    }

    @Test
    fun moreStudyDaysHelpWhileSomeDaysAreLeftEvenWhenNoDayCoversItAll() {
        assertEquals(FullTimeNote.Takes(full = null, moreDays = true), fullTimeNote(tooClose, short, studiesEveryDay = false))
        assertEquals(FullTimeNote.Takes(full = null, moreDays = false), fullTimeNote(tooClose, short, studiesEveryDay = true))
    }

    @Test
    fun theTimeThatCoversEverythingIsSaidToBeMoreThanMostPeopleKeepUp() {
        assertEquals(FullTimeNote.TooLong, fullTimeNote(focusFound, covers, studiesEveryDay = true))
    }

    @Test
    fun theSuggestionIsOfferedBackOnlyWhileAnotherTimeFallsShort() {
        assertNull(timeOffer(found(), TimeLine.Share(0.48), 35))
        assertEquals(TimeOffer(OfferKind.Everything, 35), timeOffer(found(), TimeLine.Share(0.48), 15))
        assertNull(timeOffer(found(recommended = 240, suggested = everythingAt(240)), covers, 900))
    }

    @Test
    fun besideAFocusTheFullTimeIsOfferedAndBesideAnyOtherTheFocus() {
        val focusLine = line(found = focusFound, minutes = 240)

        assertEquals(TimeOffer(OfferKind.Full, 805), timeOffer(focusFound, focusLine, 240))
        assertEquals(TimeOffer(OfferKind.Focus, 240), timeOffer(focusFound, covers, 805))
        assertEquals(TimeOffer(OfferKind.Focus, 240), timeOffer(focusFound, TimeLine.Share(0.48), 120))
        assertNull(timeOffer(tooClose, focusLine, 240))
    }

    @Test
    fun aGoalPartOfWhichNeverFitsSaysWhatTheMostAnyTimeCoversTakesWithoutMoreDays() {
        val half = TimeLine.Share(0.5)

        assertEquals(
            FullTimeNote.Takes(FullTime(coveredShare = 0.99, everything = false, minutes = 480), moreDays = false),
            fullTimeNote(plateauAt(480), half, studiesEveryDay = false),
        )
        assertEquals(TimeOffer(OfferKind.Full, 480), timeOffer(plateauAt(480), half, 240))
    }

    @Test
    fun nothingMoreIsSaidOnceTheSuggestionAlreadyCoversTheMost() {
        val atTheMost = focus.copy(coveredShare = 0.99, everyTopic = true, minutes = 195)
        val found = found(recommended = null, suggested = atTheMost, most = PlanTimeToCoverMost(coveredShare = 0.99, minutes = 195))
        val focusLine = line(found = found, minutes = 195)

        assertNull(fullTimeNote(found, focusLine, studiesEveryDay = false))
        assertNull(timeOffer(found, focusLine, 195))
    }

    @Test
    fun onlyATimeThatCoversEverythingIsMarkedAsCoveringEverything() {
        assertEquals(MarkedTimes(full = null, suggested = 240), markedTimes(plateauAt(480)))
        assertEquals(MarkedTimes(full = 805, suggested = 240), markedTimes(focusFound))
        assertEquals(MarkedTimes(full = null, suggested = 35), markedTimes(found()))
        assertEquals(MarkedTimes(full = null, suggested = null), markedTimes(null))
    }
}
