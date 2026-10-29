package com.zoonk.android.feature.activities

import org.junit.Assert.assertEquals
import org.junit.Test

/** Expected values are what main's `guess-scale.ts` returns for the same input. */
class GuessScaleTest {
    private val log = GuessScale(min = 1.0, max = 3650.0, log = true)
    private val linear = GuessScale(min = 0.0, max = 100.0, log = false)
    private val belowZero = GuessScale(min = -5.0, max = 7.0, log = false)

    @Test
    fun placesValuesOnLinearAndLogScales() {
        assertEquals(
            listOf(1.0, 4.560623071215921, 60.415229867972855, 3649.9999999999995, 3649.9999999999995),
            listOf(0, 37, 100, 200, 250).map(log::valueAt),
        )
        assertEquals(listOf(0.0, 18.5, 100.0), listOf(0, 37, 200).map(linear::valueAt))
        assertEquals(listOf(0.0, 0.2984968949525126, 1.0, 1.0), listOf(0.5, 11.57, 3650.0, 5000.0).map(log::shareOf))
        assertEquals(listOf(0.0, 0.4166666666666667, 1.0), listOf(-5.0, 0.0, 7.0).map(belowZero::shareOf))
    }

    @Test
    fun ticksShowPowersOfTenOrRoundSteps() {
        assertEquals(listOf(1.0, 10.0, 100.0, 1000.0), log.ticks())
        assertEquals(listOf(0.0, 25.0, 50.0, 75.0, 100.0), linear.ticks())
        assertEquals(listOf(-5.0, 0.0, 5.0, 7.0), belowZero.ticks())
        assertEquals(listOf(1.0, 100.0, 10_000.0, 1_000_000.0, 100_000_000.0), GuessScale(1.0, 1e9, log = true).ticks())
        assertEquals(listOf(2.0, 9.0), GuessScale(2.0, 9.0, log = true).ticks())
    }

    @Test
    fun guessesKeepTwoSignificantDigits() {
        assertEquals(
            listOf(12.0, 1.3, -1.3, 0.046, 96.0, 120_000.0),
            listOf(11.574, 1.25, -1.25, 0.0456, 95.5, 123_456.0).map(::roundGuess),
        )
    }

    @Test
    fun aFarGuessSaysHowManyTimesOff() {
        assertEquals(GuessComparison.Close, compareGuess(actual = 11.57, guess = 11.6, isCorrect = true))
        assertEquals(GuessComparison.TooBig(3.5), compareGuess(actual = 11.57, guess = 40.0, isCorrect = false))
        assertEquals(GuessComparison.TooSmall(5.8), compareGuess(actual = 11.57, guess = 2.0, isCorrect = false))
        assertEquals(GuessComparison.Off(1.4299999999999997), compareGuess(actual = 11.57, guess = 13.0, isCorrect = false))
        assertEquals(GuessComparison.Off(5.0), compareGuess(actual = -3.0, guess = 2.0, isCorrect = false))
    }
}
