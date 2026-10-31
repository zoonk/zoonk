package com.zoonk.android.feature.activities.math

import androidx.compose.ui.geometry.Offset
import com.zoonk.android.ui.components.cleanFloat
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.sin

/** A jump drawn from `from` to `to` on the line: its curve's control point, its arrowhead's wings and where its label sits. */
internal data class JumpArc(
    val control: Offset,
    val wings: Pair<Offset, Offset>,
    val label: Offset,
)

internal data class NumberLineTick(
    val value: Double,
    val isLabelled: Boolean,
)

/** Main's `jumpArc`, higher for longer jumps; its sizes are main's pixels times [unit], a dp in pixels. */
internal fun jumpArc(
    baseline: Float,
    from: Float,
    to: Float,
    unit: Float = 1f,
): JumpArc {
    val height = (abs(to - from) * ARC_RISE).coerceIn(MIN_ARC_HEIGHT * unit, MAX_ARC_HEIGHT * unit)
    val control = Offset((from + to) / 2, baseline - 2 * height)
    val angle = atan2(baseline - control.y, to - control.x)
    val head = HEAD_LENGTH * unit
    val wing = { side: Int ->
        val wingAngle = angle + PI.toFloat() + side * HEAD_ANGLE
        Offset(to + head * cos(wingAngle), baseline + head * sin(wingAngle))
    }

    return JumpArc(control, wing(-1) to wing(1), Offset(control.x, baseline - height - head))
}

internal fun jumpStops(
    start: Double,
    moves: List<Double>,
): List<Double> = moves.runningFold(start) { stop, move -> stop + move }

/**
 * Every step gets a tick. Long lines, or labels too wide for their ticks (at large font sizes), label
 * every [minEvery]th or more, counted from zero so zero's neighbors never crowd its label.
 */
internal fun numberLineTicks(
    min: Double,
    max: Double,
    step: Double,
    minEvery: Int = 1,
): List<NumberLineTick> {
    val count = floor((max - min) / step + FLOAT_SLACK).toInt()
    val values = (0..count).map { cleanFloat(min + it * step) }
    val every = maxOf(minEvery, if (values.size > MAX_LABELLED_TICKS) 2 else 1)
    val anchor = values.indexOf(0.0).coerceAtLeast(0)
    return values.mapIndexed { index, value -> NumberLineTick(value, (index - anchor) % every == 0) }
}

/** Main's readout: the start, each jump with its sign, and where they land ("−3 + 3 + 5 = 5"). */
internal fun numberLineEquation(
    start: Double,
    jumps: List<Double>,
    format: (Double) -> String,
): String {
    if (jumps.isEmpty()) return format(start)
    val terms = jumps.map { "${if (it < 0) "−" else "+"} ${format(abs(it))}" }
    return (listOf(format(start)) + terms).joinToString(" ") + " = ${format(jumps.fold(start, Double::plus))}"
}

private const val ARC_RISE = 0.45f
private const val MAX_ARC_HEIGHT = 64f
private const val MIN_ARC_HEIGHT = 18f
private const val HEAD_LENGTH = 7f
private const val HEAD_ANGLE = (PI / 6).toFloat()
private const val FLOAT_SLACK = 1e-9
private const val MAX_LABELLED_TICKS = 13
