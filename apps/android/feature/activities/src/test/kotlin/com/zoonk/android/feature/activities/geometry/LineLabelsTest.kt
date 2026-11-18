package com.zoonk.android.feature.activities.geometry

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** The same cases as main's `line-crossing-labels.test.ts`, at one pixel per dp. */
class LineLabelsTest {
    private val area = Rect(22f, 26f, 311f, 222f)
    private val size = Size(50f, 12f)
    private val noMarks = LabelMarks(arrows = emptyList(), circles = emptyList(), lines = emptyList())

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
    ) = placeLineLabels(area, labels.toList(), marks, unit = 1f).map { requireNotNull(it) }

    @Test
    fun movesOnlyTheNameCrossedByTheAnswer() {
        val own = LabelSegment(Offset(22f, 104f), Offset(311f, 100f))
        val other = LabelSegment(Offset(22f, 170f), Offset(311f, 160f))
        val answer = LabelSegment(Offset(22f, 86f), Offset(311f, 86f))
        val shown = listOf(LineLabel(true, own, size), LineLabel(true, other, size))
        val before = placeChartLabels(area, shown, emptyList(), noMarks, 1f)
        val after = placeChartLabels(area, shown, listOf(LineLabel(false, answer, size)), noMarks, 1f)

        assertEquals(Rect(253f, 80f, 303f, 92f), before[0])
        assertEquals(Rect(253f, 104f, 303f, 116f), after[0])
        assertEquals(before[1], after[1])
    }

    @Test
    fun keepsANameCloserToItsLineThanADottedGuide() {
        val own = LabelSegment(Offset(22f, 104f), Offset(311f, 100f))
        val guide = LabelSegment(Offset(22f, 76f), Offset(311f, 76f))
        val marks = noMarks.copy(lines = listOf(guide))
        val box = requireNotNull(placeChartLabels(area, listOf(LineLabel(true, own, size)), emptyList(), marks, 1f).single())

        assertTrue(gap(box, own) < gap(box, guide))
    }

    @Test
    fun crossedNameKeepsItsSideOfTheAnswerAt320DpWithLargestText() {
        fun segment(
            x: Float,
            y: Float,
            endX: Float,
            endY: Float,
        ) = LabelSegment(Offset(x, y), Offset(endX, endY))

        val plot = Rect(0f, 0f, 230f, 248f)
        val supply = segment(0f, 248f, 230f, 141f)
        val demand = segment(0f, 50f, 214f, 248f)
        val original = segment(0f, 229f, 230f, 121f)
        val answer = segment(0f, 208f, 230f, 101f)
        val guides = listOf(segment(0f, 182f, 140f, 182f), segment(140f, 182f, 140f, 248f))
        val shown =
            listOf(
                LineLabel(true, supply, Size(55f, 23f)),
                LineLabel(true, demand, Size(68f, 23f)),
                LineLabel(false, original, Size(55f, 23f), isOptional = true),
            )
        val marks = noMarks.copy(lines = guides)
        val before = placeChartLabels(plot, shown, emptyList(), marks, 1f)
        val after = placeChartLabels(plot, shown, listOf(LineLabel(false, answer, Size(82f, 46f))), marks, 1f)
        val box = requireNotNull(after[2])

        assertTrue(gap(requireNotNull(before[2]), answer) < 1f)
        assertEquals(before.take(2), after.take(2))
        assertTrue(box.center.y > 208f - 107f * box.center.x / 230f)
        assertTrue(gap(box, answer) >= 3f)
        assertTrue(gap(box, original) < 40f)
    }

    @Test
    fun keepsANameOffItsLineWhereTheLineLeavesThroughTheChartsTop() {
        val segment = LabelSegment(Offset(22f, 222f), Offset(293f, 26f))
        val box = place(LineLabel(isUpper = true, segment, size)).single()

        assertTrue("gap ${gap(box, segment)}", gap(box, segment) >= 3f)
        assertTrue("gap ${gap(box, segment)}", gap(box, segment) < 20f)
    }

    @Test
    fun putsADashedCopiesNameUnderTheUpperEndOfItsLine() {
        val segment = LabelSegment(Offset(22f, 150f), Offset(293f, 90f))
        val box = place(LineLabel(isUpper = false, segment, size)).single()

        assertTrue("top ${box.top}", box.top > 90f && box.top < 150f)
        assertTrue("gap ${gap(box, segment)}", gap(box, segment) >= 3f)
    }

    @Test
    fun movesANameOffADragHandleInItsWay() {
        val segment = LabelSegment(Offset(22f, 160f), Offset(293f, 100f))
        val handle = LabelCircle(Offset(262f, 80f), radius = 15f)
        val box =
            place(
                LineLabel(isUpper = true, segment, size),
                marks = LabelMarks(arrows = emptyList(), circles = listOf(handle), lines = emptyList()),
            ).single()
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
        val box =
            place(
                LineLabel(isUpper = true, segment, size),
                marks = LabelMarks(arrows = emptyList(), circles = listOf(everywhere), lines = emptyList()),
            ).single()

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

    @Test
    fun keepsANameClearOfAnArrowHeadIncludedEvenWhenNoSpotNearbyIsFree() {
        val segment = LabelSegment(Offset(22f, 222f), Offset(293f, 26f))
        val everywhere = LabelCircle(Offset(166f, 124f), radius = 400f)
        val arrow = Rect(230f, 26f, 244f, 87f)
        val box =
            place(
                LineLabel(isUpper = true, segment, size),
                marks = LabelMarks(arrows = listOf(arrow), circles = listOf(everywhere), lines = emptyList()),
            ).single()
        val gap =
            Offset(
                maxOf(arrow.left - box.right, 0f, box.left - arrow.right),
                maxOf(arrow.top - box.bottom, 0f, box.top - arrow.bottom),
            ).getDistance()

        assertTrue("box $box", gap >= 3f)
        assertTrue("gap ${gap(box, segment)}", gap(box, segment) >= 3f)
    }

    @Test
    fun leavesAnOptionalNameOutWhenNoSpotClearsTheMarksAndKeepsTheOthers() {
        val segment = LabelSegment(Offset(22f, 222f), Offset(293f, 26f))
        val everywhere = LabelCircle(Offset(166f, 124f), radius = 400f)
        val (name, optional) =
            placeLineLabels(
                area,
                listOf(LineLabel(isUpper = true, segment, size), LineLabel(isUpper = false, segment, size, isOptional = true)),
                LabelMarks(arrows = emptyList(), circles = listOf(everywhere), lines = emptyList()),
                unit = 1f,
            )

        assertNotNull(name)
        assertNull(optional)
    }
}
