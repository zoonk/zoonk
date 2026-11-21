package com.zoonk.android.ui.components

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import com.zoonk.android.ui.components.LessonVisual.Plot
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Expected values are what main's `@zoonk/utils/plot-scale` and `getCategoryLabels` give. */
class LessonVisualTest {
    private val width = { label: String -> label.length * 6.6f + 6 }

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
    fun aPlotSpacesXByValueAndFitsYToItsPointsAndReferenceLines() {
        val plot =
            Plot(
                title = "Plot",
                xLabel = "x",
                yLabel = "y",
                series =
                    listOf(
                        Plot.Series("A", Plot.Mark.Points, listOf(Plot.Point(10.0, 27.0), Plot.Point(11.0, 25.0), Plot.Point(20.0, 30.0))),
                    ),
                references = listOf(Plot.Reference("Limit", 40.0)),
            )

        val (x, y) = plotAxes(plot)

        assertEquals(10.0..20.0, x.domain)
        assertEquals(listOf(10.0, 15.0, 20.0), x.ticks)
        assertEquals(25.0..40.0, y.domain)
        assertEquals(listOf(25.0, 30.0, 35.0, 40.0), y.ticks)
    }

    @Test
    fun aPlotKeepsFractionalTicksOnlyWhenItsDataHasFractions() {
        val plot =
            Plot(
                title = "Plot",
                xLabel = "x",
                yLabel = "y",
                series = listOf(Plot.Series("A", Plot.Mark.Points, listOf(Plot.Point(1.0, 0.5), Plot.Point(10.0, 1.5)))),
            )

        val (x, y) = plotAxes(plot)

        assertEquals(listOf(0.0, 5.0, 10.0), x.ticks)
        assertEquals(listOf(0.5, 0.75, 1.0, 1.25, 1.5), y.ticks)
    }

    @Test
    fun pointNamesSitBesideTheirDotsWhenThereIsRoom() {
        val labels = pointLabels(listOf(Offset(50f, 50f) to "Brazil", Offset(150f, 80f) to "Japan"), scene(), ::nameSize, unit = 1f)

        assertEquals(emptyList<KeyEntry>(), labels.key)
        assertEquals(listOf(LabelAnchor.Start, LabelAnchor.Start), labels.labels.map { it.anchor })
        assertEquals(listOf("Brazil", "Japan"), labels.labels.map { it.text })
    }

    @Test
    fun crowdedNamesMoveToANumberedKeyAndNoneIsDropped() {
        val crowded = (0 until 10).map { Offset(150f + it * 0.5f, 80f) to "Country ${it + 1}" }

        val labels = pointLabels(crowded, scene(), ::nameSize, unit = 1f)

        assertEquals(crowded.map { it.second }, labels.key.map { it.label })
        assertEquals((1..10).map(Int::toString), labels.labels.map { it.text })
    }

    @Test
    fun aBareLineMarksOnlyItsEndAndOnlyBesideOtherSeries() {
        assertEquals(listOf(false, false, true), (0..2).map { drawsDot(Plot.Mark.Line, it, 3, 2) })
        assertEquals(listOf(false, false, false), (0..2).map { drawsDot(Plot.Mark.Line, it, 3, 1) })
        assertTrue((0..2).all { drawsDot(Plot.Mark.LineWithPoints, it, 3, 1) && drawsDot(Plot.Mark.Points, it, 3, 1) })
    }

    private fun scene() = LabelScene(Rect(0f, 0f, 300f, 160f), emptyList(), emptyList())

    private fun nameSize(name: String) = Size(name.length * 7f, 14f)

    @Test
    fun aDomainNearTheLargestNumberStaysDrawable() {
        val domain = niceDomain(listOf(0.0, 1.7e308))

        assertTrue(domain.start.isFinite() && domain.endInclusive.isFinite() && domain.endInclusive >= 1.7e308)
        assertTrue(niceTicks(domain, 3).all(Double::isFinite))
        assertEquals(emptyList<Double>(), niceTicks(niceDomain(listOf(-1.7e308, 1.7e308)), 3))
    }

    @Test
    fun barNamesStandUnderTheirBarsInAtMostTwoLines() {
        assertEquals(listOf(listOf("2019"), listOf("2020")), uprightBarLabels(40f, listOf("2019", "2020"), width))
        assertEquals(
            listOf(listOf("Gross", "income"), listOf("Net", "income")),
            uprightBarLabels(50f, listOf("Gross income", "Net income"), width),
        )
    }

    @Test
    fun barsLieOnTheirSideWhenANameDoesntFitUnderItsBar() {
        assertNull(uprightBarLabels(30f, listOf("Brazilian", "Argentinian", "Chilean"), width))
        assertNull(uprightBarLabels(60f, listOf("North America", "South-East Asia"), width))
    }

    @Test
    fun barsLieOnTheirSideOnceTooManySeriesWouldThinThemToSlivers() {
        assertTrue(barsFitSideBySide(band = 70f, series = 7, dp = 1f))
        assertFalse(barsFitSideBySide(band = 70f, series = 8, dp = 1f))
    }

    @Test
    fun aWordWiderThanTheWholeChartBreaksBetweenLettersInsideIt() {
        val word = "Rindfleischetikettierungsüberwachungsaufgabenübertragungsgesetz"
        val labels = categoryLabels(20f, listOf(word, "B"), width)

        assertEquals(2, labels.step)
        assertEquals(word, labels.lines.first().joinToString(""))
        assertTrue(labels.lines.first().all { width(it) <= 40f })
    }

    @Test
    fun lineChartNamesWrapThenSkipWhenAWordDoesntFit() {
        assertEquals(
            CategoryLabels(listOf(listOf("North", "America"), listOf("South-", "East", "Asia")), 1),
            categoryLabels(60f, listOf("North America", "South-East Asia"), width),
        )
        assertEquals(
            CategoryLabels(listOf(listOf("2019"), listOf("2020"), listOf("2021"), listOf("2022")), 2),
            categoryLabels(20f, listOf("2019", "2020", "2021", "2022"), width),
        )
    }
}
