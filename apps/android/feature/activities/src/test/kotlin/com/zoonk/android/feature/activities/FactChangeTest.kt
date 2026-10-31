package com.zoonk.android.feature.activities

import org.junit.Assert.assertEquals
import org.junit.Test

/** Expected values are what main's `fact-change.ts` returns for the same input. */
class FactChangeTest {
    @Test
    fun aChangeReadsAsTimesFromHalvingOrDoublingAndAsAPercentBetween() {
        assertEquals(
            listOf(
                FactChange.Same,
                FactChange.Less(8.3),
                FactChange.Less(2.0),
                FactChange.More(2.0),
                FactChange.More(8.3),
                FactChange.Percent(25.0),
                FactChange.Percent(-20.0),
                FactChange.Same,
                FactChange.Percent(-140.0),
                FactChange.Percent(-49.0),
            ),
            listOf(1.0, 0.12, 0.5, 2.0, 8.333, 1.25, 0.8, 1.000000000001, -0.4, 0.51).map(::describeChange),
        )
    }

    @Test
    fun barsAreSharesOfTheLargerValue() {
        assertEquals(
            listOf(1f to 0.12f, 0f to 0f, 1f to 0.5f),
            listOf(12.5 to 1.5, 0.0 to 0.0, -4.0 to 2.0).map { (before, after) ->
                barShares(before, after)
            },
        )
    }
}
