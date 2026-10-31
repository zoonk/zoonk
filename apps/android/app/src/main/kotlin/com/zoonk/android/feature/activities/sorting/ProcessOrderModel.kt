package com.zoonk.android.feature.activities.sorting

import com.zoonk.android.feature.activities.seededShuffle

/** Main's `shuffleSteps`: seeded, and never already in order. */
internal fun <T> shuffleSteps(
    steps: List<T>,
    seedText: String,
): List<T> {
    val shuffled = seededShuffle(steps, seedText)
    return if (shuffled == steps) shuffled.drop(1) + shuffled.take(1) else shuffled
}

internal data class StepResult(
    val id: String,
    val learnerPosition: Int?,
    val position: Int,
)

internal fun stepResults(
    expected: List<String>,
    order: List<String>,
): List<StepResult> =
    expected.mapIndexed { index, id ->
        StepResult(id, order.indexOf(id).takeIf { it >= 0 }?.plus(1), index + 1)
    }
