package com.zoonk.android.feature.player.engine

import com.zoonk.android.feature.player.model.LessonAnswer
import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.model.StepContent
import com.zoonk.android.feature.player.model.StepResult

/** A hook's guess reveals the answer whatever the pick, with the reveal as the why. It never counts. */
fun revealGuess(
    step: LessonStep,
    optionId: String,
): StepResult? {
    val guess = (step.content as? StepContent.Guess)?.content ?: return null
    val picked = guess.options.find { it.id == optionId } ?: return null

    return StepResult(
        isCorrect = picked.isCorrect,
        answerText = picked.text,
        correctAnswer = if (picked.isCorrect) null else guess.options.find { it.isCorrect }?.text,
        feedback = guess.reveal,
    )
}

/**
 * Core's grading for the screens the device can grade at once, so feedback is instant and agrees
 * with the server's, which records it in the background. Null for answers only the server grades:
 * typed and spoken answers, activities (their checked state needs the server's expected answer) and
 * language exercises.
 */
fun gradeOnDevice(
    step: LessonStep,
    answer: LessonAnswer,
): StepResult? =
    when (val content = step.content) {
        is StepContent.Check -> {
            val optionId = (answer as? LessonAnswer.Check)?.optionId
            content.content.options.find { it.id == optionId }?.let { picked ->
                StepResult(
                    isCorrect = picked.isCorrect,
                    answerText = picked.text,
                    correctAnswer =
                        if (picked.isCorrect) {
                            null
                        } else {
                            content.content.options
                                .find { it.isCorrect }
                                ?.text
                        },
                    feedback = picked.reason,
                )
            }
        }

        is StepContent.Challenge -> {
            val choiceIds = (answer as? LessonAnswer.Challenge)?.choiceIds.orEmpty()
            gradeChallengePath(content.content, choiceIds)?.let { grade ->
                StepResult(
                    isCorrect = grade.isCorrect,
                    answerText = grade.moves.joinToString(" → ") { it.choice.text },
                    feedback = grade.ending.outcome,
                )
            }
        }

        else -> {
            null
        }
    }
