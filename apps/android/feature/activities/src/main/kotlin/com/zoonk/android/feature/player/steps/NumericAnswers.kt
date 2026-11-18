package com.zoonk.android.feature.player.steps

import com.zoonk.android.feature.activities.code.withinTolerance
import com.zoonk.android.feature.player.model.ActivityTolerance
import com.zoonk.android.feature.player.model.NumericCheck
import com.zoonk.android.ui.format.exactFractionDigitsFor
import com.zoonk.api.models.ActivityExpectedFormulaTolerance
import com.zoonk.api.models.ActivityRoundedAnswer
import com.zoonk.api.models.PlayableLibraryStepAnyOfMinTolerance
import java.math.BigDecimal
import java.math.RoundingMode
import kotlin.math.abs
import kotlin.math.pow

/** A number as the screen writes it: [value] to at most [digits] decimals. */
internal data class WrittenNumber(
    val value: Double,
    val digits: Int,
)

/**
 * The right answer every app writes for a numeric check: core's rounded answer at the places its
 * hint names, or, for a whole-number answer, the answer with the digits that tell it from the
 * learner's [value].
 */
internal fun NumericCheck.rightAnswer(
    rounded: ActivityRoundedAnswer?,
    value: Double? = null,
): WrittenNumber {
    val places = rounded?.places?.toInt()
    return if (rounded == null || places == null) WrittenNumber(answer, answerDigits(value)) else WrittenNumber(rounded.`value`, places)
}

/**
 * Core's `getCheckedAnswerDigits`: a checked learner's number is written to the hint's places when the rounded number
 * keeps its grade, else to the fewest of its own digits that do, so the number shown never reads as the other verdict.
 */
internal fun NumericCheck.checkedAnswerDigits(
    value: Double,
    isCorrect: Boolean,
    rounded: ActivityRoundedAnswer?,
    minTolerance: ActivityTolerance?,
): Int {
    val ownDigits = decimalPlaces(value)
    val keepsGrade = { places: Int -> accepts(roundToPlaces(value, places), minTolerance) == isCorrect }
    val hint = rounded?.places?.toInt()
    if (hint != null && keepsGrade(hint)) return hint
    val from = exactFractionDigitsFor(answer, allowed, value)
    return (from until ownDigits).firstOrNull(keepsGrade) ?: maxOf(from, ownDigits)
}

/** Core's `checkActivityAnswer` for a number: within the check's tolerance or the template's, or rounded from the answer. */
private fun NumericCheck.accepts(
    value: Double,
    minTolerance: ActivityTolerance?,
): Boolean =
    withinTolerance(answer, tolerance, value) ||
        minTolerance?.let {
            withinTolerance(
                answer,
                ActivityExpectedFormulaTolerance(it.kind.toFormulaKind(), it.`value`),
                value,
            )
        } == true ||
        isRoundedAnswer(answer, value)

private fun PlayableLibraryStepAnyOfMinTolerance.Kind.toFormulaKind() =
    if (value == "absolute") ActivityExpectedFormulaTolerance.Kind.ABSOLUTE else ActivityExpectedFormulaTolerance.Kind.RELATIVE

/** Utils' `isRoundedAnswer`: a number rounded no further than half its last place from [expected], and not so far it loses the value. */
private fun isRoundedAnswer(
    expected: Double,
    value: Double,
): Boolean {
    if (BigDecimal.valueOf(value).stripTrailingZeros().precision() < MIN_SIGNIFICANT_DIGITS) return false
    val halfPlace = HALF_A_PLACE * 10.0.pow(-decimalPlaces(value))
    return abs(value - expected) <= halfPlace * (1 + FLOAT_SLACK)
}

/** Rounds half away from zero, as core's number formatting does. */
private fun roundToPlaces(
    value: Double,
    places: Int,
): Double = BigDecimal.valueOf(value).setScale(places, RoundingMode.HALF_UP).toDouble()

private fun decimalPlaces(value: Double): Int =
    BigDecimal
        .valueOf(abs(value))
        .stripTrailingZeros()
        .scale()
        .coerceAtLeast(0)

private const val MIN_SIGNIFICANT_DIGITS = 2
private const val HALF_A_PLACE = 0.5
private const val FLOAT_SLACK = 1e-9
