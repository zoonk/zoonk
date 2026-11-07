package com.zoonk.android.feature.player.engine

import com.zoonk.android.feature.player.model.LessonAnswer
import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.model.StepContent
import com.zoonk.android.feature.player.model.StepImage
import com.zoonk.android.feature.player.model.StepKind
import com.zoonk.android.feature.player.model.StepResult
import com.zoonk.api.models.LibraryLessonCompletion
import kotlin.time.Instant

sealed interface LessonAction {
    data class SelectAnswer(
        val stepId: String,
        val answer: LessonAnswer?,
    ) : LessonAction

    data object Continue : LessonAction

    data object GoBack : LessonAction

    /** "I don't know yet": the answer shown without a verdict. */
    data class DontKnow(
        val stepId: String,
    ) : LessonAction

    /** "Can't write now" for every writing screen ahead. */
    data class SkipWriting(
        val opening: Boolean = false,
    ) : LessonAction

    data object RestoreWriting : LessonAction

    data class SkipSteps(
        val stepIds: List<String>,
    ) : LessonAction

    data object ExplainFirst : LessonAction

    data object KnowThis : LessonAction

    data class CheckStarted(
        val stepId: String,
    ) : LessonAction

    /** [counts] is false for a guess and for a typed answer the server didn't check. */
    data class CheckResolved(
        val stepId: String,
        val result: StepResult,
        val counts: Boolean,
    ) : LessonAction

    data class CheckFailed(
        val stepId: String,
        val issue: CheckIssue? = null,
    ) : LessonAction

    /** The server's word on an answer graded on the device, matched by [attemptId]. */
    data class CheckConfirmed(
        val stepId: String,
        val attemptId: String,
        val nextReviewAt: Instant?,
        val savedMistake: Boolean,
    ) : LessonAction

    data class RunStarted(
        val runId: String,
        val answers: List<RunAnswer>,
        val hyperdrive: HyperdriveStart,
        val startedAt: Instant,
        val optionalStepIds: List<String> = emptyList(),
        val heldAnswers: List<RunAnswer> = emptyList(),
    ) : LessonAction

    /** A fresh read of the lesson's screens while some pictures were still being drawn. */
    data class PicturesRead(
        val fresh: List<LessonStep>,
        val openedAt: Long,
    ) : LessonAction

    /** After a completion the server found incomplete: its answers say which screen to go back to. */
    data class RunResynced(
        val runId: String?,
        val answers: List<RunAnswer>,
        val optionalStepIds: List<String> = emptyList(),
        val pictures: Map<String, StepImage> = emptyMap(),
    ) : LessonAction

    data class RunRefused(
        val refusal: LessonRefusal,
    ) : LessonAction

    data class CompletionSaved(
        val result: LibraryLessonCompletion,
    ) : LessonAction

    data object CompletionFailed : LessonAction

    data object CompletionRetried : LessonAction
}

/** Main's `lessonPlayerReducer`: one pure step from a state and an action; [now] is epoch milliseconds. */
fun reduce(
    state: LessonPlayerState,
    action: LessonAction,
    now: Long,
): LessonPlayerState =
    when (action) {
        is LessonAction.SelectAnswer -> {
            state.selectAnswer(action)
        }

        LessonAction.Continue -> {
            state.continueFrom(now)
        }

        LessonAction.GoBack -> {
            if (state.phase == LessonPhase.Playing) state.goBack(now) else state
        }

        is LessonAction.DontKnow -> {
            state.revealAnswer(action.stepId)
        }

        is LessonAction.SkipWriting -> {
            if (state.phase == LessonPhase.Playing) state.skipWriting(action.opening, now) else state
        }

        LessonAction.RestoreWriting -> {
            state.restoreWriting(now)
        }

        is LessonAction.SkipSteps -> {
            state.skipSteps(action.stepIds, now)
        }

        LessonAction.ExplainFirst -> {
            state.explainFirst(now)
        }

        LessonAction.KnowThis -> {
            state.startQuickCheck(now)
        }

        is LessonAction.CheckStarted -> {
            state.startChecking()
        }

        is LessonAction.CheckResolved -> {
            if (state.phase ==
                LessonPhase.Completed
            ) {
                state
            } else {
                state.resolveCheck(action.stepId, action.result, action.counts, now)
            }
        }

        is LessonAction.CheckFailed -> {
            state.failCheck(action)
        }

        is LessonAction.CheckConfirmed -> {
            state.confirmCheck(action)
        }

        is LessonAction.RunStarted -> {
            state.startRun(action, now)
        }

        is LessonAction.PicturesRead -> {
            state.withPictures(action.fresh, action.openedAt, now)
        }

        is LessonAction.RunResynced -> {
            state.resync(action, now)
        }

        is LessonAction.RunRefused -> {
            state.copy(run = LessonRun.Refused(action.refusal))
        }

        is LessonAction.CompletionSaved -> {
            state.withCompletion { it.copy(status = CompletionStatus.Saved, result = action.result) }
        }

        LessonAction.CompletionFailed -> {
            state.withCompletion { it.copy(status = CompletionStatus.Failed) }
        }

        LessonAction.CompletionRetried -> {
            state.withCompletion { it.copy(status = CompletionStatus.Saving) }
        }
    }

