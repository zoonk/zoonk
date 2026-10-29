package com.zoonk.android.ui.components

import java.math.BigDecimal
import java.math.MathContext
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.log10
import kotlin.math.pow

/** Main's `@zoonk/utils/plot-scale`: a flat domain maps everything to the middle of the range, and a flat range to the domain's start. */
class LinearScale(
    val domain: ClosedFloatingPointRange<Double>,
    val range: Pair<Float, Float>,
) {
    fun toPixel(value: Double): Float {
        val span = domain.endInclusive - domain.start
        val (start, end) = range
        return if (span == 0.0) (start + end) / 2 else (start + (value - domain.start) / span * (end - start)).toFloat()
    }

    fun toValue(position: Float): Double {
        val (start, end) = range
        val span = domain.endInclusive - domain.start
        return if (end == start) domain.start else domain.start + (position - start) / (end - start).toDouble() * span
    }
}

fun niceTicks(
    domain: ClosedFloatingPointRange<Double>,
    count: Int = DEFAULT_TICK_COUNT,
): List<Double> {
    val step = niceStep(domain.endInclusive - domain.start, count)
    val first = ceil(cleanFloat(domain.start / step)) * step
    val total = floor(cleanFloat((domain.endInclusive - first) / step)).toInt()
    return (0..total).map { cleanFloat(first + it * step) }
}

/**
 * Starts at zero by default so bars aren't exaggerated by a cropped axis; line charts of data far
 * from zero pass `includeZero = false`.
 */
fun niceDomain(
    values: List<Double>,
    includeZero: Boolean = true,
    count: Int = DEFAULT_TICK_COUNT,
): ClosedFloatingPointRange<Double> {
    val anchors = values.filter(Double::isFinite) + if (includeZero) listOf(0.0) else emptyList()
    val low = anchors.minOrNull() ?: return 0.0..1.0
    val high = anchors.max()
    if (low == high) return low..low + 1
    val step = niceStep(high - low, count)
    return cleanFloat(floor(cleanFloat(low / step)) * step)..cleanFloat(ceil(cleanFloat(high / step)) * step)
}

private fun niceStep(
    span: Double,
    count: Int,
): Double {
    if (span <= 0 || count <= 0) return 1.0
    val rough = span / count
    val magnitude = 10.0.pow(floor(log10(rough)))
    return (NICE_STEPS.firstOrNull { it * magnitude >= rough } ?: NICE_STEPS.last()) * magnitude
}

/** JavaScript's `Number(value.toPrecision(12))`, which drops floating-point dust like 0.30000000000000004. */
internal fun cleanFloat(value: Double): Double = BigDecimal(value).round(MathContext(PRECISION)).toDouble()

private val NICE_STEPS = listOf(1.0, 2.0, 2.5, 5.0, 10.0)
private const val DEFAULT_TICK_COUNT = 4
private const val PRECISION = 12
