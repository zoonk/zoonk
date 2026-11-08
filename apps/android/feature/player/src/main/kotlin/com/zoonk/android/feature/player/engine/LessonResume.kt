package com.zoonk.android.feature.player.engine

import com.zoonk.android.feature.player.model.LessonAnswer
import com.zoonk.android.feature.player.model.StepContent
import com.zoonk.android.feature.player.model.StepResult

/** Each screen's first answer, oldest first. */
internal fun runVerdicts(answers: List<RunAnswer>): Map<String, Boolean> =
    answers.distinctBy(RunAnswer::stepId).associate { it.stepId to it.isCorrect }

private fun LessonPlayerState.missedOnce(answers: List<RunAnswer>): List<String> =
    queue.filter { stepId ->
        val step = steps[stepId]
        val tries = answers.filter { it.stepId == stepId }
        step != null && step.isRetryStep && tries.size == 1 && !tries.first().isCorrect
    }

private fun retriedIn(answers: List<RunAnswer>): List<String> {
    val stepIds = answers.map(RunAnswer::stepId)
    return stepIds.filterIndexed { index, id -> stepIds.indexOf(id) != index }.distinct()
}

/** Back to the reading right before the first screen still to answer, so the learner has its context. */
private fun LessonPlayerState.resumePosition(
    queue: List<String>,
    answered: Set<String>,
    lessonLength: Int,
): Int {
    val isAnswerable = { id: String -> steps[id]?.isAnswerable == true }
    val open =
        queue.indices.firstOrNull { index -> isAnswerable(queue[index]) && (index >= lessonLength || queue[index] !in answered) }
            ?: return queue.size
    val readingBefore = queue.take(open).asReversed().indexOfFirst(isAnswerable)

    return if (readingBefore == -1) 0 else open - readingBefore
}

/** Each screen as its last answer left it, a challenge on its ending. */
private fun LessonPlayerState.answeredAs(saved: List<RunAnswer>): LessonPlayerState {
    val last = saved.associateBy(RunAnswer::stepId)
    val picks = last.values.mapNotNull { run -> run.answer?.let { run.stepId to it } }.toMap()
    val endings = picks.mapNotNull { (id, answer) -> (answer as? LessonAnswer.Challenge)?.let { id to it.choiceIds.size + 1 } }.toMap()

    return copy(answers = answers + picks, results = results + last.mapValues { it.value.result }, revealed = revealed + endings)
}

/**
 * A run the learner comes back to shows each answered screen as they left it and continues at the first screen still
 * to answer; a check missed once comes back at the end.
 */
internal fun LessonPlayerState.resume(
    answers: List<RunAnswer>,
    now: Long,
): LessonPlayerState {
    val known = answers.filter { it.stepId in steps }

    if (known.isEmpty()) return this

    val missed = missedOnce(known)
    val resumedQueue = queue + missed
    val position = resumePosition(resumedQueue, known.map(RunAnswer::stepId).toSet(), queue.size)
    val resumed = copy(firstVerdicts = runVerdicts(known), queue = resumedQueue, retried = retriedIn(known) + missed).answeredAs(known)

    if (position >= resumedQueue.size) return resumed.copy(position = resumedQueue.size - 1).finish(CompletionStatus.Ready, now)

    return resumed.enterPosition(position, now)
}

/**
 * A run that lands after the learner acted on this visit leaves them where they are: screens they haven't touched, other
 * than the one in play, show the run's answers, and a check it missed once comes back at the end.
 */
internal fun LessonPlayerState.fillUntouched(
    answers: List<RunAnswer>,
    workedStepIds: Set<String>,
): LessonPlayerState {
    val inPlay = currentStep?.id?.takeIf { it !in results }
    val saved =
        answers.filter {
            it.stepId in steps && it.stepId != inPlay && it.stepId !in workedStepIds && it.stepId !in this.answers &&
                it.stepId !in results
        }

    if (saved.isEmpty()) return this

    val lessonQueue = quickCheck?.returnQueue ?: queue
    val owed =
        saved
            .groupBy(RunAnswer::stepId)
            .filter { (id, tries) -> steps[id]?.isRetryStep == true && tries.size == 1 && !tries.first().isCorrect }
            .keys
            .filter { id -> lessonQueue.count { it == id } == 1 }
    val filled = saved.map(RunAnswer::stepId).toSet()

    return copy(
        firstVerdicts = runVerdicts(saved) + firstVerdicts,
        queue = if (quickCheck == null) queue + owed else queue,
        quickCheck = quickCheck?.copy(returnQueue = lessonQueue + owed),
        retried = (retried + retriedIn(saved) + owed).distinct(),
        rounds = rounds + filled.associateWith { round(it) + 1 },
    ).answeredAs(saved)
}

/** "I don't know yet": an open answer's sample, or the guess's answer with no pick, without a verdict; neither counts. */
internal fun LessonPlayerState.revealAnswer(stepId: String): LessonPlayerState {
    val step = currentStep?.takeIf { it.id == stepId && phase == LessonPhase.Playing } ?: return this
    val shown = copy(checkFailed = false, checkIssue = null, notice = null, phase = LessonPhase.Feedback)

    return when (val content = step.content) {
        is StepContent.TypedAnswer -> {
            val sample = StepResult(isCorrect = false, checked = false, correctAnswer = content.content.sampleAnswer)
            shown.copy(results = results + (stepId to sample), skippedWritingStepIds = (skippedWritingStepIds + stepId).distinct())
        }

        is StepContent.Guess -> {
            val answer = revealGuess(step, optionId = null) ?: return this
            shown.copy(results = results + (stepId to answer))
        }

        else -> {
            this
        }
    }
}

/** "Can't write now" leaves out every writing screen ahead for the rest of the day; "Write again" puts them back. */
internal fun LessonPlayerState.skipWriting(
    opening: Boolean,
    now: Long,
): LessonPlayerState {
    if (phase != LessonPhase.Playing) return this

    val isLeftOut = { id: String -> steps[id]?.isWritingStep == true }
    val skipped = queue.drop(position).filter(isLeftOut)
    val next =
        copy(skippedWritingStepIds = (skippedWritingStepIds + skipped).distinct())
            .leaveOutAhead(isLeftOut, if (opening) CompletionStatus.Ready else CompletionStatus.Saving, now)

    if (next.phase != LessonPhase.Playing || skipped.isEmpty()) return next

    return next.copy(
        notice = LessonNotice.WritingSkipped,
        writingRestore = WritingRestore(position, queue, skippedWritingStepIds),
    )
}

internal fun LessonPlayerState.restoreWriting(now: Long): LessonPlayerState {
    val restore = writingRestore

    if (restore == null || notice != LessonNotice.WritingSkipped || phase != LessonPhase.Playing) return this

    return copy(
        notice = null,
        queue = restore.queue,
        skippedWritingStepIds = restore.skippedWritingStepIds,
        writingRestore = null,
    ).enterPosition(restore.position, now)
}