private fun LessonPlayerState.selectAnswer(action: LessonAction.SelectAnswer): LessonPlayerState {
    if (phase != LessonPhase.Playing) return this
    val answer = action.answer ?: return copy(answers = answers - action.stepId)
    return copy(answers = answers + (action.stepId to answer))
}

private fun LessonPlayerState.continueFrom(now: Long): LessonPlayerState {
    if (phase == LessonPhase.Feedback) return advance(now)

    val step = currentStep ?: return this

    if (phase != LessonPhase.Playing) return this
    if (step.kind == StepKind.Challenge) return continueChallenge()
    if (step.isReadStep) return continueReading(now)

    return this
}

private fun LessonPlayerState.startChecking(): LessonPlayerState =
    if (phase == LessonPhase.Playing) copy(checkFailed = false, checkIssue = null, phase = LessonPhase.Checking) else this

private fun LessonPlayerState.failCheck(action: LessonAction.CheckFailed): LessonPlayerState =
    if (phase == LessonPhase.Checking) copy(checkFailed = true, checkIssue = action.issue, phase = LessonPhase.Playing) else this

private fun LessonPlayerState.confirmCheck(action: LessonAction.CheckConfirmed): LessonPlayerState {
    val current = results[action.stepId]

    if (current == null || current.attemptId != action.attemptId) return this

    val confirmed = current.copy(nextReviewAt = action.nextReviewAt, savedMistake = action.savedMistake)
    return copy(results = results + (action.stepId to confirmed))
}

private fun LessonPlayerState.withCompletion(change: (LessonCompletion) -> LessonCompletion): LessonPlayerState =
    completion?.let { copy(completion = change(it)) } ?: this

/**
 * Starts over from the lesson's own order, then resumes at the first screen [answers] leave open. The opening guess,
 * never saved, stays as the learner left it; a canvas starts over only where its screen's answer changes.
 */
private fun LessonPlayerState.resumeFrom(
    answers: List<RunAnswer>,
    now: Long,
): LessonPlayerState {
    val fresh = LessonPlayerState.initial(lessonId, steps.values.toList(), now = now)
    val restore = writingRestore.takeIf { notice == LessonNotice.WritingSkipped }
    val skipped = restore?.skippedWritingStepIds ?: skippedWritingStepIds
    val isGuess = { id: String -> steps[id]?.content is StepContent.Guess }
    val available =
        fresh.copy(
            answers = this.answers.filterKeys(isGuess),
            queue = fresh.queue.filterNot { it in unavailableStepIds || it in skipped },
            results = results.filterKeys(isGuess),
            rounds = rounds,
        )

    if (available.queue.isEmpty()) return this

    val resumed = available.resume(answers, now).copy(run = run, skippedWritingStepIds = skipped, unavailableStepIds = unavailableStepIds)
    val changed = (this.answers.keys + resumed.answers.keys).filter { this.answers[it] != resumed.answers[it] }
    val restarted = resumed.copy(rounds = resumed.rounds + changed.associateWith { round(it) + 1 })
    return if (restore != null) restarted.skipWriting(opening = true, now = now) else restarted
}

private fun LessonPlayerState.startRun(
    action: LessonAction.RunStarted,
    now: Long,
): LessonPlayerState {
    val carried =
        action.answers
            .filter { it.answeredAt < action.startedAt }
            .map(RunAnswer::stepId)
            .toSet()
    val answers = withHeld(action.answers, action.heldAnswers)

    return copy(run = LessonRun.Started(action.runId, action.hyperdrive, carried))
        .skipSteps(action.optionalStepIds, now)
        .resumeFrom(answers, now)
}

/** The server's answers, then the device's held ones in turn; the server records nothing on a screen after its right answer. */
private fun withHeld(
    answers: List<RunAnswer>,
    held: List<RunAnswer>,
): List<RunAnswer> = held.fold(answers) { all, answer -> if (all.any { it.stepId == answer.stepId && it.isCorrect }) all else all + answer }

/**
 * Pictures drawn since are restored first; then every screen the server has no answer for is marked with why, and the
 * learner lands on the first of them with the whole lesson around it.
 */
private fun LessonPlayerState.resync(
    action: LessonAction.RunResynced,
    now: Long,
): LessonPlayerState {
    if (phase != LessonPhase.Completed) return this

    val started = run as? LessonRun.Started

    if (started != null && action.runId != null && action.runId != started.runId) {
        return withCompletion { it.copy(status = CompletionStatus.Failed) }
    }

    val available = skipSteps(action.optionalStepIds, now)
    val drawn = action.pictures.filterKeys { it in available.unavailableStepIds && it !in action.optionalStepIds }
    val resumed =
        available
            .copy(
                steps = available.steps.mapValues { (id, step) -> drawn[id]?.let { step.copy(image = it, imagePending = false) } ?: step },
                unavailableStepIds = available.unavailableStepIds - drawn.keys,
            ).resumeFrom(action.answers, now)
    val missing = resumed.queue.distinct().filter { resumed.steps[it]?.isAnswerable == true && it !in resumed.results }
    val first = missing.firstOrNull() ?: return withCompletion { it.copy(status = CompletionStatus.Failed) }
    val recovery = missing.associateWith { if (it in drawn) LessonNotice.PictureReady else LessonNotice.AnswerNotSaved }

    return resumed.copy(recovery = recovery).enterPosition(resumed.queue.indexOf(first), now)
}
