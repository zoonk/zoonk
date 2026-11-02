package com.zoonk.android.feature.player.engine

import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.model.StepContent
import com.zoonk.android.feature.player.model.StepKind

private val RECAP_QUESTION_KINDS = setOf(StepKind.Activity, StepKind.Check, StepKind.Hook, StepKind.TypedAnswer)

private val LessonStep.isRecapStep: Boolean
    get() = content is StepContent.Explanation || content is StepContent.WorkedExample

fun LessonPlayerState.recap(): LessonStep? {
    val current = currentStep ?: return null

    if (current.isReadStep || current.kind !in RECAP_QUESTION_KINDS) return null

    val read =
        queue
            .take(position)
            .mapNotNull(steps::get)
            .filter { it.isRecapStep }
            .sortedBy { it.position }
    val isChecked = phase == LessonPhase.Feedback && current.id in results

    // A screen written after the question was written knowing it and may answer it.
    return read.lastOrNull { it.position < current.position }
        ?: read.firstOrNull { it.position > current.position }?.takeIf { isChecked }
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
