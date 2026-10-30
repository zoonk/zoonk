package com.zoonk.android.feature.activities.geometry

import com.zoonk.android.feature.activities.PlaceOrientation
import com.zoonk.android.feature.activities.SnapRange
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf15FieldsShift.Direction
import org.junit.Assert.assertEquals
import org.junit.Test

/** Expected values are what main's `line-crossing-model.ts` and core's `shiftLine` and `crossing` return for the same input. */
class LineCrossingModelTest {
    private val supply = Line(intercept = 1.0, slope = 0.5)
    private val demand = Line(intercept = 10.0, slope = -1.0)
    private val cost = Line(intercept = 2000.0, slope = 5.0)
    private val revenue = Line(intercept = 0.0, slope = 15.0)
    private val sideways = PlaceOrientation.Horizontal
    private val upright = PlaceOrientation.Vertical

    @Test
    fun movesALineSidewaysOrUpright() {
        assertEquals(
            listOf(Line(2.0, 0.5), Line(0.25, 0.5), Line(2500.0, 5.0), Line(1875.0, 5.0)),
            listOf(
                LineCrossingModel.moved(supply, -2.0, sideways),
                LineCrossingModel.moved(supply, 1.5, sideways),
                LineCrossingModel.moved(cost, 500.0, upright),
                LineCrossingModel.moved(cost, -125.0, upright),
            ),
        )
    }

    @Test
    fun findsWhereTwoLinesCross() {
        assertEquals(
            listOf(Vec(6.0, 4.0), Vec(5.333333333333333, 4.666666666666666), Vec(250.0, 3750.0), Vec(0.0, 0.0)),
            listOf(
                LineCrossingModel.crossing(supply, demand),
                LineCrossingModel.crossing(LineCrossingModel.moved(supply, -2.0, sideways), demand),
                LineCrossingModel.crossing(LineCrossingModel.moved(cost, 500.0, upright), revenue),
                LineCrossingModel.crossing(supply, supply),
            ),
        )
    }

    @Test
    fun fitsEveryReachableCrossingInTheChart() {
        assertEquals(Vec(10.833333333333332, 12.5), LineCrossingModel.domain(2.0, sideways, supply, demand))
        assertEquals(Vec(375.0, 5625.0), LineCrossingModel.domain(500.0, upright, cost, revenue))
    }

    @Test
    fun drawsOnlyTheVisiblePartOfALine() {
        val eggs = Vec(10.833333333333332, 12.5)
        assertEquals(
            listOf(
                Vec(0.0, 1.0) to Vec(10.833333333333332, 6.416666666666666),
                Vec(0.0, 10.0) to Vec(10.0, 0.0),
                Vec(0.0, 3.0) to Vec(10.833333333333332, 3.0),
                Vec(0.0, -50.0) to Vec(0.0, -50.0),
            ),
            listOf(supply, demand, Line(3.0, 0.0), Line(-50.0, 1.0)).map { LineCrossingModel.segment(it, eggs) },
        )
        assertEquals(
            listOf(Vec(8.883333333333331, 5.4416666666666655), Vec(8.2, 1.8000000000000007)),
            listOf(supply, demand).map { LineCrossingModel.along(it, eggs, 0.82) },
        )
    }

    @Test
    fun handlesReachTwiceTheShiftInQuarterSteps() {
        assertEquals(
            listOf(SnapRange(-4.0, 4.0, 0.5), SnapRange(-1000.0, 1000.0, 125.0), SnapRange(-0.6, 0.6, 0.075)),
            listOf(2.0, 500.0, 0.3).map(LineCrossingModel::range),
        )
    }

    @Test
    fun readsWhichWayACrossingMoved() {
        assertEquals(
            listOf(Change.Up, Change.Same, Change.Same, Change.Down),
            listOf(4.0 to 4.666666666666666, 4.0 to 4.0, 1000.0 to 1000.0 + 1e-7, 6.0 to 5.3).map { (before, after) ->
                LineCrossingModel.change(before, after)
            },
        )
    }

    @Test
    fun namesTheDirectionOfAMove() {
        assertEquals(
            listOf(Direction.LEFT, Direction.UP, Direction.DOWN, Direction.RIGHT),
            listOf(-1.0 to sideways, 125.0 to upright, -0.5 to upright, 0.5 to sideways).map { (offset, axis) ->
                LineCrossingModel.direction(offset, axis)
            },
        )
    }
}
