package com.zoonk.android.ui.components

import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.components.LessonVisual.Plot
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.util.Locale
import kotlin.math.abs

/** Main's `plot-layout.test.ts` and `plot-scale.test.ts`, with main's estimated label widths so the numbers match. */
@RunWith(AndroidJUnit4::class)
class PlotLayoutTest {
    private val en = Locale.ENGLISH
    private val estimate = PlotText(label = { it.length * 6.6f }, name = { it.length * 6.6f })

    private fun layoutFor(
        visual: Plot,
        width: Float = PHONE,
        text: PlotText = estimate,
    ) = PlotGeometry(visual, width, text, en)

    private fun labelWidth(text: String) = text.length * 6.6f + PLOT_LABEL_GAP

    private fun PlotGeometry.plotWidth() = plotRight - left

    @Test
    fun aSinglePointSitsInTheMiddleOfThePlotNotTheAxesCorner() {
        val layout = layoutFor(SCAN.copy(series = listOf(Plot.Series("Scan", Plot.Mark.Points, listOf(Plot.Point(3.0, 952.0, "Peak"))))))
        val dot = layout.series[0][0]

        assertEquals((layout.left + layout.plotRight) / 2, dot.x, 0.01f)
        assertEquals((layout.y.range.first + layout.y.range.second) / 2, dot.y, 0.01f)
    }

    @Test
    fun theXAxisSpansFromTheFirstDayToTheLast() {
        val layout = layoutFor(CONTROL)

        assertEquals(1.0..10.0, layout.x.domain)
        assertEquals(layout.left, layout.series[0][0].x)
        assertEquals(listOf("2", "4", "6", "8", "10"), layout.xTicks.map { it.label })
    }

    @Test
    fun everyXNumberSitsCenteredUnderItsValueAndOneThatWouldReachTheCornerIsLeftOut() {
        val layout =
            layoutFor(
                CONTROL.copy(
                    series =
                        listOf(
                            Plot.Series("Fill weight", Plot.Mark.Line, listOf(1000.0, 1500.0, 2000.0).map { Plot.Point(it, 500.0) }),
                        ),
                ),
            )

        layout.xTicks.forEach { assertEquals(layout.x.toPixel(it.value), it.center) }
        assertEquals(listOf(1200.0, 1400.0, 1600.0, 1800.0, 2000.0), layout.xTicks.map { it.value })
    }

    @Test
    fun ticksThatDifferPrintAsDifferentNumbers() {
        val layout =
            layoutFor(
                SCAN.copy(
                    series =
                        listOf(
                            Plot.Series("Visitors", Plot.Mark.Points, listOf(10_000.0, 10_150.0, 10_400.0).map { Plot.Point(it, it) }),
                        ),
                ),
            )

        assertEquals(
            layout.yTicks.size,
            layout.yTicks
                .map { it.label }
                .toSet()
                .size,
        )
        assertEquals(
            layout.xTicks.size,
            layout.xTicks
                .map { it.label }
                .toSet()
                .size,
        )
    }

    @Test
    fun noGridlineRunsUnderAReferenceLine() {
        val layout = layoutFor(CONTROL)
        val target = layout.yTicks.first { it.value == 500.0 }

        assertEquals("500", target.label)
        assertFalse(target.line)
        assertEquals(layout.yTicks.size - 1, layout.yTicks.count { it.line })
    }

    @Test
    fun referenceNamesSitPastThePlotsRightEdgeWithoutOverlapping() {
        val layout = layoutFor(CONTROL)
        val (upper, target, lower) = layout.references

        assertEquals(listOf("Upper limit", "Target", "Lower limit"), layout.references.map { it.label })
        assertTrue(layout.plotRight + PLOT_LABEL_GAP + labelWidth("Upper limit") <= PHONE + PLOT_LABEL_GAP)
        assertEquals(layout.y.toPixel(503.0), upper.y)
        assertTrue(target.top - upper.top >= 14)
        assertTrue(lower.top - target.top >= 14)
    }

