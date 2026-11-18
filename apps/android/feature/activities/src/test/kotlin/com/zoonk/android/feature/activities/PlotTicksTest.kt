package com.zoonk.android.feature.activities

import com.zoonk.android.ui.components.LinearScale
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** A caller's ticks show only when their labels, placed as the axis draws them, don't overlap. */
class PlotTicksTest {
    private val quarterTurns = listOf(0.0, 90.0, 180.0, 270.0, 360.0)
    private val axis = LinearScale(0.0..360.0, 44f to 284f)

    @Test
    fun endLabelsAreCheckedWhereTheAxisPullsThemInside() {
        // 60 px apart: wide labels fit when centered, but "360°" is pulled inside the plot onto "270°".
        assertFalse(axis.fitsSideBySide(quarterTurns.map { it to 48 }))
        assertTrue(axis.fitsSideBySide(quarterTurns.map { it to 24 }))
    }
}
