package com.zoonk.android.feature.player.engine

import androidx.compose.runtime.Immutable
import com.zoonk.android.feature.player.model.LessonAnswer
import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.model.StepContent
import com.zoonk.android.feature.player.model.writtenText

enum class PrimaryLabel { Check, Checking, Confirm, Continue, Next, NextStep, SeeAnswer, SeeHowItWent, Start }

@Immutable
data class PrimaryAction(
    val isCheck: Boolean,
    val label: PrimaryLabel,
    val busy: Boolean = false,
    val enabled: Boolean = true,
)

/** One segment per screen of the lesson's progress. */
enum class Segment { Read, Right, Wrong, Current, Ahead }

/**
 * What the header, the action bar and the keys read about the screen in view (main's
 * `getLessonScreen`), derived from the state so they never disagree.
 */
@Immutable
data class LessonScreen(
    val step: LessonStep?,
    val primary: PrimaryAction?,
    val segments: List<Segment>,
    val canExplainFirst: Boolean,
    val canGoBack: Boolean,
    val canGoForward: Boolean,
    val canKnowThis: Boolean,
    val hyperdriveStreak: Int?,
    val quickCheck: Pair<Int, Int>?,
    val struggleOffer: LessonStep?,
    val unsentAnswer: Boolean,
)

private fun LessonAnswer?.isReady(): Boolean = this != null && (writtenText?.isNotBlank() ?: true)

private fun LessonPlayerState.readLabel(step: LessonStep): PrimaryLabel {
    val worked = step.content as? StepContent.WorkedExample
    if (worked != null && (revealed[step.id] ?: 1) < worked.content.steps.size) return PrimaryLabel.NextStep
    return if (position == queue.size - 1) PrimaryLabel.Continue else PrimaryLabel.Next
}

private fun LessonPlayerState.primaryAction(step: LessonStep): PrimaryAction? {
    if (phase == LessonPhase.Completed || run is LessonRun.Refused) return null
    if (phase == LessonPhase.Feedback) return PrimaryAction(isCheck = false, label = PrimaryLabel.Continue)
    if (phase == LessonPhase.Checking) return PrimaryAction(isCheck = true, label = PrimaryLabel.Checking, busy = true, enabled = false)
    if (step.isReadStep) return PrimaryAction(isCheck = false, label = readLabel(step))

    val challenge = step.content as? StepContent.Challenge
    if (challenge != null) {
        return when (val progress = challengeProgress(challenge.content, answers[step.id], revealed[step.id] ?: 0)) {
            ChallengeProgress.Intro -> {
                PrimaryAction(isCheck = false, label = PrimaryLabel.Start)
            }

            is ChallengeProgress.Ended -> {
                PrimaryAction(isCheck = true, label = PrimaryLabel.SeeHowItWent)
            }

            is ChallengeProgress.Deciding -> {
                PrimaryAction(
                    isCheck = false,
                    label = PrimaryLabel.Confirm,
                    enabled =
                        progress.pendingChoiceId != null,
                )
            }
        }
    }

    return PrimaryAction(
        isCheck = true,
        label = if (step.content is StepContent.Guess) PrimaryLabel.SeeAnswer else PrimaryLabel.Check,
        enabled = answers[step.id].isReady() && !step.imagePending,
    )
}

private fun LessonPlayerState.passedSegment(index: Int): Segment {
    val stepId = queue[index]
    val verdict = if (queue.indexOf(stepId) == index) firstVerdicts[stepId] else results[stepId]?.isCorrect

    return when (verdict) {
        null -> Segment.Read
        true -> Segment.Right
        false -> Segment.Wrong
    }
}

private fun LessonPlayerState.segments(): List<Segment> =
    queue.indices.map { index ->
        val answeredInView = index == position && phase == LessonPhase.Feedback
        when {
            index < position || answeredInView || phase == LessonPhase.Completed -> passedSegment(index)
            index == position -> Segment.Current
            else -> Segment.Ahead
        }
    }

fun LessonPlayerState.screen(): LessonScreen {
    val step = if (phase == LessonPhase.Completed) null else currentStep
    val isPlaying = phase == LessonPhase.Playing && run !is LessonRun.Refused
    val awaitingCheck = phase == LessonPhase.Playing || phase == LessonPhase.Checking

    return LessonScreen(
        step = step,
        primary = step?.let(::primaryAction),
        segments = segments(),
        canExplainFirst = isPlaying && step != null && step.isQuestionStep && step.id !in answers && explanationsAfter().isNotEmpty(),
        canGoBack = step != null && canGoBack,
        canGoForward =
            step != null && run !is LessonRun.Refused &&
                (phase == LessonPhase.Feedback || (phase == LessonPhase.Playing && step.isReadStep)),
        canKnowThis = isPlaying && quickCheck == null && step?.content is StepContent.Explanation && quickCheckQueue().isNotEmpty(),
        hyperdriveStreak = if (phase == LessonPhase.Feedback && step != null) hyperdriveStreak(step.id) else null,
        quickCheck = quickCheck?.let { position to queue.size },
        struggleOffer = struggleOffer(),
        unsentAnswer = awaitingCheck && step != null && answers[step.id]?.writtenText?.isNotBlank() == true,
    )
}
