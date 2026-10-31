package com.zoonk.android.feature.activities

import androidx.compose.ui.input.key.Key
import com.zoonk.android.ui.components.LinearScale
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Expected values are what main's `snap-value.ts` and `plot-scale.ts` return for the same input. */
class SnapValueTest {
    private val range = SnapRange(min = 0.0, max = 12.0, step = 0.5)

    @Test
    fun snapsToAReachablePositionWithoutFloatNoise() {
        assertEquals(7.5, snapToStep(7.3, range), 0.0)
        assertEquals(0.3, snapToStep(0.1 + 0.2, SnapRange(0.0, 1.0, 0.1)), 0.0)
        assertEquals(0.1255, snapToStep(0.12545, SnapRange(0.124, 0.126, 0.0001)), 0.0)
    }

    @Test
    fun countsStepsFromTheMinimumAndStaysInRange() {
        assertEquals(4.0, snapToStep(4.0, SnapRange(-5.0, 9.0, 3.0)), 0.0)
        assertEquals(12.0, snapToStep(40.0, range), 0.0)
        assertEquals(0.0, snapToStep(-3.0, range), 0.0)
        assertEquals(9.3, snapToStep(9.9, SnapRange(0.3, 10.0, 3.0)), 0.0)
    }

    @Test
    fun halfwayRoundsUpLikeJavaScript() {
        assertEquals(-2.0, snapToStep(-2.5, SnapRange(-5.0, 5.0, 1.0)), 0.0)
        assertEquals(-3.0, snapToStep(-3.5, SnapRange(-5.0, 5.0, 1.0)), 0.0)
    }

    @Test
    fun aSliderReachesItsMaximumWhenItsStepsDoNot() {
        val uneven = SnapRange(0.0, 10.0, 3.0)
        assertEquals(4, sliderStops(uneven))
        assertEquals(listOf(0.0, 3.0, 6.0, 9.0, 10.0), (0..4).map { sliderValue(it, uneven) })
        assertEquals(listOf(0, 3, 4), listOf(0.0, 9.0, 10.0).map { sliderStop(it, uneven) })

        assertEquals(24, sliderStops(range))
        assertEquals(12.0, sliderValue(24, range), 0.0)
        assertEquals(10, sliderStops(SnapRange(0.0, 1.0, 0.1)))
    }

    @Test
    fun keysMoveLikeANativeSlider() {
        assertEquals(5.5, valueAfterKey(Key.DirectionRight, 5.0, range))
        assertEquals(4.5, valueAfterKey(Key.DirectionDown, 5.0, range))
        assertEquals(10.0, valueAfterKey(Key.PageUp, 5.0, range))
        assertEquals(0.0, valueAfterKey(Key.MoveHome, 5.0, range))
        assertEquals(12.0, valueAfterKey(Key.MoveEnd, 5.0, range))
        assertEquals(12.0, valueAfterKey(Key.PageUp, 11.0, range))
        assertEquals(0.0, valueAfterKey(Key.PageDown, 3.0, range))
        assertEquals(0.3, valueAfterKey(Key.DirectionUp, 0.2, SnapRange(0.0, 1.0, 0.1)))
        assertNull(valueAfterKey(Key.Enter, 5.0, range))
    }

    @Test
    fun findsMultiplesDespiteFloatNoise() {
        assertTrue(isMultiple(0.3, 0.1))
        assertFalse(isMultiple(0.35, 0.1))
        assertTrue(isMultiple(1e12 + 1, 1.0))
        assertTrue(isMultiple(-7.5, 2.5))
    }

    @Test
    fun scalesTurnPixelsBackIntoValues() {
        assertEquals(1.0, LinearScale(-5.0..7.0, 20f to 380f).toValue(200f), 0.0)
        assertEquals(3.0, LinearScale(3.0..9.0, 50f to 50f).toValue(10f), 0.0)
        assertEquals(75.0, LinearScale(0.0..100.0, 300f to 12f).toValue(84f), 0.0)
    }

    @Test
    fun upStaysUpOnAnAxisThatGrowsDownward() {
        val growingUp = LinearScale(0.0..10.0, 200f to 0f)
        val growingDown = LinearScale(0.0..10.0, 0f to 200f)

        assertFalse(growsDownward(PlaceOrientation.Vertical, growingUp))
        assertTrue(growsDownward(PlaceOrientation.Vertical, growingDown))
        assertFalse(growsDownward(PlaceOrientation.Horizontal, growingDown))
        assertEquals(Key.DirectionDown, flipVerticalKey(Key.DirectionUp))
        assertEquals(Key.DirectionUp, flipVerticalKey(Key.DirectionDown))
        assertEquals(Key.DirectionLeft, flipVerticalKey(Key.DirectionLeft))
    }
}
