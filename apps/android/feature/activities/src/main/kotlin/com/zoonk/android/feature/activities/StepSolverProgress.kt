package com.zoonk.android.feature.activities

/** Main's `step-solver-progress.ts`: each step's picks, wrong ones first, until its right one. */
data class SolverStep(
    val id: String,
    val correctId: String?,
)

typealias SolverPicks = Map<String, List<String>>

private fun SolverStep.isSolved(picks: SolverPicks) = correctId != null && correctId in picks[id].orEmpty()

fun currentStepIndex(
    steps: List<SolverStep>,
    picks: SolverPicks,
): Int = steps.indexOfFirst { !it.isSolved(picks) }.takeIf { it != -1 } ?: steps.size

/** Every step's first pick, which is what's graded, once all steps are solved. */
fun firstPicks(
    steps: List<SolverStep>,
    picks: SolverPicks,
): Map<String, String>? =
    if (currentStepIndex(steps, picks) <
        steps.size
    ) {
        null
    } else {
        steps.associate { it.id to picks[it.id]?.firstOrNull().orEmpty() }
    }

fun addPick(
    picks: SolverPicks,
    stepId: String,
    choiceId: String,
): SolverPicks {
    val current = picks[stepId].orEmpty()
    return if (choiceId in current) picks else picks + (stepId to current + choiceId)
}
