package com.zoonk.android.feature.activities.math

import com.zoonk.android.feature.activities.binomialCount
import com.zoonk.android.feature.activities.clamp
import com.zoonk.android.feature.activities.jsRound
import com.zoonk.android.feature.activities.seededRandom
import com.zoonk.android.feature.activities.standardNormal
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf8FieldsOneOf1Population
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf8FieldsOneOfModel
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf8FieldsOneOfModelOneOfHit
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf8FieldsOneOfModelOneOfHit.Comparison
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.doubleOrNull
import java.math.BigDecimal
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.exp
import kotlin.math.floor
import kotlin.math.ln
import kotlin.math.max
import kotlin.math.pow
import kotlin.math.sqrt
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf8FieldsOneOf1Population.PlayableLibraryStepAnyOfContentOneOf8FieldsOneOf1PopulationOneOf1Value as MeanPopulation
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf8FieldsOneOf1Population.PlayableLibraryStepAnyOfContentOneOf8FieldsOneOf1PopulationOneOfValue as ProportionPopulation
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf8FieldsOneOfModel.PlayableLibraryStepAnyOfContentOneOf8FieldsOneOfModelOneOf1Value as DiceSumModel
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf8FieldsOneOfModel.PlayableLibraryStepAnyOfContentOneOf8FieldsOneOfModelOneOf2Value as SharedBirthdayModel
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf8FieldsOneOfModel.PlayableLibraryStepAnyOfContentOneOf8FieldsOneOfModelOneOfValue as BinomialModel

internal typealias ChanceModel = PlayableLibraryStepAnyOfContentOneOf8FieldsOneOfModel
internal typealias Population = PlayableLibraryStepAnyOfContentOneOf8FieldsOneOf1Population

internal data class HistogramBin(
    val count: Int,
    val from: Double,
    val to: Double,
)

/**
 * Main seeds a lesson's first run with `JSON.stringify(fields)`. Core's schemas list their keys in
 * order, so that text has sorted keys and JavaScript's numbers ("1000", "0.5", "1e-7").
 */
internal fun seedText(element: JsonElement): String =
    when (element) {
        is JsonObject -> {
            element.entries
                .sortedBy {
                    it.key
                }.joinToString(",", "{", "}") { (key, value) -> "${JsonPrimitive(key)}:${seedText(value)}" }
        }

        is JsonArray -> {
            element.joinToString(",", "[", "]") { seedText(it) }
        }

        JsonNull -> {
            "null"
        }

        is JsonPrimitive -> {
            if (element.isString) element.toString() else element.doubleOrNull?.let(::jsNumber) ?: element.content
        }
    }

private fun jsNumber(value: Double): String {
    val text = BigDecimal(value.toString()).stripTrailingZeros()
    return if (value != 0.0 && abs(value) < JS_EXPONENT_BELOW) text.toString().replace('E', 'e') else text.toPlainString()
}

/** Main's `runSimulation`: one outcome per run of [model], drawn from [seed]. */
internal fun runSimulation(
    model: ChanceModel,
    runs: Int,
    seed: Long,
): List<Int> {
    val random = seededRandom(seed)
    return List(runs) { simulateRun(model, random) }
}

private fun simulateRun(
    model: ChanceModel,
    random: () -> Double,
): Int =
    when (model) {
        is BinomialModel -> {
            binomialCount(model.value.probability, model.value.trials.toInt(), random)
        }

        is DiceSumModel -> {
            (0 until model.value.count.toInt())
                .map { floor(random() * model.value.sides).toInt() + 1 }
                .sum()
        }

        is SharedBirthdayModel -> {
            val birthdays = List(model.value.people.toInt()) { floor(random() * model.value.days).toInt() }
            if (birthdays.toSet().size < birthdays.size) 1 else 0
        }
    }

internal fun isHit(
    model: ChanceModel,
    outcome: Int,
): Boolean =
    when (model) {
        is BinomialModel -> model.value.hit.matches(outcome)
        is DiceSumModel -> model.value.hit.matches(outcome)
        is SharedBirthdayModel -> outcome == 1
    }

/** Core's exact chance of a hit, shown once the runs are in. */
internal fun hitProbability(model: ChanceModel): Double =
    when (model) {
        is BinomialModel -> {
            val (p, trials) = model.value.probability to model.value.trials.toInt()
            (0..trials).filter { model.value.hit.matches(it) }.sumOf { exp(logChoose(trials, it) + it * ln(p) + (trials - it) * ln(1 - p)) }
        }

        is DiceSumModel -> {
            val sides = model.value.sides.toInt()
            val counts = (0 until model.value.count.toInt()).fold(listOf(1.0)) { current, _ -> addDie(current, sides) }
            val outcomes = sides.toDouble().pow(model.value.count.toInt())
            counts.withIndex().sumOf { (total, ways) -> if (model.value.hit.matches(total)) ways / outcomes else 0.0 }
        }

        is SharedBirthdayModel -> {
            val (days, people) = model.value.days.toInt() to model.value.people.toInt()
            if (people > days) 1.0 else 1 - (0 until people).fold(1.0) { product, index -> product * ((days - index).toDouble() / days) }
        }
    }

