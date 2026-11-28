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

    val hydrated = copy(firstVerdicts = firstVerdicts + runVerdicts(answers))
    if (saved.isEmpty()) return hydrated

    val lessonQueue = quickCheck?.returnQueue ?: queue
    val owed =
        saved
            .groupBy(RunAnswer::stepId)
            .filter { (id, tries) -> steps[id]?.isRetryStep == true && tries.size == 1 && !tries.first().isCorrect }
            .keys
            .filter { id -> lessonQueue.count { it == id } == 1 }
    val filled = saved.map(RunAnswer::stepId).toSet()

    return hydrated
        .copy(
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

/**
 * "Can't write now" or "I can't talk now" leaves out every screen ahead that needs the [skill], for the rest of the day, the one
 * in view too while it's being answered; "Turn back on" puts them back. [opening] when the lesson opens with the skill already
 * off, so a lesson left with nothing to do waits for its finish instead of saving it. A second skip of the same skill while its
 * notice shows keeps the first one's restore, so one "Turn back on" puts back both.
 */
internal fun LessonPlayerState.skipSkill(
    skill: DaySkill,
    opening: Boolean,
    now: Long,
): LessonPlayerState {
    if (phase == LessonPhase.Completed) return this

    val isLeftOut = { id: String -> steps[id]?.let(skill::leavesOut) == true }
    val start = position + if (phase == LessonPhase.Playing) 0 else 1
    val leftOut =
        queue
            .drop(start)
            .filter(isLeftOut)
            .distinct()
            .filterNot { it in leftOutBy(skill) }
    val next =
        withLeftOut(skill, leftOutBy(skill) + leftOut)
            .leaveOutAhead(isLeftOut, if (opening) CompletionStatus.Ready else CompletionStatus.Saving, now)

    if (next.phase != LessonPhase.Playing || phase != LessonPhase.Playing || leftOut.isEmpty()) return next

    val earlier = skillRestore?.takeIf { notice == LessonNotice.SkillSkipped && it.skill::class == skill::class }
    val restore =
        earlier?.copy(skill = skill, leftOut = earlier.leftOut + leftOut) ?: SkillRestore(skill, position, queue, leftOut)

    return next.copy(notice = LessonNotice.SkillSkipped, skillRestore = restore)
}

internal fun LessonPlayerState.restoreSkill(now: Long): LessonPlayerState {
    val restore = skillRestore

    if (restore == null || notice != LessonNotice.SkillSkipped || phase != LessonPhase.Playing) return this

    return putBack(restore).copy(notice = null, queue = restore.queue, skillRestore = null).enterPosition(restore.position, now)
}

/** Left-out writing goes to the server as skipped; left-out speaking stays with the screens this device can't play. */
private fun LessonPlayerState.leftOutBy(skill: DaySkill): List<String> =
    when (skill) {
        DaySkill.Writing -> skippedWritingStepIds
        is DaySkill.Speaking -> unavailableStepIds
    }

private fun LessonPlayerState.withLeftOut(
    skill: DaySkill,
    stepIds: List<String>,
): LessonPlayerState =
    when (skill) {
        DaySkill.Writing -> copy(skippedWritingStepIds = stepIds)
        is DaySkill.Speaking -> copy(unavailableStepIds = stepIds)
    }

/** The screens [restore] left out, back in the lesson. */
internal fun LessonPlayerState.putBack(restore: SkillRestore): LessonPlayerState =
    withLeftOut(restore.skill, leftOutBy(restore.skill) - restore.leftOut.toSet())
