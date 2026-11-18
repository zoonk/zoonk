package com.zoonk.android.feature.activities

import com.zoonk.android.ui.components.LinearScale
import org.junit.Assert.assertEquals
import org.junit.Test

/** A chart's own ticks, densest choice first, show as far as their labels fit where the axis draws them. */
class PlotTicksTest {
    private val turns = listOf(listOf(0.0, 90.0, 180.0, 270.0, 360.0), listOf(0.0, 180.0, 360.0), listOf(0.0, 360.0))
    private val axis = LinearScale(0.0..360.0, 44f to 284f)

    @Test
    fun aDenserChoiceShowsOnlyWhenItsLabelsKeepTheirGapWhereTheAxisDrawsThem() {
        assertEquals(turns[0], axis.fittedChoice(turns) { 24 })
        // 3 px apart at the ends, short of the 4 px gap round ticks keep.
        assertEquals(turns[1], axis.fittedChoice(turns) { 38 })
        // "360°" is pulled inside the plot onto "270°", so the half turns show instead of round numbers.
        assertEquals(turns[1], axis.fittedChoice(turns) { 48 })
        assertEquals(turns[2], axis.fittedChoice(turns) { 110 })
    }

    @Test
    fun aChartsOwnTicksShowInOrderWhateverOrderTheyComeIn() {
        val dice = LinearScale(1.5..12.5, 44f to 284f)
        assertEquals(listOf(2.0, 7.0, 12.0), dice.fittedChoice(listOf(listOf(2.0, 12.0, 7.0))) { 12 })
    }
}
