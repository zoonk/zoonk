package com.zoonk.android.feature.player.engine

import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.model.StepContent
import com.zoonk.android.feature.player.model.StepKind
import com.zoonk.android.feature.player.model.StepResult

internal fun LessonPlayerState.enterPosition(
    position: Int,
    now: Long,
): LessonPlayerState {
    val id = queue.getOrNull(position)
    return copy(
        answers = answers - id.orEmpty(),
        checkFailed = false,
        checkIssue = null,
        phase = LessonPhase.Playing,
        position = position,
        results = results - id.orEmpty(),
        reviewing = false,
        stepStartedAt = now,
    )
}

internal fun LessonPlayerState.complete(status: CompletionStatus = CompletionStatus.Saving): LessonPlayerState =
    copy(completion = LessonCompletion(status, testedOut = quickCheck != null), phase = LessonPhase.Completed)

private fun LessonPlayerState.leaveQuickCheck(now: Long): LessonPlayerState {
    val quick = quickCheck ?: return this
    val answered = queue.filter(results::containsKey)
    val passed = answered.filter { results[it]?.isCorrect == true }.toSet()
    val missed = answered.filterNot(passed::contains)
    val rest =
        quick.returnQueue.filterIndexed { index, id ->
            index <= quick.returnPosition || (id !in passed && id !in missed)
        }

    return copy(notice = null, queue = rest + missed, quickCheck = null, retried = (retried + missed).distinct())
        .enterPosition(quick.returnPosition, now)
}

internal fun LessonPlayerState.advance(now: Long): LessonPlayerState {
    if (quickCheck?.missed == true) return leaveQuickCheck(now)

    val available = queue.filterIndexed { index, id -> index <= position || id !in unavailableStepIds }
    val next = position + 1
    val state = if (available.size == queue.size) this else copy(queue = available)

    if (next >= available.size) return state.complete()

    return state.copy(notice = null).enterPosition(next, now)
}

internal fun LessonPlayerState.leaveOutAhead(
    isLeftOut: (String) -> Boolean,
    completionStatus: CompletionStatus,
    now: Long,
): LessonPlayerState {
    if (phase == LessonPhase.Completed) return this

    val start = position + if (phase == LessonPhase.Playing) 0 else 1
    val ahead = queue.drop(start).filterNot(isLeftOut)

    if (ahead.size == queue.size - start) return this

    val next = copy(queue = queue.take(start) + ahead)

    if (next.queue.getOrNull(position) == queue.getOrNull(position)) return next

    return if (position >= next.queue.size) {
        next.complete(completionStatus)
    } else {
        next.copy(notice = null).enterPosition(position, now)
    }
}

/** Leaves out screens that can't be played (a numbered picture that never came), the one in view too. */
internal fun LessonPlayerState.skipSteps(
    stepIds: Collection<String>,
    now: Long,
): LessonPlayerState {
    val added = stepIds.filter { it in steps && it !in unavailableStepIds }.distinct()

    if (added.isEmpty()) return this

    val unavailable = unavailableStepIds + added
    val isLeftOut = { id: String -> id in unavailable }
    val quick =
        quickCheck?.let { quick ->
            quick.copy(
                returnPosition = quick.returnQueue.take(quick.returnPosition).count { !isLeftOut(it) },
                returnQueue = quick.returnQueue.filterNot(isLeftOut),
            )
        }

    return copy(quickCheck = quick, unavailableStepIds = unavailable).leaveOutAhead(isLeftOut, CompletionStatus.Ready, now)
}

internal fun LessonPlayerState.continueReading(now: Long): LessonPlayerState {
    val step = currentStep
    val workedExample = step?.content as? StepContent.WorkedExample ?: return advance(now)
    val shown = revealed[step.id] ?: 1

    if (shown >= workedExample.content.steps.size) return advance(now)

    return copy(revealed = revealed + (step.id to shown + 1))
}

internal fun LessonPlayerState.continueChallenge(): LessonPlayerState {
    val step = currentStep ?: return this
    val challenge = step.content as? StepContent.Challenge ?: return this
    val shown = revealed[step.id] ?: 0
    val progress = challengeProgress(challenge.content, answers[step.id], shown)
    val canMove = progress is ChallengeProgress.Intro || (progress is ChallengeProgress.Deciding && progress.pendingChoiceId != null)

    return if (canMove) copy(revealed = revealed + (step.id to shown + 1)) else this
}

val LessonPlayerState.canGoBack: Boolean
    get() = phase == LessonPhase.Playing && position > 0 && quickCheck == null && run !is LessonRun.Refused

