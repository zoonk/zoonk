package com.zoonk.android.feature.player.engine

import com.zoonk.android.feature.player.model.LessonAnswer
import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.model.StepContent
import com.zoonk.android.feature.player.model.StepKind

private val READ_KINDS = setOf(StepKind.Alphabet, StepKind.Explanation, StepKind.Summary, StepKind.Vocabulary, StepKind.WorkedExample)

private val RETRY_KINDS = setOf(StepKind.Activity, StepKind.Check)

private val EXPLAINING_KINDS = setOf(StepKind.Explanation, StepKind.WorkedExample)

private val QUESTION_KINDS = setOf(StepKind.Activity, StepKind.Check, StepKind.TypedAnswer)

private val SELF_CORRECT_KINDS = setOf(StepKind.FillBlank, StepKind.Listening, StepKind.Reading)

/** Core's rule: these screens are read, never answered, so finishing doesn't wait for them. */
private val READ_ONLY_KINDS =
    setOf(StepKind.Alphabet, StepKind.Explanation, StepKind.Hook, StepKind.Summary, StepKind.Vocabulary, StepKind.WorkedExample)

val LessonStep.isReadStep: Boolean
    get() = content is StepContent.Fact || kind in READ_KINDS

val LessonStep.isLanguageStep: Boolean get() = content is StepContent.Language

val LessonStep.canSelfCorrect: Boolean get() = isLanguageStep && kind in SELF_CORRECT_KINDS

val LessonStep.isRetryStep: Boolean get() = kind in RETRY_KINDS

val LessonStep.isQuestionStep: Boolean get() = kind in QUESTION_KINDS

val LessonStep.isExplainingStep: Boolean get() = kind in EXPLAINING_KINDS

val LessonStep.isAnswerable: Boolean get() = kind !in READ_ONLY_KINDS

/** Typed answers and spoken recordings wait for the server's grade; the rest are graded on the device. */
fun isServerGradedAnswer(
    answer: LessonAnswer,
    step: LessonStep,
): Boolean = step.kind == StepKind.TypedAnswer || (step.kind == StepKind.SpokenAnswer && answer is LessonAnswer.Spoken)

private fun isOtherSkill(
    a: LessonStep,
    b: LessonStep,
): Boolean = a.skillId != null && b.skillId != null && a.skillId != b.skillId

/** The explanations right after the question in view, up to the next question or another skill's. */
fun LessonPlayerState.explanationsAfter(): List<String> {
    val question = queue.getOrNull(position)?.let(steps::get)
    val following = queue.drop(position + 1)
    val firstOther =
        following.indexOfFirst { id ->
            val step = steps[id]
            step == null || !step.isExplainingStep || (question != null && isOtherSkill(question, step))
        }

    return if (firstOther == -1) following else following.take(firstOther)
}

/** "I already know this": every check not already answered right on its first try. */
fun LessonPlayerState.quickCheckQueue(): List<String> =
    queue.filter { id -> steps[id]?.kind == StepKind.Check && firstVerdicts[id] != true }.distinct()

private val NUMBER_ANSWER =
    Regex("""^(?:\p{Lu}{0,3}\p{Sc}\s?)?[+\-−]?\d[\d.,\s]*(?:\s?[\p{L}%°Ωµ/²³]{1,6})?$""")

/** An answer made only of numbers (a price, a measure) takes a number field and has no way out. */
fun isNumberAnswer(acceptedAnswers: List<String>?): Boolean =
    !acceptedAnswers.isNullOrEmpty() && acceptedAnswers.all { NUMBER_ANSWER.matches(it.trim()) }

/** Own words, which "Can't write now" leaves out; a number answer stays. */
val LessonStep.isWritingStep: Boolean
    get() {
        val typed = content as? StepContent.TypedAnswer ?: return false
        return !isNumberAnswer(typed.content.acceptedAnswers)
    }
