package com.zoonk.android.ui.components

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** Expected values are what main's `@zoonk/utils/plot-scale` and `getCategoryLabels` give. */
class LessonVisualTest {
    @Test
    fun niceDomainsAndTicksMatchMain() {
        val cases =
            listOf(
                Triple(listOf(12.0, 47.0), true, listOf(0.0, 20.0, 40.0, 60.0)),
                Triple(listOf(0.3, 0.71), true, listOf(0.0, 0.2, 0.4, 0.6, 0.8)),
                Triple(listOf(1980.0, 2021.0), false, listOf(1980.0, 2000.0, 2020.0, 2040.0)),
                Triple(listOf(-4.0, 9.0), true, listOf(-5.0, 0.0, 5.0, 10.0)),
                Triple(listOf(5.0, 5.0), true, listOf(0.0, 2.0, 4.0, 6.0)),
                Triple(listOf(103.0, 104.5), false, listOf(103.0, 103.5, 104.0, 104.5)),
            )

        cases.forEach { (values, includeZero, ticks) ->
            assertEquals(ticks, niceTicks(niceDomain(values, includeZero)))
        }
    }

    @Test
    fun aDomainNearTheLargestNumberStaysDrawable() {
        val domain = niceDomain(listOf(0.0, 1.7e308))

        assertTrue(domain.start.isFinite() && domain.endInclusive.isFinite() && domain.endInclusive >= 1.7e308)
        assertTrue(niceTicks(domain, 3).all(Double::isFinite))
        assertEquals(emptyList<Double>(), niceTicks(niceDomain(listOf(-1.7e308, 1.7e308)), 3))
    }

    @Test
    fun categoryLabelsSplitThenSkipWhenTheyDontFit() {
        val width = { label: String -> label.length * 6.6f + 6 }

        assertEquals(CategoryLabels(listOf(listOf("2019"), listOf("2020")), 1), categoryLabels(40f, listOf("2019", "2020"), width))
        assertEquals(
            CategoryLabels(listOf(listOf("Gross", "income"), listOf("Net", "income")), 1),
            categoryLabels(50f, listOf("Gross income", "Net income"), width),
        )
        assertEquals(
            CategoryLabels(listOf(listOf("North America"), listOf("South-East Asia")), 2),
            categoryLabels(60f, listOf("North America", "South-East Asia"), width),
        )
        assertEquals(3, categoryLabels(30f, listOf("Brazilian", "Argentinian", "Chilean"), width).step)
    }
}
