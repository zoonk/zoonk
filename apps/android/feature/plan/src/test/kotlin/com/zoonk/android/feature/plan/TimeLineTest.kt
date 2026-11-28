package com.zoonk.android.feature.plan

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class TimeLineTest {
    private fun lineAt(
        minutes: Int,
        recommended: Long? = 45,
        focus: Long? = null,
    ) = timeLine(
        advice = null,
        askFailed = false,
        dated = true,
        findFailed = false,
        found = timeToCover(recommended = recommended, focus = focus),
        hasDays = true,
        minutes = minutes,
    )

    @Test
    fun aDatedGoalsLineIsTheSuggestionWhateverTimeIsPicked() {
        val suggested = TimeLine.Suggest(minutes = 45, focus = false)

        assertEquals(suggested, lineAt(minutes = 20))
        assertEquals(suggested, lineAt(minutes = 45))
        assertEquals(suggested, lineAt(minutes = 300))
    }

    @Test
    fun aSuggestionCappedAtFourHoursSaysThePlanStartsWithWhatMattersMost() {
        assertEquals(TimeLine.Suggest(minutes = 240, focus = true), lineAt(minutes = 60, recommended = 805, focus = 240))
        assertEquals(TimeLine.Suggest(minutes = 240, focus = true), lineAt(minutes = 60, recommended = null, focus = 240))
    }

    @Test
    fun theSuggestionIsOfferedOnlyUnderAShorterTime() {
        assertEquals(45, timeOffer(lineAt(minutes = 20), minutes = 20))
        assertNull(timeOffer(lineAt(minutes = 45), minutes = 45))
        assertNull(timeOffer(lineAt(minutes = 120), minutes = 120))
        assertEquals(240, timeOffer(lineAt(minutes = 60, recommended = 805, focus = 240), minutes = 60))
    }

    @Test
    fun anUndatedGoalsLineIsItsForecastEvenPastTheYearsAPlanLaysOut() {
        fun undated(advice: LineAdvice) =
            timeLine(advice, false, dated = false, findFailed = false, found = null, hasDays = true, minutes = 30)

        assertEquals(TimeLine.Finish(PlanForecast.Beyond), undated(LineAdvice(PlanForecast.Beyond)))
        assertEquals(TimeLine.NoFinish, undated(LineAdvice(null)))
    }
}
