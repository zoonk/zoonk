package com.zoonk.android.feature.activities

import com.zoonk.android.ui.components.LinearScale
import org.junit.Assert.assertEquals
import org.junit.Test

/** A chart's own ticks show when their labels fit where the axis draws them; otherwise sparser ones that do. */
class PlotTicksTest {
    private val turns = listOf(0.0, 90.0, 180.0, 270.0, 360.0)
    private val halves = listOf(0.0, 180.0, 360.0)
    private val ends = listOf(0.0, 360.0)
    private val axis = LinearScale(0.0..360.0, 44f to 284f)
    private val dice = LinearScale(1.5..12.5, 44f to 284f)

    private fun LinearScale.wave(width: Int) = fittedTicks(turns, listOf(halves, ends), GAP) { width }

    @Test
    fun aDenserChoiceShowsOnlyWhenItsLabelsKeepTheirGapWhereTheAxisDrawsThem() {
        assertEquals(turns, axis.wave(24))
        // 3 px apart at the ends, short of the 4 px gap.
        assertEquals(halves, axis.wave(38))
        // "360°" is pulled inside the plot onto "270°", so the half turns show instead of round numbers.
        assertEquals(halves, axis.wave(48))
        assertEquals(ends, axis.wave(110))
    }

    @Test
    fun aChartsOwnTicksShowInOrderWhateverOrderTheyComeIn() {
        assertEquals(listOf(2.0, 7.0, 12.0), dice.fittedTicks(listOf(2.0, 12.0, 7.0), null, GAP) { 12 })
    }

    @Test
    fun roundTicksShowWhenAChartsOwnTicksDoNotFit() {
        val shown = dice.fittedTicks(listOf(2.0, 3.0, 12.0), null, GAP) { 40 }
        assertEquals(listOf(5.0, 10.0), shown)
    }

    private companion object {
        const val GAP = 4f
    }
}
