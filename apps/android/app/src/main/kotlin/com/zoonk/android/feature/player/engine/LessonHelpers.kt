package com.zoonk.android.feature.player.engine

import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.model.StepContent
import kotlin.math.max
import kotlin.math.roundToLong

private const val MIN_SHOWN_STREAK = 3

/**
 * Hyperdrive as the server counts it (`advanceHyperdrive`): a right answer on a new screen builds
 * the streak, a repeat keeps it, a miss ends it. Shown from three in a row, only on a screen that built it.
 */
fun LessonPlayerState.hyperdriveStreak(stepId: String): Int? {
    val started = run as? LessonRun.Started
    val known = started?.hyperdrive?.knownStepIds.orEmpty()
    val carried = started?.carriedStepIds.orEmpty()
    var streak = started?.hyperdrive?.streak ?: 0
    var shown: Int? = null

    for ((id, isCorrect) in firstVerdicts) {
        if (id in carried) continue
        val isNew = id !in known
        streak =
            if (!isCorrect) {
                0
            } else if (isNew) {
                streak + 1
            } else {
                streak
            }
        if (id == stepId) shown = streak.takeIf { isCorrect && isNew && it >= MIN_SHOWN_STREAK }
    }

    return shown
}

private const val MISSES_TO_STRUGGLE = 2
private const val MIN_STRUGGLE_PAUSE_MS = 45_000L
private const val READING_WORDS_PER_MINUTE = 150.0
private const val PAUSE_READING_FACTOR = 3
private const val MS_PER_MINUTE = 60_000

private fun isSameSkill(
    a: String?,
    b: String?,
): Boolean = a == null || b == null || a == b

/** Two misses on one idea offer the buddy, with the explanation they rest on. */
fun LessonPlayerState.struggleOffer(): LessonStep? {
    val recent = misses.takeLast(MISSES_TO_STRUGGLE)

    if (phase != LessonPhase.Feedback || quickCheck != null || recent.size < MISSES_TO_STRUGGLE) return null

    val (first, last) = recent
    val isSameIdea = first.stepId == last.stepId || isSameSkill(first.skillId, last.skillId)

    if (currentStep?.id != last.stepId || !isSameIdea) return null

    val ids = queue.distinct()
    val questionIndex = ids.indexOf(last.stepId)
    val explanations =
        ids.withIndex().filter { (_, id) ->
            val step = steps[id]
            step != null && step.isExplainingStep && isSameSkill(step.skillId, last.skillId)
        }
    val chosen = explanations.lastOrNull { it.index < questionIndex } ?: explanations.firstOrNull { it.index > questionIndex }

    return chosen?.let { steps[it.value] }
}

/** A pause this long on an explanation (three times its reading time, 45 s at least) offers the buddy. */
fun LessonStep.strugglePauseMs(): Long? {
    val text =
        when (val content = content) {
            is StepContent.Explanation -> {
                "${content.content.title.orEmpty()} ${content.content.text}"
            }

            is StepContent.WorkedExample -> {
                (
                    listOf(content.content.problem) + content.content.steps.map { it.text } +
                        content.content.result
                ).joinToString(" ")
            }

            else -> {
                return null
            }
        }
    val words = text.split(Regex("\\s+")).count { it.isNotEmpty() }
    val readingMs = words / READING_WORDS_PER_MINUTE * MS_PER_MINUTE

    return max(MIN_STRUGGLE_PAUSE_MS, (readingMs * PAUSE_READING_FACTOR).roundToLong())
}
