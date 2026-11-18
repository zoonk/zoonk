package com.zoonk.android.feature.player.steps

import com.zoonk.android.feature.player.model.NumericCheck
import com.zoonk.api.models.ActivityRoundedAnswer
import java.math.BigDecimal
import java.math.RoundingMode

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
 * Core's `getCheckedAnswerPlaces`: a checked learner's number is written to the hint's places,
 * unless it's wrong and would then read as the right answer.
 */
internal fun NumericCheck.checkedAnswerDigits(
    value: Double,
    isCorrect: Boolean,
    rounded: ActivityRoundedAnswer?,
): Int {
    val places = rounded?.places?.toInt() ?: return answerDigits(value)
    val readsAsRight = BigDecimal.valueOf(value).setScale(places, RoundingMode.HALF_UP).compareTo(BigDecimal.valueOf(rounded.`value`)) == 0
    return if (!isCorrect && readsAsRight) answerDigits(value, places) else places
}
