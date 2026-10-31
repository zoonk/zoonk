package com.zoonk.android.feature.player.engine

import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.model.StepContent
import com.zoonk.android.feature.player.model.StepKind

private val RECAP_QUESTION_KINDS = setOf(StepKind.Activity, StepKind.Check, StepKind.Hook, StepKind.TypedAnswer)

private val LessonStep.isRecapStep: Boolean
    get() = content is StepContent.Explanation || content is StepContent.WorkedExample || content is StepContent.Fact

/** A missed check that moved to the end recaps from where it was written, not from the end. */
private fun LessonPlayerState.firstPlace(step: LessonStep): Int {
    val first = queue.indexOf(step.id)
    val gaveUpPlace = step.id in retried && queue.lastIndexOf(step.id) == first

    if (!gaveUpPlace) return first

    val later = queue.indexOfFirst { (steps[it]?.position ?: 0) > step.position }
    return if (later == -1) first else minOf(first, later)
}

/** Main's `getLessonRecap`: the explanation, worked example or fact the question in view comes after. */
fun LessonPlayerState.recap(): LessonStep? {
    val current = currentStep ?: return null

    if (current.isReadStep || current.kind !in RECAP_QUESTION_KINDS) return null

    return queue
        .take(firstPlace(current).coerceAtLeast(0))
        .lastOrNull { steps[it]?.isRecapStep == true }
        ?.let(steps::get)
}

/** The sentence of [recap] this check or typed answer rests on (its `basis`), when that's the screen it recaps. */
fun LessonStep.recapMark(recap: LessonStep): String? {
    val basis =
        when (val content = content) {
            is StepContent.Check -> content.content.basis
            is StepContent.TypedAnswer -> content.content.basis
            else -> null
        }

    return basis?.quote?.takeIf { basis.position == recap.position.toLong() }
}
