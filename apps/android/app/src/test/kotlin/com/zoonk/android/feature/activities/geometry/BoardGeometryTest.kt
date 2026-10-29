package com.zoonk.android.feature.activities.geometry

import androidx.compose.ui.input.key.Key
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf6Fields.Measure
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf6FieldsPointsInner.Track
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import kotlin.math.PI

/** Expected values are what main's `board-geometry.ts`, `board-measure.ts`, `board-scale.ts` and `board-marks.ts` return for the same input. */
class BoardGeometryTest {
    private val triangle = listOf(Vec(0.0, 0.0), Vec(4.0, 0.0), Vec(1.0, 3.0))
    private val triangleCorners = listOf(BoardCorner(true, null), BoardCorner(false, null), BoardCorner(true, null))
    private val right = listOf(Vec(0.0, 0.0), Vec(3.0, 0.0), Vec(0.0, 4.0))
    private val rightCorners = listOf(BoardCorner(false, null), BoardCorner(true, Track.HORIZONTAL), BoardCorner(true, Track.VERTICAL))

    private fun assertClose(
        expected: List<Double>,
        actual: List<Double>,
    ) = expected.zip(actual).forEach { (want, got) -> assertEquals(want, got, SLACK) }

    @Test
    fun measuresAnglesSidesAndArea() {
        assertClose(listOf(71.56505117707798, 45.0, 63.43494882292201), BoardGeometry.interiorAngles(triangle))
        assertClose(listOf(4.0, 4.242640687119286, 3.1622776601683795), BoardGeometry.sideLengths(triangle))
        assertEquals(6.0, BoardGeometry.polygonArea(triangle), SLACK)
    }

    @Test
    fun roundedPartsAddUpToTheRoundedTotal() {
        assertEquals(listOf(33.0, 33.0, 34.0, 60.0), BoardGeometry.roundParts(listOf(33.3, 33.3, 33.4, 59.96), 0))
        assertEquals(listOf(72.0, 45.0, 63.0), BoardGeometry.roundParts(listOf(71.565, 45.0, 63.435), 0))
    }

    @Test
    fun drawsASquareOutwardOnEachSide() {
        assertEquals(
            listOf(
                listOf(Vec(0.0, 0.0), Vec(3.0, 0.0), Vec(3.0, -3.0), Vec(0.0, -3.0)),
                listOf(Vec(3.0, 0.0), Vec(0.0, 4.0), Vec(4.0, 7.0), Vec(7.0, 3.0)),
                listOf(Vec(0.0, 4.0), Vec(0.0, 0.0), Vec(-4.0, 0.0), Vec(-4.0, 4.0)),
            ),
            BoardGeometry.sideSquares(right),
        )
    }

    @Test
    fun picksARoundGridStepAndBoundsWithRoomAround() {
        assertEquals(
            listOf(1.0, 1.0, 0.25, 0.1),
            listOf(
                triangle,
                right,
                listOf(Vec(0.0, 0.0), Vec(0.5, 0.0), Vec(0.0, 1.5)),
                listOf(Vec(0.0, 0.0), Vec(0.3, 0.0), Vec(0.0, 0.7)),
            ).map(BoardGeometry::gridStep),
        )
        assertEquals(BoardBounds(-1.0, 5.0, -1.0, 4.0), BoardGeometry.bounds(Measure.ANGLE_SUM, triangle, 1.0))
        assertEquals(BoardBounds(-6.0, 9.0, -5.0, 9.0), BoardGeometry.bounds(Measure.PYTHAGORAS, right, 1.0))
    }

    @Test
    fun movesACornerOnlyToAFairShape() {
        val bounds = BoardGeometry.bounds(Measure.ANGLE_SUM, triangle, 1.0)
        val move = { index: Int, to: Vec ->
            BoardGeometry.moveCorner(
                triangleCorners,
                triangle,
                index,
                to,
                bounds,
                Measure.ANGLE_SUM,
                BoardGeometry.minimumArea(triangle),
                1.0,
            )
        }
        assertEquals(listOf(Vec(0.0, 0.0), Vec(4.0, 0.0), Vec(1.0, 4.0)), move(2, Vec(1.2, 3.8)))
        assertEquals(listOf(Vec(0.0, 0.0), Vec(4.0, 0.0), Vec(5.0, 4.0)), move(2, Vec(9.0, 9.0)))
        assertNull(move(2, Vec(2.0, 0.0)))
        assertNull(move(1, Vec(1.0, 3.0)))
        assertEquals(triangle, move(0, Vec(-0.4, 0.3)))

        val rightBounds = BoardGeometry.bounds(Measure.PYTHAGORAS, right, 1.0)
        assertEquals(
            listOf(Vec(0.0, 0.0), Vec(5.0, 0.0), Vec(0.0, 4.0)),
            BoardGeometry.moveCorner(
                rightCorners,
                right,
                1,
                Vec(5.2, 2.0),
                rightBounds,
                Measure.PYTHAGORAS,
                BoardGeometry.minimumArea(right),
                1.0,
            ),
        )
    }

