package com.zoonk.android.feature.activities

import com.zoonk.android.ui.components.niceTicks
import java.math.BigDecimal
import java.math.MathContext
import java.math.RoundingMode
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.log10
import kotlin.math.max
import kotlin.math.pow

/** Main's `guess-scale.ts`: where a guess sits on a linear or log scale, and how far off it was. */
data class GuessScale(
    val min: Double,
    val max: Double,
    val log: Boolean,
) {
    fun valueAt(position: Int): Double {
        val share = position.coerceIn(0, POSITIONS).toDouble() / POSITIONS
        return if (log) 10.0.pow(log10(min) + (log10(max) - log10(min)) * share) else min + (max - min) * share
    }

    fun shareOf(value: Double): Double =
        when {
            log -> ((log10(max(value, min)) - log10(min)) / (log10(max) - log10(min))).coerceIn(0.0, 1.0)
            max == min -> 0.0
            else -> ((value - min) / (max - min)).coerceIn(0.0, 1.0)
        }

    fun positionOf(value: Double): Int = jsRound(shareOf(value) * POSITIONS).toInt()

    fun ticks(): List<Double> {
        if (!log) {
            val room = (max - min) * END_ROOM
            return listOf(min) + niceTicks(min..max, LINEAR_TICKS).filter { it - min > room && max - it > room } + max
        }
        val from = ceil(log10(min)).toInt()
        val to = floor(log10(max)).toInt()
        val powers = (from..to).map { 10.0.pow(it) }
        val every = ceil(powers.size.toDouble() / MAX_LOG_TICKS).toInt()
        return if (powers.size < 2) listOf(min, max) else powers.filterIndexed { index, _ -> index % every == 0 }
    }

    companion object {
        const val POSITIONS = 200
        private const val END_ROOM = 0.08
        private const val LINEAR_TICKS = 4
        private const val MAX_LOG_TICKS = 6
    }
}

sealed interface GuessComparison {
    data object Close : GuessComparison

    data class TooBig(
        val times: Double,
    ) : GuessComparison

    data class TooSmall(
        val times: Double,
    ) : GuessComparison

    data class Off(
        val difference: Double,
    ) : GuessComparison
}

fun compareGuess(
    actual: Double,
    guess: Double,
    isCorrect: Boolean,
): GuessComparison {
    if (isCorrect) return GuessComparison.Close
    if (guess <= 0 || actual <= 0) return GuessComparison.Off(guess - actual)
    val ratio = guess / actual
    return when {
        ratio >= RATIO_COMPARISON_MIN -> GuessComparison.TooBig(roundGuess(ratio))
        ratio <= 1 / RATIO_COMPARISON_MIN -> GuessComparison.TooSmall(roundGuess(1 / ratio))
        else -> GuessComparison.Off(guess - actual)
    }
}

/** JavaScript's `Number(value.toPrecision(2))`. */
fun roundGuess(value: Double): Double = BigDecimal(value).round(MathContext(GUESS_DIGITS, RoundingMode.HALF_UP)).toDouble()

private const val GUESS_DIGITS = 2
private const val RATIO_COMPARISON_MIN = 1.5
