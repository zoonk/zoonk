package com.zoonk.android.feature.activities.geometry

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** The same cases as main's `line-crossing-labels.test.ts`, at one pixel per dp. */
class LineLabelsTest {
    private val area = Rect(22f, 26f, 311f, 222f)
    private val size = Size(50f, 12f)
    private val noMarks = LabelMarks(emptyList(), emptyList(), emptyList())

    private fun gap(
        box: Rect,
        segment: LabelSegment,
    ): Float =
        (0..200).minOf { index ->
            val point = segment.from + (segment.to - segment.from) * (index / 200f)
            Offset(maxOf(box.left - point.x, 0f, point.x - box.right), maxOf(box.top - point.y, 0f, point.y - box.bottom)).getDistance()
        }

    private fun place(
        vararg labels: LineLabel,
        marks: LabelMarks = noMarks,
    ) = placeLineLabels(area, labels.toList(), marks, unit = 1f)

    @Test
    fun keepsANameOffItsLineWhereTheLineLeavesThroughTheChartsTop() {
        val segment = LabelSegment(Offset(22f, 222f), Offset(293f, 26f))
        val box = place(LineLabel(isUpper = true, segment, size)).single()

        assertTrue("gap ${gap(box, segment)}", gap(box, segment) >= 3f)
        assertTrue("gap ${gap(box, segment)}", gap(box, segment) < 20f)
    }

    @Test
    fun putsALowerEndsNameUnderItsLine() {
        val segment = LabelSegment(Offset(22f, 150f), Offset(293f, 90f))
        val box = place(LineLabel(isUpper = false, segment, size)).single()

        assertTrue("top ${box.top}", box.top > 150f)
        assertTrue("gap ${gap(box, segment)}", gap(box, segment) >= 3f)
    }

    @Test
    fun movesANameOffADragHandleInItsWay() {
        val segment = LabelSegment(Offset(22f, 160f), Offset(293f, 100f))
        val handle = LabelCircle(Offset(262f, 80f), radius = 15f)
        val box = place(LineLabel(isUpper = true, segment, size), marks = LabelMarks(listOf(handle), emptyList(), emptyList())).single()
        val nearest = Offset(handle.center.x.coerceIn(box.left, box.right), handle.center.y.coerceIn(box.top, box.bottom))

        assertTrue("box $box", (nearest - handle.center).getDistance() > handle.radius)
    }

    @Test
    fun keepsTwoNamesFromCoveringEachOther() {
        val (one, two) =
            place(
                LineLabel(isUpper = true, LabelSegment(Offset(22f, 200f), Offset(293f, 100f)), size),
                LineLabel(isUpper = true, LabelSegment(Offset(22f, 210f), Offset(293f, 104f)), size),
            )

        assertFalse("$one and $two", one.overlaps(two))
    }

    @Test
    fun keepsANameInsideTheChartAndOffItsLineWhenNoSpotNearbyIsFree() {
        val segment = LabelSegment(Offset(22f, 222f), Offset(293f, 26f))
        val everywhere = LabelCircle(Offset(166f, 124f), radius = 400f)
        val box = place(LineLabel(isUpper = true, segment, size), marks = LabelMarks(listOf(everywhere), emptyList(), emptyList())).single()

        assertTrue("box $box", box.top >= area.top)
        assertTrue("gap ${gap(box, segment)}", gap(box, segment) >= 3f)
    }

    @Test
    fun findsRoomForALongNameAwayFromItsLineRatherThanAcrossIt() {
        val segment = LabelSegment(Offset(22f, 218f), Offset(293f, 26f))
        val box = place(LineLabel(isUpper = true, segment, Size(240f, 24f))).single()

        assertTrue("gap ${gap(box, segment)}", gap(box, segment) >= 3f)
        assertTrue("box $box", box.top >= area.top && box.bottom <= area.bottom)
    }

    @Test
    fun keepsANameTooWideForTheChartOffItsLineByItsEnd() {
        val segment = LabelSegment(Offset(22f, 218f), Offset(293f, 26f))
        val box = place(LineLabel(isUpper = true, segment, Size(320f, 24f))).single()

        assertTrue("gap ${gap(box, segment)}", gap(box, segment) >= 3f)
    }
}
