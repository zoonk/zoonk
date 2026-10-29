package com.zoonk.android.feature.activities

import kotlin.math.abs
import kotlin.math.max

/** Main's `fact-change.ts`: a change read as times when it at least halves or doubles, else as a percent. */
sealed interface FactChange {
    data object Same : FactChange

    data class Less(
        val times: Double,
    ) : FactChange

    data class More(
        val times: Double,
    ) : FactChange

    data class Percent(
        val percent: Double,
    ) : FactChange
}

fun describeChange(ratio: Double): FactChange =
    when {
        abs(ratio - 1) < SAME_SLACK -> FactChange.Same
        ratio > 0 && ratio <= 1 / TIMES_FROM -> FactChange.Less(twoSignificant(1 / ratio))
        ratio >= TIMES_FROM -> FactChange.More(twoSignificant(ratio))
        else -> FactChange.Percent(twoSignificant((ratio - 1) * PERCENT))
    }

/** Each value's bar as a share of the larger one. */
fun barShares(
    before: Double,
    after: Double,
): Pair<Float, Float> {
    val largest = max(abs(before), abs(after))
    return if (largest == 0.0) 0f to 0f else (abs(before) / largest).toFloat() to (abs(after) / largest).toFloat()
}

private const val SAME_SLACK = 1e-9
private const val TIMES_FROM = 2.0
private const val PERCENT = 100
