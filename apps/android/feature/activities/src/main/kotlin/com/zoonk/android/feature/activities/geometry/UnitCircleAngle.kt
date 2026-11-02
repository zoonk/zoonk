package com.zoonk.android.feature.activities.geometry

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.key.Key
import com.zoonk.android.feature.activities.SnapRange
import com.zoonk.android.feature.activities.snapToStep
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.roundToLong
import kotlin.math.sin
import kotlin.math.tan
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf7Fields.Show as Trig

/** Main's `unit-circle-angle.ts`: angles in degrees, one turn from 0 to 360. */
internal object UnitCircleAngle {
    const val FULL_TURN = 360.0
    const val HALF_TURN = 180.0

    /** 5° when every angle the lesson names sits on it, so the check's angle can be reached; else 1° or half a degree. */
    fun step(angles: List<Double>): Double = ANGLE_STEPS.firstOrNull { step -> angles.all { isMultiple(it, step) } } ?: FINE_STEP

    fun snap(
        degrees: Double,
        step: Double,
    ): Double = snapToStep(degrees, SnapRange(0.0, FULL_TURN, step))

    /** The angle of [pixel] around [center], counterclockwise from the right like on paper. */
    fun pointerAngle(
        center: Offset,
        pixel: Offset,
    ): Double {
        val degrees = atan2((center.y - pixel.y).toDouble(), (pixel.x - center.x).toDouble()) * HALF_TURN / PI
        return if (degrees < 0) degrees + FULL_TURN else degrees
    }

    fun afterKey(
        degrees: Double,
        key: Key,
        step: Double,
    ): Double? {
        val turn =
            when (key) {
                Key.DirectionRight, Key.DirectionUp -> step
                Key.DirectionLeft, Key.DirectionDown -> -step
                Key.PageUp -> PAGE_TURN
                Key.PageDown -> -PAGE_TURN
                Key.MoveEnd -> FULL_TURN
                Key.MoveHome -> -FULL_TURN
                else -> return null
            }
        return snap(degrees + turn, step)
    }

    /** A multiple of π people write, like "5π/6"; null otherwise. */
    fun piFraction(degrees: Double): String? {
        val turns = degrees / HALF_TURN
        val denominator =
            PI_DENOMINATORS.firstOrNull { abs(turns * it - (turns * it).roundToLong()) < PI_SLACK } ?: return null
        val numerator = (turns * denominator).roundToLong()
        if (numerator == 0L) return "0"
        val top = if (numerator == 1L) "π" else "${numerator}π"
        return if (denominator == 1) top else "$top/$denominator"
    }

    /** Core's value of [trig] at [degrees]; null for a tangent that doesn't exist. */
    fun value(
        trig: Trig,
        degrees: Double,
    ): Double? {
        val radians = degrees * PI / HALF_TURN
        return when (trig) {
            Trig.SIN -> sin(radians)
            Trig.COS -> cos(radians)
            Trig.TAN -> if (abs(cos(radians)) < TANGENT_LIMIT) null else tan(radians)
        }
    }

    private fun isMultiple(
        value: Double,
        step: Double,
    ): Boolean {
        val ratio = value / step
        return abs(ratio - ratio.roundToLong()) < MULTIPLE_SLACK
    }

    private val ANGLE_STEPS = listOf(5.0, 1.0)
    private val PI_DENOMINATORS = listOf(1, 2, 3, 4, 6, 12)
    private const val FINE_STEP = 0.5
    private const val MULTIPLE_SLACK = 1e-3
    private const val PAGE_TURN = 45.0
    private const val PI_SLACK = 1e-6
    private const val TANGENT_LIMIT = 1e-9
}
