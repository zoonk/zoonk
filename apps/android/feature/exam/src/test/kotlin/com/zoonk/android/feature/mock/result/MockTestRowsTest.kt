package com.zoonk.android.feature.mock.result

import com.zoonk.api.models.MockPoints
import com.zoonk.api.models.MockPointsPartsInner
import com.zoonk.api.models.PointsMinimum
import com.zoonk.api.models.WritingRangeOutput
import com.zoonk.api.models.WrittenPartPoints
import com.zoonk.api.models.WrittenPartPointsMinimum
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MockTestRowsTest {
    private fun part(
        name: String,
        met: Boolean?,
    ) = MockPointsPartsInner(
        asked = 20.0,
        earned = 12.0,
        max = 20.0,
        met = met,
        minimum = PointsMinimum(PointsMinimum.Unit.POINTS, 14.0),
        projected = null,
        short = if (met == false) 2.0 else null,
        name = name,
        qualifying = false,
    )

    private fun points(
        vararg parts: MockPointsPartsInner,
        minimum: PointsMinimum? = null,
    ) = MockPoints(
        asked = 40.0,
        earned = 24.0,
        max = 40.0,
        met = null,
        minimum = minimum,
        projected = null,
        short = null,
        parts = parts.toList(),
        unjudged = emptyList(),
    )

    @Test
    fun aMissedTestMinimumKeepsTheTotalInDetails() {
        val rows = testRows(points(part("Reading", met = true), part("Writing", met = false)))

        assertEquals(listOf("Writing", "Reading", null), rows.map { it.name })
    }

    @Test
    fun withEveryMinimumMetAndNoCombinedOneTheTotalStaysOut() {
        val rows = testRows(points(part("Reading", met = true), part("Writing", met = true)))

        assertEquals(listOf("Reading", "Writing"), rows.map { it.name })
    }

    @Test
    fun aCombinedMinimumAlwaysShowsTheTotal() {
        val rows = testRows(points(part("Reading", met = true), minimum = PointsMinimum(PointsMinimum.Unit.POINTS, 20.0)))

        assertEquals(listOf("Reading", null), rows.map { it.name })
    }

    @Test
    fun aWrittenMinimumNeverLetsTheResultSayEveryMinimumWasReached() {
        val reached = points(part("Reading", met = true), part("Writing", met = true))
        val written =
            WrittenPartPoints(
                max = 100.0,
                minimum = WrittenPartPointsMinimum(WrittenPartPointsMinimum.Unit.POINTS, 50.0),
                name = "Discursive test",
                range = WritingRangeOutput(high = 64.0, low = 58.0),
                standing = WrittenPartPoints.Standing.MET,
                tasks = emptyList(),
            )

        assertTrue(reachedEveryMinimum(reached))
        assertFalse(reachedEveryMinimum(reached.copy(written = listOf(written))))
    }
}
