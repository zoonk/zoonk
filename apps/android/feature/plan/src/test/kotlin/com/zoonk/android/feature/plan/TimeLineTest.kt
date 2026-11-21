package com.zoonk.android.feature.plan

import org.junit.Assert.assertEquals
import org.junit.Test

class TimeLineTest {
    @Test
    fun aDatedPlanThatDoesNotSayWhatItsTimeReachesShowsNoShareInsteadOfNone() {
        val line =
            timeLine(
                advice = LineAdvice(coveredShare = 0.4, reachedShare = null, endDate = null),
                askFailed = false,
                dated = true,
                findFailed = false,
                found = timeToCover(focus = 240),
                hasDays = true,
                minutes = 60,
            )

        assertEquals(TimeLine.Share(null), line)
    }
}
