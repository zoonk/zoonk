package com.zoonk.android.feature.placementtest

import com.zoonk.android.data.LoadState
import com.zoonk.android.data.value
import com.zoonk.android.feature.onboarding.setup.isPending
import com.zoonk.android.feature.onboarding.setup.item
import com.zoonk.api.models.Placement
import com.zoonk.api.models.PlacementAttempt
import com.zoonk.api.models.PlacementCompletion
import com.zoonk.api.models.PlacementLength
import com.zoonk.api.models.PlacementResult
import com.zoonk.api.models.PlacementStatus
import com.zoonk.api.models.TrueFalseLabels
import kotlinx.serialization.Contextual
import kotlinx.serialization.Serializable
import java.util.UUID
import com.zoonk.android.feature.questions.Question as ItemQuestion

/** Main's `PlacementTestPhase`: where a read of a course's test leaves the learner. */
internal sealed interface PlacementTestPhase {
    data object Loading : PlacementTestPhase

    data object LoadFailed : PlacementTestPhase

    /** No test is open: the offer. */
    data object Choose : PlacementTestPhase

    /** The open part's questions are still being written. */
    data object Waiting : PlacementTestPhase

    /** Writing the open part's questions failed: starting it again retries them. */
    data class PreparationFailed(
        val attempt: PlacementAttempt,
    ) : PlacementTestPhase

    data class Question(
        val item: ItemQuestion,
        val attempt: PlacementAttempt,
        val labels: TrueFalseLabels,
    ) : PlacementTestPhase {
        /** The full test says its part from the first question; the quick test is one part. */
        val wholeCourse get() = attempt.length == PlacementLength.WHOLE_COURSE

        val number get() = attempt.answered.toInt() + 1
    }

    /** This part asks nothing more and isn't closed yet: closing it is the next save. */
    data class PartOver(
        val attempt: PlacementAttempt,
    ) : PlacementTestPhase

    /** A full test between parts or stopped midway, opened again: where it stands, and the way back in. */
    data class Continue(
        val attempt: PlacementAttempt,
    ) : PlacementTestPhase

    /** A full test's part, done; more parts are left. */
    @Serializable
    data class PartDone(
        @Contextual val attemptId: UUID,
        val part: Int,
        val parts: Int,
        val lessonsSkipped: Int,
        val partsLeft: Int,
        val minutesEach: Int,
        @Contextual val changeId: UUID? = null,
        val heldUntilTomorrow: Boolean = false,
    ) : PlacementTestPhase

    /** A full test stopped with questions left in its part: where it picks up. */
    @Serializable
    data class PartStopped(
        @Contextual val attemptId: UUID,
        val part: Int,
        val parts: Int,
        val question: Int,
        val lessonsSkipped: Int,
        @Contextual val changeId: UUID? = null,
    ) : PlacementTestPhase

    /**
     * The test's end: what it skipped in all and the lesson the plan goes on with. A quick test with [partsLeft] can go
     * on as the full test. [changeId] is set only when undoing it puts back every lesson the title counts.
     */
    @Serializable
    data class Result(
        val lessonsSkipped: Int,
        @Contextual val attemptId: UUID? = null,
        @Contextual val changeId: UUID? = null,
        val heldUntilTomorrow: Boolean = false,
        @Contextual val nextLessonId: UUID? = null,
        val nextLesson: String? = null,
        val partsLeft: Int = 0,
        val minutesEach: Int = 0,
    ) : PlacementTestPhase
}

/**
 * With no test open, the offer; an open one goes on where it stopped, once its questions are written. A part closed in
 * this visit ([closed]) shows what it did until the learner moves on, and a quick test that ended shows its result.
 * [finished] shows a test that's over with its result instead of a new offer, as onboarding does.
 */
