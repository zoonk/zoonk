package com.zoonk.android.feature.activities.geometry

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.key.Key
import org.junit.Assert.assertEquals
import org.junit.Test
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf7Fields.Show as Trig

/** Expected values are what main's `unit-circle-angle.ts` and core's unit circle value return for the same input. */
class UnitCircleAngleTest {
    @Test
    fun stepsLandOnEveryAngleTheLessonNames() {
        assertEquals(
            listOf(5.0, 1.0, 0.5, 0.5),
            listOf(listOf(0.0, 30.0), listOf(0.0, 33.0), listOf(0.0, 22.5), listOf(0.0, 0.3)).map(UnitCircleAngle::step),
        )
    }

    @Test
    fun snapsWithinOneTurn() {
        assertEquals(
            listOf(360.0, 0.0, 30.0, 35.0, 22.5, 360.0),
            listOf(361.0 to 5.0, -3.0 to 5.0, 32.4 to 5.0, 32.6 to 5.0, 22.4 to 0.5, 359.8 to 1.0).map { (degrees, step) ->
                UnitCircleAngle.snap(degrees, step)
            },
        )
    }

    @Test
    fun readsAnglesCounterclockwiseFromTheRight() {
        assertEquals(
            listOf(0.0, 90.0, 180.0, 270.0, 45.0),
            listOf(Offset(10f, 0f), Offset(0f, -10f), Offset(-10f, 0f), Offset(0f, 10f), Offset(5f, -5f)).map {
                UnitCircleAngle.pointerAngle(Offset.Zero, it)
            },
        )
    }

    @Test
    fun keysTurnByAStepAPageOrToTheEnds() {
        val keys =
            listOf(
                Key.DirectionRight,
                Key.DirectionUp,
                Key.DirectionLeft,
                Key.DirectionDown,
                Key.PageUp,
                Key.PageDown,
                Key.MoveHome,
                Key.MoveEnd,
                Key.Enter,
            )
        assertEquals(
            listOf(35.0, 35.0, 25.0, 25.0, 75.0, 0.0, 0.0, 360.0, null),
            keys.map { UnitCircleAngle.afterKey(30.0, it, step = 5.0) },
        )
    }

    @Test
    fun writesAnglesAsMultiplesOfPi() {
        assertEquals(
            listOf("0", "π/6", "π/4", "π/3", "π/2", "5π/6", "π", "3π/2", "11π/6", "2π", null, null),
            listOf(0.0, 30.0, 45.0, 60.0, 90.0, 150.0, 180.0, 270.0, 330.0, 360.0, 7.0, 22.5).map(UnitCircleAngle::piFraction),
        )
    }

    @Test
    fun valuesMatchCoreAndTheTangentCanBeUndefined() {
        assertEquals(
            listOf(
                0.0,
                1.0,
                0.0,
                0.49999999999999994,
                0.8660254037844387,
                0.5773502691896257,
                1.0,
                6.123233995736766e-17,
                null,
                0.7071067811865476,
                -0.7071067811865475,
                -1.0000000000000002,
                -1.0,
                -1.8369701987210297e-16,
                null,
                -2.4492935982947064e-16,
                1.0,
                -2.4492935982947064e-16,
            ),
            listOf(0.0, 30.0, 90.0, 135.0, 270.0, 360.0).flatMap { degrees ->
                listOf(Trig.SIN, Trig.COS, Trig.TAN).map { UnitCircleAngle.value(it, degrees) }
            },
        )
    }
}
