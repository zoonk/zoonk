package com.zoonk.android.feature.activities.math

import com.zoonk.android.feature.activities.isMultiple
import com.zoonk.android.ui.components.niceTicks
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf9Fields
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf9FieldsDistribution
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf9FieldsHandles
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.exp
import kotlin.math.floor
import kotlin.math.log10
import kotlin.math.pow
import kotlin.math.sign
import kotlin.math.sqrt
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf9FieldsDistribution.PlayableLibraryStepAnyOfContentOneOf9FieldsDistributionOneOf1Value as UniformValue
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf9FieldsDistribution.PlayableLibraryStepAnyOfContentOneOf9FieldsDistributionOneOfValue as NormalValue

internal typealias DistributionFields = PlayableLibraryStepAnyOfContentOneOf9Fields
internal typealias Distribution = PlayableLibraryStepAnyOfContentOneOf9FieldsDistribution
internal typealias Interval = PlayableLibraryStepAnyOfContentOneOf9FieldsHandles

internal fun percentBetween(
    distribution: Distribution,
    range: Interval,
): Double = (cumulative(distribution, range.to) - cumulative(distribution, range.from)) * PERCENT

/** The ends the tails run to: far enough out on a bell curve that nothing is left beyond them. */
internal fun farEnds(distribution: Distribution): Interval =
    when (distribution) {
        is NormalValue -> distribution.value.run { Interval(mean - FAR_SDS * sd, mean + FAR_SDS * sd) }
        is UniformValue -> distribution.value.run { Interval(min, max) }
    }

internal fun distributionDomain(fields: DistributionFields): ClosedFloatingPointRange<Double> {
    val (low, high) =
        when (val distribution = fields.distribution) {
            is NormalValue -> distribution.value.run { mean - NORMAL_REACH * sd to mean + NORMAL_REACH * sd }
            is UniformValue -> distribution.value.run { min - (max - min) * UNIFORM_MARGIN to max + (max - min) * UNIFORM_MARGIN }
        }
    return minOf(low, fields.handles.from, fields.target.from)..maxOf(high, fields.handles.to, fields.target.to)
}

/** Main's `handleStep`: the roundest step that lands on the target, the handles and whole SDs, or at least the target. */
internal fun handleStep(
    fields: DistributionFields,
    domain: ClosedFloatingPointRange<Double>,
): Double {
    val span = domain.endInclusive - domain.start
    val candidates = candidateSteps(span)
    val required = listOf(fields.target.from, fields.target.to)
    val preferred = required + listOf(fields.handles.from, fields.handles.to) + landmarks(fields.distribution)
    val fits = { values: List<Double> -> { step: Double -> values.all { isMultiple(it, step) } } }

    return candidates.find(fits(preferred)) ?: candidates.find(fits(required)) ?: candidates.lastOrNull() ?: (span / MIN_POSITIONS)
}

internal fun snapDomain(
    domain: ClosedFloatingPointRange<Double>,
    step: Double,
): ClosedFloatingPointRange<Double> = floor(domain.start / step) * step..ceil(domain.endInclusive / step) * step

/** The density across [domain], with a uniform's walls drawn straight. */
internal fun densityCurve(
    distribution: Distribution,
    domain: ClosedFloatingPointRange<Double>,
): List<Pair<Double, Double>> {
    val (from, to) = domain.start to domain.endInclusive
    val edges =
        (distribution as? UniformValue)
            ?.value
            ?.run { listOf(min, max) }
            .orEmpty()
            .filter { it > from && it < to }
    val xs = (0..SAMPLES).map { from + (to - from) * it / SAMPLES } + edges.flatMap { listOf(it - EDGE_SLACK, it + EDGE_SLACK) }
    return xs.sorted().map { it to densityAt(distribution, it) }
}

internal fun distributionTicks(
    distribution: Distribution,
    domain: ClosedFloatingPointRange<Double>,
): List<Double> =
    when (distribution) {
        is NormalValue -> landmarks(distribution).filter { it in domain }
        is UniformValue -> niceTicks(domain, UNIFORM_TICKS)
    }

/** The ticks whose labels don't touch, kept outward from [anchor], so a crowded axis drops every other one around it. */
internal fun spacedTicks(
    centers: List<Float>,
    halfWidths: List<Float>,
    gap: Float,
    anchor: Int,
): List<Int> {
    if (centers.isEmpty()) return emptyList()
    val clear = { kept: Int, next: Int -> abs(centers[kept] - centers[next]) >= halfWidths[kept] + halfWidths[next] + gap }
    val outward = { side: IntProgression -> side.fold(listOf(anchor)) { kept, next -> if (clear(kept.last(), next)) kept + next else kept }.drop(1) }
    return outward(anchor - 1 downTo 0).reversed() + anchor + outward(anchor + 1 until centers.size)
}

private fun densityAt(
    distribution: Distribution,
    value: Double,
): Double =
    when (distribution) {
        is NormalValue -> {
            val (mean, sd) = distribution.value.run { mean to sd }
            val z = (value - mean) / sd
            exp(-(z * z) / 2) / (sd * sqrt(2 * PI))
        }

        is UniformValue -> {
            distribution.value.run { if (value in min..max) 1 / (max - min) else 0.0 }
        }
    }

private fun cumulative(
    distribution: Distribution,
    value: Double,
): Double =
    when (distribution) {
        is NormalValue -> distribution.value.run { normalCdf(value, mean, sd) }
        is UniformValue -> distribution.value.run { ((value - min) / (max - min)).coerceIn(0.0, 1.0) }
    }

/** Core's `normalCdf`, through Abramowitz and Stegun's erf (7.1.26). */
internal fun normalCdf(
    value: Double,
    mean: Double,
    sd: Double,
): Double = (1 + erf((value - mean) / (sd * sqrt(2.0)))) / 2

private fun erf(value: Double): Double {
    val x = abs(value)
    val t = 1 / (1 + ERF_P * x)
    val polynomial = ERF_A.foldRight(0.0) { coefficient, sum -> sum * t + coefficient } * t
    return sign(value) * (1 - polynomial * exp(-x * x))
}

private fun candidateSteps(span: Double): List<Double> {
    val top = floor(log10(span)).toInt()
    return (0 until STEP_POWERS)
        .map { 10.0.pow(top - it) }
        .flatMap { power -> STEP_MULTIPLIERS.map { it * power } }
        .filter { span / it >= MIN_POSITIONS && span / it <= MAX_POSITIONS }
}

private fun landmarks(distribution: Distribution): List<Double> =
    when (distribution) {
        is NormalValue -> distribution.value.run { (-SD_TICKS..SD_TICKS).map { mean + it * sd } }
        is UniformValue -> distribution.value.run { listOf(min, max) }
    }

private const val PERCENT = 100
private const val FAR_SDS = 40
private const val NORMAL_REACH = 3.5
private const val UNIFORM_MARGIN = 0.25
private const val SAMPLES = 120
private const val MIN_POSITIONS = 20
private const val MAX_POSITIONS = 1000
private const val STEP_POWERS = 5
private val STEP_MULTIPLIERS = listOf(5.0, 2.0, 1.0)
private const val EDGE_SLACK = 1e-9
private const val SD_TICKS = 3
private const val UNIFORM_TICKS = 4
private const val ERF_P = 0.3275911
private val ERF_A = listOf(0.254829592, -0.284496736, 1.421413741, -1.453152027, 1.061405429)