    @Test
    fun theNamesColumnIsAsWideAsItsWidestWrappedLine() {
        val layout = layoutFor(FINE_SCAN, 300f)

        assertEquals(listOf("Needed", "tonight"), layout.references[0].lines)
        assertEquals(300f - PLOT_DOT_ROOM - PLOT_LABEL_GAP - labelWidth("tonight"), layout.plotRight, 0.01f)
    }

    @Test
    fun linesTooCloseToNameApartAreNumberedEachLevelWithItsLine() {
        val layout =
            layoutFor(
                CONTROL.copy(
                    references =
                        listOf(
                            Plot.Reference("Upper limit", 501.0),
                            Plot.Reference("Upper warning limit", 500.6),
                            Plot.Reference("Target", 500.0),
                        ),
                ),
            )

        assertEquals(
            listOf(KeyEntry("1", "Upper limit"), KeyEntry("2", "Upper warning limit"), KeyEntry("3", "Target")),
            layout.key,
        )
        layout.references.forEach { assertEquals(it.y, it.top + 7, 0.01f) }

        val (upper, warning, target) = layout.references
        assertTrue(warning.x > upper.x)
        assertTrue(warning.x > target.x)
    }

    @Test
    fun linesWhoseNamesCantFitBesideTheNarrowestPlotAreNumbered() {
        val layout = layoutFor(CONTROL.copy(references = listOf(Plot.Reference("Temperaturgrenze", 502.0))), 220f)

        assertEquals(listOf(KeyEntry("1", "Temperaturgrenze")), layout.key)
        assertEquals(listOf("1"), layout.references[0].lines)
        assertTrue(layout.plotWidth() >= MIN_PLOT_WIDTH)
    }

    @Test
    fun theKeysNumbersContinueFromTheLinesToThePoints() {
        val layout =
            layoutFor(
                SCAN.copy(
                    references = listOf(Plot.Reference("Temperaturgrenze", 900.0)),
                    series =
                        listOf(
                            Plot.Series(
                                "Sites",
                                Plot.Mark.Points,
                                listOf("North", "South", "East").mapIndexed { index, place ->
                                    Plot.Point(5 + index * 0.05, 850.0 + index, "$place warehouse")
                                },
                            ),
                        ),
                ),
                200f,
            )

        assertEquals(listOf("1", "2", "3", "4"), layout.key.map { it.marker })
        assertEquals(listOf("2", "3", "4"), layout.labels.map { it.text })
    }

    @Test
    fun aPointOnThePlotsRightEdgeKeepsClearOfTheReferenceNames() {
        listOf(PHONE, 200f).forEach { width ->
            val layout = layoutFor(CONTROL, width)

            assertEquals(layout.plotRight, layout.series[0].last().x)
            layout.references.forEach { assertTrue(it.x - layout.plotRight > PLOT_DOT_ROOM + PLOT_LABEL_GAP / 2) }
        }
    }

    @Test
    fun crowdedXNumbersThinOutOnANarrowPhone() {
        val wide = layoutFor(CONTROL)
        val narrow = layoutFor(CONTROL, 254f, PlotText(label = { it.length * 20f }, name = { it.length * 20f }))

        assertTrue(wide.xTicks.size > narrow.xTicks.size)
    }

    @Test
    fun withoutReferencesThePlotUsesTheFullWidth() {
        assertEquals(PHONE - 8, layoutFor(SCAN).plotRight)
    }

    @Test
    fun crowdedNamesMoveToANumberedKeyAndNoneIsDropped() {
        val names = listOf("North", "South", "East", "West", "Center", "Harbor", "Airport", "Hills").map { "$it warehouse" }
        val layout =
            layoutFor(
                SCAN.copy(
                    series =
                        listOf(
                            Plot.Series(
                                "Sites",
                                Plot.Mark.Points,
                                names.mapIndexed { index, label -> Plot.Point(5 + index * 0.1, 150.0 + index, label) } +
                                    listOf(Plot.Point(0.0, 100.0), Plot.Point(10.0, 200.0)),
                            ),
                        ),
                ),
            )

        assertEquals(names, layout.key.map { it.label })
        assertEquals(names.indices.map { "${it + 1}" }, layout.labels.map { it.text })
    }