    @Test
    fun arrowsMoveAGridStepAndSlideAlongATrack() {
        val keys = listOf(Key.DirectionUp, Key.DirectionDown, Key.DirectionLeft, Key.DirectionRight, Key.Enter)
        assertEquals(
            listOf(
                listOf(Vec(0.0, 1.0), Vec(1.0, 0.0), Vec(0.0, 1.0)),
                listOf(Vec(0.0, -1.0), Vec(-1.0, 0.0), Vec(0.0, -1.0)),
                listOf(Vec(-1.0, 0.0), Vec(-1.0, 0.0), Vec(0.0, -1.0)),
                listOf(Vec(1.0, 0.0), Vec(1.0, 0.0), Vec(0.0, 1.0)),
                listOf(null, null, null),
            ),
            keys.map { key -> listOf(null, Track.HORIZONTAL, Track.VERTICAL).map { BoardGeometry.keyOffset(key, 1.0, it) } },
        )
    }

    @Test
    fun readsWhatEachMeasureShows() {
        assertEquals(BoardReading(listOf(72.0, 45.0, 63.0), listOf(0, 1, 2), 180.0, null), readBoard(triangle, Measure.ANGLE_SUM))
        assertEquals(BoardReading(listOf(4.0, 4.2, 3.2), listOf(0, 1, 2), 11.4, null), readBoard(triangle, Measure.PERIMETER))
        assertEquals(BoardReading(emptyList(), emptyList(), 6.0, null), readBoard(triangle, Measure.AREA))
        assertEquals(BoardReading(listOf(9.0, 16.0), listOf(0, 2), 25.0, 1), readBoard(right, Measure.PYTHAGORAS))
        assertEquals(
            BoardReading(listOf(90.0, 90.0, 90.0, 90.0), listOf(0, 1, 2, 3), 360.0, null),
            readBoard(listOf(Vec(0.0, 0.0), Vec(2.0, 0.0), Vec(2.0, 2.0), Vec(0.0, 2.0)), Measure.ANGLE_SUM),
        )
    }

    @Test
    fun scalesTheGridToTheWidthWithYUp() {
        val scale = BoardScale(BoardBounds(-1.0, 5.0, -1.0, 4.0), width = 300f, maxHeight = 340f, padding = 20.0)
        assertEquals(43.333333333333336, scale.unit, SLACK)
        assertEquals(256.6666666666667f, scale.height, 1e-3f)
        assertEquals(Vec(106.66666666666667, 63.333333333333336), scale.toPixel(Vec(1.0, 3.0)))
        val data = scale.toData(Vec(100.0, 100.0))
        assertClose(listOf(0.846153846153846, 2.153846153846154), listOf(data.x, data.y))
    }

    @Test
    fun wedgesSweepInsideEachCornerAndFanOutFromTheLeft() {
        val (rightAngle, rightLabel) = cornerWedge(90.0, Vec(0.0, 0.0), Vec(10.0, 0.0), Vec(0.0, -10.0), radius = 20.0, labelGap = 14.0)
        assertClose(
            listOf(0.0, -PI / 2, 24.041630560342618, -24.041630560342615),
            listOf(rightAngle.from, rightAngle.sweep, rightLabel.x, rightLabel.y),
        )
        val (reflex, reflexLabel) = cornerWedge(270.0, Vec(0.0, 0.0), Vec(10.0, 0.0), Vec(0.0, -10.0), radius = 20.0, labelGap = 14.0)
        assertClose(
            listOf(0.0, 3 * PI / 2, -24.041630560342615, 24.041630560342618),
            listOf(reflex.from, reflex.sweep, reflexLabel.x, reflexLabel.y),
        )
        assertClose(
            listOf(PI, 72 * PI / 180, PI + 72 * PI / 180, 45 * PI / 180, PI + 117 * PI / 180, 63 * PI / 180),
            fanWedges(listOf(72.0, 45.0, 63.0)).flatMap { listOf(it.from, it.sweep) },
        )
    }

    private companion object {
        const val SLACK = 1e-9
    }
}
