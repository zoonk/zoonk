package com.zoonk.android.feature.player.steps

import com.zoonk.android.feature.player.model.NumericCheck
import com.zoonk.android.ui.format.exactFractionDigitsFor
import com.zoonk.api.models.ActivityRoundedAnswer

/** A number as the screen writes it: [value] to at most [digits] decimals. */
internal data class WrittenNumber(
    val value: Double,
    val digits: Int,
)

/** The right answer every app writes for a numeric check. */
internal fun NumericCheck.rightAnswer(rounded: ActivityRoundedAnswer?): WrittenNumber = WrittenNumber(answer, answerDigits(null))

/** The digits a checked learner's [value] is written with. */
internal fun NumericCheck.checkedAnswerDigits(
    value: Double,
    isCorrect: Boolean,
    rounded: ActivityRoundedAnswer?,
): Int = exactFractionDigitsFor(answer, allowed, value)
