package com.zoonk.android.feature.player.engine

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

/** A run the learner comes back to continues at the first screen still to answer; a check missed once comes back at the end. */
internal fun LessonPlayerState.resume(answers: List<RunAnswer>): LessonPlayerState {
    val known = answers.filter { it.stepId in steps }

    if (known.isEmpty()) return this

    val missed = missedOnce(known)
    val resumedQueue = queue + missed
    val position = resumePosition(resumedQueue, known.map(RunAnswer::stepId).toSet(), queue.size)
    val resumed = copy(firstVerdicts = runVerdicts(known), queue = resumedQueue, retried = retriedIn(known) + missed)

    if (position >= resumedQueue.size) {
        return resumed.copy(
            completion = LessonCompletion(CompletionStatus.Ready),
            phase = LessonPhase.Completed,
            position = resumedQueue.size - 1,
        )
    }

    return resumed.copy(position = position)
}

/** "I don't know yet": the sample answer, without a verdict. */
internal fun LessonPlayerState.showSampleAnswer(stepId: String): LessonPlayerState {
    val step = currentStep
    val typed = step?.content as? StepContent.TypedAnswer

    if (phase != LessonPhase.Playing || step?.id != stepId || typed == null) return this

    return copy(
        checkFailed = false,
        checkIssue = null,
        notice = null,
        phase = LessonPhase.Feedback,
        results = results + (stepId to StepResult(isCorrect = false, checked = false, correctAnswer = typed.content.sampleAnswer)),
        skippedWritingStepIds = (skippedWritingStepIds + stepId).distinct(),
    )
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