    @Test
    fun theDrawingsTextStopsGrowingWhereThePlotWouldPassItsFloor() {
        val scale = plotTextScale(FINE_SCAN, SMALL_PHONE_CARD, LARGEST_TEXT, estimate, en)
        val layout = layoutFor(FINE_SCAN, SMALL_PHONE_CARD / scale)

        assertTrue(scale > 1 && scale < LARGEST_TEXT)
        assertTrue(layout.plotWidth() >= MIN_PLOT_WIDTH - 0.01f)
        assertEquals(emptyList<KeyEntry>(), layout.key)
        assertEquals(listOf("Needed", "tonight"), layout.references[0].lines)
    }

    @Test
    fun theDrawingsTextFollowsTheReadersSizeWhereThePlotKeepsItsRoomAndNeverShrinks() {
        assertEquals(LARGEST_TEXT, plotTextScale(FINE_SCAN, 640f, LARGEST_TEXT, estimate, en))
        assertEquals(1f, plotTextScale(FINE_SCAN, 100f, 1f, estimate, en))
    }

    @Test
    fun aFlatAxisCentersItsValue() {
        assertEquals(4.0..6.0, niceDomain(listOf(5.0, 5.0), includeZero = false))
        assertEquals(0.4, niceDomain(listOf(0.5), includeZero = false).start, 1e-12)
        assertEquals(0.6, niceDomain(listOf(0.5), includeZero = false).endInclusive, 1e-12)
        assertEquals(0.0..1.0, niceDomain(listOf(0.0, 0.0)))
    }

    @Test
    fun theXAxisSpansMonthsWithRoundTicksInside() {
        val (x, _) = plotAxes(plot(listOf(1.0, 4.0, 8.0, 12.0).map { Plot.Point(it, it) }))

        assertEquals(1.0..12.0, x.domain)
        assertEquals(listOf(2.0, 4.0, 6.0, 8.0, 10.0, 12.0), x.ticks)
    }

    @Test
    fun aSinglePointSitsInTheMiddleOfBothAxes() {
        val (x, y) = plotAxes(plot(listOf(Plot.Point(3.0, 952.5))))

        assertEquals(2.0..4.0, x.domain)
        assertEquals(952.5 * 2, y.domain.start + y.domain.endInclusive, 1e-9)
    }

    @Test
    fun ticksPrintAsManyDecimalsAsTheirStepNeeds() {
        assertEquals(listOf("1,000", "1,000.5", "1,001"), formatTicks(listOf(1000.0, 1000.5, 1001.0), en))
        assertEquals(listOf("0", "0.25", "0.5"), formatTicks(listOf(0.0, 0.25, 0.5), en))
    }

    @Test
    fun largeTicksShortenOnlyWhenEveryShortenedTickStaysExact() {
        assertEquals(listOf("10K", "10.1K", "10.2K"), formatTicks(listOf(10_000.0, 10_100.0, 10_200.0), en))
        assertEquals(listOf("10,000", "10,025", "10,050"), formatTicks(listOf(10_000.0, 10_025.0, 10_050.0), en))
    }

    @Test
    fun aCroppedCategoryAxisPrintsTicksThatTellApartWithTheChartsUnit() {
        val ticks = niceTicks(10_000.0..10_400.0)

        assertEquals(listOf("10K", "10.1K", "10.2K", "10.3K", "10.4K"), formatTicks(ticks, en))
        assertEquals(
            listOf("10,000\u00a0km", "10,025\u00a0km", "10,050\u00a0km"),
            formatTicks(listOf(10_000.0, 10_025.0, 10_050.0), en, unit = "km"),
        )
    }