internal fun LessonPlayerState.goBack(now: Long): LessonPlayerState {
    val previousId = queue.getOrNull(position - 1)

    if (!canGoBack || previousId == null) return this

    val reviewingPrevious = previousId in results

    return copy(
        answers = answers - queue.getOrNull(position).orEmpty(),
        checkFailed = false,
        checkIssue = null,
        notice = null,
        phase = if (reviewingPrevious) LessonPhase.Feedback else LessonPhase.Playing,
        position = position - 1,
        reviewing = reviewingPrevious,
        stepStartedAt = now,
    )
}

private fun LessonPlayerState.offerSelfCorrection(
    isFirst: Boolean,
    stepId: String,
): LessonPlayerState =
    copy(
        checkFailed = false,
        firstVerdicts = if (isFirst) firstVerdicts + (stepId to false) else firstVerdicts,
        notice = LessonNotice.SelfCorrect,
        phase = LessonPhase.Playing,
        selfCorrected = selfCorrected + stepId,
    )

private fun LessonPlayerState.missesAfter(
    counts: Boolean,
    isCorrect: Boolean,
    step: LessonStep?,
): List<Miss> {
    if (!counts || step == null) return misses
    return if (isCorrect) emptyList() else misses + Miss(step.id, step.skillId)
}

internal fun LessonPlayerState.resolveCheck(
    stepId: String,
    result: StepResult,
    counts: Boolean,
    now: Long,
): LessonPlayerState {
    val step = steps[stepId]
    val isFirst = counts && stepId !in firstVerdicts
    val isMiss = counts && !result.isCorrect

    if (isMiss && step != null && step.canSelfCorrect && quickCheck == null && stepId !in selfCorrected) {
        return offerSelfCorrection(isFirst, stepId)
    }

    val willRetry =
        isMiss && quickCheck == null && step != null && step.isRetryStep && stepId !in retried && stepId !in unavailableStepIds

    val resolved =
        copy(
            checkFailed = false,
            firstVerdicts = if (isFirst) firstVerdicts + (stepId to result.isCorrect) else firstVerdicts,
            misses = missesAfter(counts, result.isCorrect, step),
            notice = notice.takeUnless { it == LessonNotice.SelfCorrect },
            phase = LessonPhase.Feedback,
            queue = if (willRetry) queue + stepId else queue,
            quickCheck = if (isMiss) quickCheck?.copy(missed = true) else quickCheck,
            results = results + (stepId to result),
            retried = if (willRetry) retried + stepId else retried,
        )

    return if (step?.kind == StepKind.MatchColumns) resolved.advance(now) else resolved
}

internal fun LessonPlayerState.explainFirst(now: Long): LessonPlayerState {
    val step = currentStep

    if (phase != LessonPhase.Playing || step == null || !step.isQuestionStep) return this

    val ids = explanationsAfter()

    if (ids.isEmpty()) return this

    val before = queue.take(position)
    val rest = queue.drop(position).filterNot(ids::contains)

    return copy(answers = answers - step.id, helped = helped + step.id, queue = before + ids + rest, stepStartedAt = now)
}

internal fun LessonPlayerState.startQuickCheck(now: Long): LessonPlayerState {
    val checks = quickCheckQueue()

    if (phase != LessonPhase.Playing || quickCheck != null || checks.isEmpty()) return this

    return copy(
        notice = null,
        queue = checks,
        quickCheck = QuickCheck(missed = false, returnPosition = position, returnQueue = queue),
    ).enterPosition(0, now)
}

/** With `questionFirst`, the first question of the opening skill comes before its explanations. */
internal fun orderLessonOpening(
    queue: List<String>,
    steps: Map<String, LessonStep>,
    support: LessonSupport?,
): List<String> {
    val start = queue.indexOfFirst { steps[it]?.kind != StepKind.Hook }

    if (support != LessonSupport.QuestionFirst || start == -1) return queue

    val opening = steps[queue[start]]

    if (opening == null || !opening.isExplainingStep) return queue

    val questionIndex =
        queue.indices.firstOrNull { index ->
            val step = steps[queue[index]]
            index > start && step != null && !step.isExplainingStep
        } ?: return queue
    val question = steps.getValue(queue[questionIndex])
    val asksSameSkill = question.isRetryStep && (question.skillId == null || opening.skillId == null || question.skillId == opening.skillId)

    if (!asksSameSkill) return queue

    val rest = queue.filterNot { it == question.id }
    return rest.take(start) + question.id + rest.drop(start)
}
