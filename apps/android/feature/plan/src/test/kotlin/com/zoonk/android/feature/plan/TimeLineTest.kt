package com.zoonk.android.feature.plan

import org.junit.Assert.assertEquals
import org.junit.Test

class TimeLineTest {
    private fun lineAt(advice: LineAdvice) =
        timeLine(
            advice = advice,
            askFailed = false,
            dated = true,
            findFailed = false,
            found = timeToCover(focus = 240),
            hasDays = true,
            minutes = 60,
        )

    @Test
    fun aDatedPlanThatDoesNotSayWhatItsTimeReachesShowsNoShareInsteadOfNone() {
        val line = lineAt(LineAdvice(coveredShare = 0.4, reachedShare = null, endDate = null))

        assertEquals(TimeLine.Share(null), line)
    }

    @Test
    fun aTimeThatCoversEverythingKeptSaysTheWholeGoalOnlyWhenNoSubjectWasTakenOut() {
        assertEquals(TimeLine.Everything(whole = true), lineAt(LineAdvice(coveredShare = 1.0, reachedShare = 1.0, endDate = null)))
        assertEquals(TimeLine.Everything(whole = false), lineAt(LineAdvice(coveredShare = 1.0, reachedShare = 0.79, endDate = null)))
        assertEquals(TimeLine.Everything(whole = true), lineAt(LineAdvice(coveredShare = 1.0, reachedShare = null, endDate = null)))
    }

    @Test
    fun theSuggestedTimeThatCoversEverythingKeptSaysTheWholeGoalOnlyWhenNoSubjectWasTakenOut() {
        fun suggestedLine(reachedShare: Double) =
            timeLine(
                advice = null,
                askFailed = false,
                dated = true,
                findFailed = false,
                found = timeToCover(recommended = 45, reachedShare = reachedShare),
                hasDays = true,
                minutes = 45,
            )

        assertEquals(TimeLine.Everything(whole = true), suggestedLine(1.0))
        assertEquals(TimeLine.Everything(whole = false), suggestedLine(0.79))
    }
}
