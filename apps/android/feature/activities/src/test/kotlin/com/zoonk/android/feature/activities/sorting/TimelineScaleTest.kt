package com.zoonk.android.feature.activities.sorting

import org.junit.Assert.assertEquals
import org.junit.Test

/** Main's `timeline-scale.test.ts`. */
class TimelineScaleTest {
    @Test
    fun writesNegativeYearsAsBceAndAddsCeOnlyWhenTheAxisReachesBce() {
        assertEquals(30L to Era.Bce, yearLabel(-30, start = -3000))
        assertEquals(1969L to Era.Ce, yearLabel(1969, start = -3000))
        assertEquals(1969L to null, yearLabel(1969, start = 1900))
    }

    @Test
    fun givesRoundYearsAndSkipsYearZero() {
        assertEquals(listOf(-3000L, -2000L, -1000L, 1000L, 2000L), yearTicks(-3000, 2000))
        assertEquals(listOf(1900L, 1920L, 1940L, 1960L, 1980L, 2000L), yearTicks(1900, 2000))
    }

    @Test
    fun movesAboutAHundredthOfTheAxisInARoundNumberOfYears() {
        assertEquals(listOf(50L, 1L, 1L), listOf(yearStep(-3000, 2000), yearStep(1900, 2000), yearStep(1914, 1918)))
    }

    @Test
    fun landsOnAStepFromTheStartAndStaysOnTheAxis() {
        assertEquals(-50L, snapYear(-37.0, start = -3000, end = 2000))
        assertEquals(2000L, snapYear(2400.0, start = -3000, end = 2000))
        assertEquals(1917L, snapYear(1917.4, start = 1910, end = 1920))
    }

    @Test
    fun roundsBigGapsAndKeepsSmallOnesExact() {
        assertEquals(listOf(2500L, 2000L, 66L), listOf(2530L, 1998L, 66L).map(::roundedGap))
    }

    @Test
    fun skipsTheMissingYearZero() {
        assertEquals(listOf(1L, 1998L, 4L), listOf(yearsBetween(-1, 1), yearsBetween(1969, -30), yearsBetween(1914, 1918)))
    }

    @Test
    fun pushesCloseLabelsApartAndKeepsThemInside() {
        assertEquals(listOf(100f, 140f, 290f), spreadLabels(listOf(100f, 110f, 290f), gap = 40f, top = 0f, bottom = 300f))
        assertEquals(listOf(60f, 20f, 100f), spreadLabels(listOf(95f, 90f, 99f), gap = 40f, top = 0f, bottom = 100f))
        assertEquals(listOf(200f, 20f), spreadLabels(listOf(200f, 20f), gap = 40f, top = 0f, bottom = 300f))
    }

    @Test
    fun ordersByYearThenByWhenTheLearnerPlacedThem() {
        assertEquals(listOf("cleo", "pyramid", "moon"), placedOrder(listOf("moon" to 1969L, "cleo" to -50L, "pyramid" to -50L)))
    }
}
