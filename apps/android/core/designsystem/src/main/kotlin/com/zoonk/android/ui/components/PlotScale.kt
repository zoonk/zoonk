package com.zoonk.android.ui.components

import com.zoonk.android.ui.format.formatAmount
import com.zoonk.android.ui.format.fractionDigitsFor
import java.math.BigDecimal
import java.math.MathContext
import java.util.Locale
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.log10
import kotlin.math.pow
import kotlin.math.sqrt

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
    if (!step.isFinite()) return emptyList()
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
    if (low == high) return if (includeZero) 0.0..1.0 else padFlat(low)
    val step = niceStep(high - low, count)
    val start = floor(cleanFloat(low / step)) * step
    val end = ceil(cleanFloat(high / step)) * step
    // Rounding out to a whole step can pass the largest number a double holds.
    return if (start.isFinite() && end.isFinite()) cleanFloat(start)..cleanFloat(end) else low..high
}

class PlotAxis(
    val domain: ClosedFloatingPointRange<Double>,
    val ticks: List<Double>,
)

fun plotAxes(plot: LessonVisual.Plot): Pair<PlotAxis, PlotAxis> {
    val points = plot.series.flatMap { it.points }
    return plotXAxis(points.map { it.x }) to plotYAxis(points.map { it.y } + plot.references.map { it.y })
}

/** The x axis spans the data and no further, so the points fill the plot; its round ticks sit inside it. One x value sits in the middle. */
private fun plotXAxis(values: List<Double>): PlotAxis {
    val finite = values.filter(Double::isFinite)
    val low = finite.minOrNull() ?: return PlotAxis(0.0..1.0, listOf(0.0, 1.0))
    val high = finite.max()
    val domain = if (low == high) padFlat(low) else low..high
    return PlotAxis(domain, wholeTicks(ticksWithin(domain, nearestStep(domain.endInclusive - domain.start)), finite))
}

private fun plotYAxis(values: List<Double>): PlotAxis {
    val domain = niceDomain(values, includeZero = false)
    return PlotAxis(domain, wholeTicks(niceTicks(domain), values))
}

private fun wholeTicks(
    ticks: List<Double>,
    values: List<Double>,
): List<Double> = if (values.all { it == floor(it) }) ticks.filter { it == floor(it) } else ticks

/** One whole unit for a whole number, else its own order of magnitude: 3 gives 2–4, 0.5 gives 0.4–0.6. */
private fun padFlat(value: Double): ClosedFloatingPointRange<Double> {
    val pad = if (value == floor(value)) 1.0 else 10.0.pow(floor(log10(abs(value))))
    return cleanFloat(value - pad)..cleanFloat(value + pad)
}

/** The round step nearest `span / count` on a log scale, so ticks fill a span without running past it. */
private fun nearestStep(span: Double): Double {
    val rough = span / DEFAULT_TICK_COUNT
    val magnitude = 10.0.pow(floor(log10(rough)))
    val factor =
        ROUND_FACTORS
            .withIndex()
            .firstOrNull { (index, round) ->
                rough / magnitude >= sqrt(round * (ROUND_FACTORS.getOrNull(index + 1) ?: round))
            }?.value ?: 1.0
    return factor * magnitude
}

private fun ticksWithin(
    domain: ClosedFloatingPointRange<Double>,
    step: Double,
): List<Double> {
    if (!step.isFinite() || step <= 0) return emptyList()
    val first = ceil(cleanFloat(domain.start / step))
    val last = floor(cleanFloat(domain.endInclusive / step))
    if (last < first) return emptyList()
    return (0..(last - first).toInt()).map { cleanFloat((first + it) * step) }
}

fun isLarge(values: List<Double>) = values.any { abs(it) >= COMPACT_FROM }

/**
 * Main's `formatTicks`: as many decimals as the step between ticks needs, and large numbers shortened ("12.5K") only
 * where every shortened tick stays exact, so no two ticks print the same. The x axis groups digits only in large
 * numbers, so years don't read as "2,024". A chart's [unit] stays on each number.
 */
fun formatTicks(
    ticks: List<Double>,
    locale: Locale,
    xAxis: Boolean = false,
    unit: String? = null,
): List<String> {
    val first = ticks.firstOrNull() ?: 0.0
    val large = isLarge(ticks)
    val digits = ticks.getOrNull(1)?.let { decimalsOf(it - first) } ?: fractionDigitsFor(first)

    if (large) {
        val compact = ticks.map { formatAmount(it, locale, unit, compact = true, maximumFractionDigits = COMPACT_FRACTION_DIGITS) }
        val exact = ticks.map { formatAmount(it, locale, unit, compact = true, maximumFractionDigits = MAX_FRACTION_DIGITS) }
        if (compact == exact) return compact
    }

    return ticks.map { formatAmount(it, locale, unit, maximumFractionDigits = digits, grouping = !xAxis || large) }
}

private fun decimalsOf(step: Double): Int =
    BigDecimal(cleanFloat(step).toString()).stripTrailingZeros().scale().coerceIn(0, MAX_FRACTION_DIGITS)

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
fun cleanFloat(value: Double): Double = BigDecimal(value).round(MathContext(PRECISION)).toDouble()

private val NICE_STEPS = listOf(1.0, 2.0, 2.5, 5.0, 10.0)
private val ROUND_FACTORS = listOf(10.0, 5.0, 2.0, 1.0)
private const val COMPACT_FROM = 10_000
private const val COMPACT_FRACTION_DIGITS = 2
private const val MAX_FRACTION_DIGITS = 20
private const val DEFAULT_TICK_COUNT = 4
private const val PRECISION = 12