internal fun placementTestPhase(
    placement: LoadState<Placement>,
    closed: PlacementTestPhase?,
    finished: Boolean = false,
): PlacementTestPhase {
    if (closed != null) return closed
    if (placement.isPending) return PlacementTestPhase.Loading
    if (placement is LoadState.Failed) return PlacementTestPhase.LoadFailed

    val read = placement.value ?: return PlacementTestPhase.Choose
    val attempt = read.attempt
    val result = read.result

    return when {
        attempt == null -> {
            if (finished && result != null) result.phase(attempt = null) else PlacementTestPhase.Choose
        }

        attempt.isStopped && attempt.length == PlacementLength.QUICK && result != null -> {
            result.phase(attempt)
        }

        attempt.isStopped -> {
            PlacementTestPhase.Continue(attempt)
        }

        read.status == PlacementStatus.FAILED -> {
            PlacementTestPhase.PreparationFailed(attempt)
        }

        !read.isReady -> {
            PlacementTestPhase.Waiting
        }

        else -> {
            read.next?.let { PlacementTestPhase.Question(it.item(), attempt, read.trueFalseLabels) }
                ?: PlacementTestPhase.PartOver(attempt)
        }
    }
}

/** Its part is done, or the learner stopped it midway: it waits for them to go on. */
private val PlacementAttempt.isStopped get() = partComplete || resume != null

private val Placement.isReady
    get() = status == PlacementStatus.ASKING || status == PlacementStatus.DONE || status == PlacementStatus.UNAVAILABLE

/** An open part with nothing more to ask, which closing applies. */
internal fun Placement.partOver(): PlacementAttempt? = attempt?.takeIf { !it.isStopped && isReady && next == null }

/** The minutes a part left takes; none once the server has no estimate. */
private val PlacementAttempt.minutesEach get() = estimatedMinutes.toInt()

/** Undo puts back the last part's skips, so it shows only when they're all the result counts. */
private fun PlacementResult.wholeChange(): UUID? = changeId?.takeIf { (partLessonsSkipped ?: lessonsSkipped) == lessonsSkipped }

/** The attempt onboarding's step names once a part of it closed; leaving before that is leaving without a test. */
internal val PlacementTestPhase.closedAttempt: UUID?
    get() =
        when (this) {
            is PlacementTestPhase.Continue -> attempt.id
            is PlacementTestPhase.PartDone -> attemptId
            is PlacementTestPhase.PartStopped -> attemptId
            is PlacementTestPhase.Result -> attemptId
            else -> null
        }

/** A test's result; a quick test whose [attempt] has parts left can go on as the full test. */
internal fun PlacementResult.phase(attempt: PlacementAttempt?) =
    PlacementTestPhase.Result(
        lessonsSkipped = lessonsSkipped.toInt(),
        attemptId = attemptId,
        changeId = wholeChange(),
        heldUntilTomorrow = heldUntilTomorrow == true,
        nextLessonId = nextLesson?.id,
        nextLesson = nextLesson?.title,
        partsLeft = attempt?.takeIf { it.length == PlacementLength.QUICK }?.partsLeft?.toInt() ?: 0,
        minutesEach = attempt?.minutesEach ?: 0,
    )

/** What closing [attempt]'s part did: a full test's part done or stopped with parts left, else the test's result. */
internal fun PlacementCompletion.phase(attempt: PlacementAttempt): PlacementTestPhase {
    val next = this.attempt
    val partSkipped = (partLessonsSkipped ?: lessonsSkipped).toInt()
    val changeId = changeId.takeIf { partSkipped > 0 }
    val held = heldUntilTomorrow == true
    val result = result
    val resume = next?.resume

    return when {
        next != null && next.length == PlacementLength.WHOLE_COURSE && resume != null -> {
            PlacementTestPhase.PartStopped(
                attempt.id,
                resume.part.toInt(),
                next.parts.toInt(),
                resume.question.toInt(),
                partSkipped,
                changeId,
            )
        }

        next != null && next.length == PlacementLength.WHOLE_COURSE -> {
            PlacementTestPhase.PartDone(
                attemptId = attempt.id,
                part = attempt.part.toInt(),
                parts = next.parts.toInt(),
                lessonsSkipped = partSkipped,
                partsLeft = next.partsLeft.toInt(),
                minutesEach = next.minutesEach,
                changeId = changeId,
                heldUntilTomorrow = held,
            )
        }

        result != null -> {
            result.phase(next)
        }

        else -> {
            PlacementTestPhase.Result(partSkipped, attemptId = attempt.id, changeId = changeId, heldUntilTomorrow = held)
        }
    }
}