/** Every outcome from the lowest to the highest, with how often it came up. */
internal fun outcomeCounts(outcomes: List<Int>): List<Pair<Int, Int>> {
    if (outcomes.isEmpty()) return emptyList()
    val counts = outcomes.groupingBy { it }.eachCount()
    return (outcomes.min()..outcomes.max()).map { it to (counts[it] ?: 0) }
}

/** The share of hits so far, at about [points] places along the runs. */
internal fun runningShare(
    hits: List<Boolean>,
    points: Int,
): List<Pair<Double, Double>> {
    val every = max(ceil(hits.size.toDouble() / points).toInt(), 1)
    val totals = hits.runningFold(0) { sum, hit -> sum + if (hit) 1 else 0 }.drop(1)
    return totals.withIndex().filter { (index, _) -> (index + 1) % every == 0 || index == hits.size - 1 }.map { (index, total) ->
        (index + 1).toDouble() to total.toDouble() / (index + 1)
    }
}

internal fun truthOf(population: Population): Double =
    when (population) {
        is ProportionPopulation -> population.value.proportion
        is MeanPopulation -> population.value.mean
    }

/** Core's `standardError`: how far a sample of [size] typically lands from the truth. */
internal fun standardError(
    population: Population,
    size: Int,
): Double = spreadOf(population) / sqrt(size.toDouble())

private fun spreadOf(population: Population): Double =
    when (population) {
        is ProportionPopulation -> population.value.proportion.let { sqrt(it * (1 - it)) }
        is MeanPopulation -> population.value.sd
    }

/** Main's `simulateSamples`: the result of [runs] polls of [size], exact for small polls and by the normal curve for big ones. */
internal fun simulateSamples(
    population: Population,
    runs: Int,
    seed: Long,
    size: Int,
): List<Double> {
    val random = seededRandom(seed)
    val error = standardError(population, size)
    return List(runs) {
        when (population) {
            is MeanPopulation -> {
                population.value.mean + error * standardNormal(random)
            }

            is ProportionPopulation -> {
                val proportion = population.value.proportion
                if (size <= EXACT_LIMIT) {
                    binomialCount(proportion, size, random).toDouble() / size
                } else {
                    clamp(jsRound(size * (proportion + error * standardNormal(random))), 0.0, size.toDouble()) / size
                }
            }
        }
    }
}

/** Where the middle 95% of [results] fall. */
internal fun middleRange(results: List<Double>): Pair<Double, Double> {
    val sorted = results.sorted()
    val tail = (1 - MIDDLE_SHARE) / 2
    val at = { share: Double ->
        sorted.getOrNull(clamp(jsRound(share * (sorted.size - 1)), 0.0, (sorted.size - 1).toDouble()).toInt())
            ?: 0.0
    }
    return at(tail) to at(1 - tail)
}

internal fun samplingDomain(
    population: Population,
    smallest: Int,
): ClosedFloatingPointRange<Double> {
    val reach = DOMAIN_REACH * spreadOf(population) / sqrt(smallest.toDouble())
    val truth = truthOf(population)
    return if (population is ProportionPopulation) max(truth - reach, 0.0)..minOf(truth + reach, 1.0) else truth - reach..truth + reach
}

internal fun histogram(
    results: List<Double>,
    domain: ClosedFloatingPointRange<Double>,
): List<HistogramBin> {
    val (min, max) = domain.start to domain.endInclusive
    val width = (max - min) / BIN_COUNT
    val counts = IntArray(BIN_COUNT)
    results.forEach { counts[clamp(floor((it - min) / width), 0.0, (BIN_COUNT - 1).toDouble()).toInt()]++ }
    return counts.mapIndexed { index, count -> HistogramBin(count, min + index * width, min + (index + 1) * width) }
}

/** How many decimals a value needs next to [margin]: whole numbers for big margins, tenths or hundredths for small ones. */
internal fun valueDigits(
    margin: Double,
    population: Population,
): Int {
    val shown = if (population is ProportionPopulation) margin * PERCENT else margin
    return when {
        shown >= WHOLE_FROM -> 0
        shown >= WHOLE_FROM / TENTHS -> 1
        else -> 2
    }
}

private fun PlayableLibraryStepAnyOfContentOneOf8FieldsOneOfModelOneOfHit.matches(outcome: Int): Boolean =
    when (comparison) {
        Comparison.AT_LEAST -> outcome >= `value`
        Comparison.AT_MOST -> outcome <= `value`
        Comparison.EXACTLY -> outcome.toLong() == `value`
    }

private fun logChoose(
    total: Int,
    chosen: Int,
): Double = (0 until chosen).fold(0.0) { sum, index -> sum + ln((total - chosen + index + 1).toDouble()) - ln((index + 1).toDouble()) }

private fun addDie(
    counts: List<Double>,
    sides: Int,
): List<Double> = List(counts.size + sides) { total -> (0 until sides).sumOf { face -> counts.getOrNull(total - face - 1) ?: 0.0 } }

private const val JS_EXPONENT_BELOW = 1e-6
private const val EXACT_LIMIT = 1000
private const val MIDDLE_SHARE = 0.95
private const val DOMAIN_REACH = 3.5
private const val BIN_COUNT = 30
private const val PERCENT = 100
private const val WHOLE_FROM = 2.0
private const val TENTHS = 10