    @Test
    fun aPlotKeepsAPercentOnEachTickTheWayACategoryChartDoes() {
        val labels = layoutFor(CONTROL.copy(references = emptyList(), yLabel = "Yield", yUnit = "%")).yTicks.map { it.label }

        assertTrue(labels.isNotEmpty())
        assertTrue(labels.all { it.endsWith("%") })
        assertTrue(layoutFor(CONTROL.copy(references = emptyList())).yTicks.none { "ml" in it.label })
    }

    @Test
    fun yearsOnTheXAxisHaveNoThousandsSeparator() {
        assertEquals(listOf("1960", "1980"), formatTicks(listOf(1960.0, 1980.0), en, xAxis = true))
        assertEquals(listOf("950", "1.000"), formatTicks(listOf(950.0, 1000.0), Locale.forLanguageTag("pt")))
    }

    @Test
    fun threeReferencesWithinOneUnitAreNumberedLevelWithTheirLines() {
        val layout =
            layoutFor(
                CONTROL.copy(
                    references = listOf(Plot.Reference("High", 501.0), Plot.Reference("Mid", 500.6), Plot.Reference("Low", 500.2)),
                ),
            )

        assertEquals(listOf("1", "2", "3"), layout.key.map { it.marker })
        layout.references.forEach { assertTrue(abs(it.top + 7 - it.y) < 0.01f) }
    }

    private fun plot(points: List<Plot.Point>) =
        Plot(title = "Plot", xLabel = "x", yLabel = "y", series = listOf(Plot.Series("A", Plot.Mark.Points, points)))

    private companion object {
        const val PHONE = 324f
        const val SMALL_PHONE_CARD = 296f
        const val LARGEST_TEXT = 2f

        val SCAN =
            Plot(
                title = "Detector scan",
                xLabel = "Detector position",
                xUnit = "mm",
                yLabel = "Count rate",
                yUnit = "counts/s",
                series =
                    listOf(
                        Plot.Series(
                            "Scan",
                            Plot.Mark.Points,
                            listOf(0.5 to 810.0, 1.5 to 880.0, 3.0 to 985.0, 4.5 to 890.0, 5.5 to 820.0).mapIndexed { index, (x, y) ->
                                Plot.Point(x, y, "ABCDE"[index].toString())
                            },
                        ),
                    ),
            )

        val FINE_SCAN =
            SCAN.copy(
                title = "Finer scan, B to D",
                references = listOf(Plot.Reference("Needed tonight", 960.0)),
                series =
                    listOf(
                        Plot.Series(
                            "Fine scan",
                            Plot.Mark.LineWithPoints,
                            listOf(
                                1.5 to 880.0,
                                2.0 to 930.0,
                                2.25 to 968.0,
                                2.5 to 992.0,
                                2.75 to 975.0,
                                3.0 to 952.0,
                                3.25 to 925.0,
                                3.5 to 905.0,
                                4.0 to 893.0,
                                4.5 to 890.0,
                            ).map { (x, y) -> Plot.Point(x, y) },
                        ),
                    ),
            )

        val CONTROL =
            Plot(
                title = "Bottle fill weight, last 10 days",
                xLabel = "Day",
                yLabel = "Fill weight",
                yUnit = "ml",
                series =
                    listOf(
                        Plot.Series(
                            "Fill weight",
                            Plot.Mark.LineWithPoints,
                            listOf(499.8, 500.6, 499.3, 501.0, 500.4, 501.6, 502.3, 503.8, 502.9, 502.1).mapIndexed { index, y ->
                                Plot.Point(index + 1.0, y)
                            },
                        ),
                    ),
                references =
                    listOf(
                        Plot.Reference("Upper limit", 503.0),
                        Plot.Reference("Target", 500.0),
                        Plot.Reference("Lower limit", 497.0),
                    ),
            )
    }
}
