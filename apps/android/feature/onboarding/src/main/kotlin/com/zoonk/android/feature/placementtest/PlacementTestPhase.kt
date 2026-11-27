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

    /** The open part's next question can't be had and nothing is writing it: the first days place the learner instead. */
    data object Unavailable : PlacementTestPhase

    /**
     * Writing the open part's questions failed: starting it again retries them. With no [attempt], the course a test was
     * asked for couldn't be built, and starting again asks once more.
     */
    data class PreparationFailed(
        val attempt: PlacementAttempt?,
    ) : PlacementTestPhase

    /** The questions of a test the learner asked for before it could open are written: the start they asked for opens it now. */
    data object Arrived : PlacementTestPhase

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
        val minutesLeft: Int,
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
        val minutesLeft: Int = 0,
    ) : PlacementTestPhase
}

/**
 * What closing a part showed, and where the close left the test: [part] of [attemptId] with [answered] answers, or
 * [answered] null when it ended the test.
 */
@Serializable
internal data class ClosedPart(
    @Contextual val attemptId: UUID,
    val part: Long,
    val answered: Long?,
    val done: PlacementTestPhase.PartDone? = null,
    val stopped: PlacementTestPhase.PartStopped? = null,
    val result: PlacementTestPhase.Result? = null,
) {
    val phase: PlacementTestPhase? get() = done ?: stopped ?: result

    /**
     * The [read] still has the test where the close left it, or at that part from just before the close. Another device
     * that went on, stopped further on or finished the test since wins.
     */
    fun standsIn(read: Placement): Boolean {
        val now = read.attempt ?: return answered == null && read.result?.attemptId == attemptId
        return now.id == attemptId && now.part == part && (answered == null || now.answered <= answered)
    }
}

/**
 * With no test open, the offer, or the wait for its questions once the learner [asked] for it; an open one goes on where
 * it stopped, once its questions are written. A part closed in this visit ([closed]) shows what it did until the learner
 * moves on, while the read has the test where it closed, and a quick test that ended shows its result. [finished] shows
 * a test that's over with its result instead of a new offer, as onboarding does. [awaiting]: the learner's start came
 * back before the course had questions.
 */
internal fun placementTestPhase(
    placement: LoadState<Placement>,
    closed: ClosedPart?,
    finished: Boolean = false,
    asked: Boolean = false,
    awaiting: Boolean = false,
): PlacementTestPhase {
    if (placement.isPending) return PlacementTestPhase.Loading
    if (placement is LoadState.Failed) return PlacementTestPhase.LoadFailed

    val read = placement.value ?: return PlacementTestPhase.Choose
    closed?.takeIf { it.standsIn(read) }?.phase?.let { return it }
    val attempt = read.attempt
    val result = read.result

    return when {
        attempt == null -> {
            when {
                finished && result != null -> result.phase(attempt = null)
                asked -> read.unopened(awaiting)
                else -> PlacementTestPhase.Choose
            }
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

        read.status == PlacementStatus.UNAVAILABLE -> {
            PlacementTestPhase.Unavailable
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

/**
 * No test is open after the learner asked for one: it waits while the course and its questions are written, and opens
 * once they are if the start was [awaiting] them. Otherwise there's nothing to test.
 */
private fun Placement.unopened(awaiting: Boolean) =
    when (status) {
        PlacementStatus.PREPARING, PlacementStatus.WAITING_FOR_QUESTIONS -> PlacementTestPhase.Waiting
        PlacementStatus.FAILED -> PlacementTestPhase.PreparationFailed(attempt = null)
        PlacementStatus.UNAVAILABLE -> PlacementTestPhase.Unavailable
        else -> if (awaiting) PlacementTestPhase.Arrived else PlacementTestPhase.Unavailable
    }

/** Its part is done, or the learner stopped it midway: it waits for them to go on. */
private val PlacementAttempt.isStopped get() = partComplete || resume != null

internal val Placement.isReady
    get() = status == PlacementStatus.ASKING || status == PlacementStatus.DONE

/** An open part with nothing more to ask, which closing applies. */
internal fun Placement.partOver(): PlacementAttempt? = attempt?.takeIf { !it.isStopped && isReady && next == null }

/** About how long the parts left take, by the server's estimate. */
private val PlacementAttempt.minutesLeft get() = remainingEstimatedMinutes.toInt()

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
        minutesLeft = attempt?.minutesLeft ?: 0,
    )

/** What closing [attempt]'s part showed, and where it left the test. */
internal fun PlacementCompletion.closed(attempt: PlacementAttempt): ClosedPart {
    val shown = phase(attempt)
    val left = this.attempt
    return ClosedPart(
        attemptId = attempt.id,
        part = left?.part ?: attempt.part,
        answered = left?.answered,
        done = shown as? PlacementTestPhase.PartDone,
        stopped = shown as? PlacementTestPhase.PartStopped,
        result = shown as? PlacementTestPhase.Result,
    )
}

/** What closing [attempt]'s part did: a full test's part done or stopped with parts left, else the test's result. */
private fun PlacementCompletion.phase(attempt: PlacementAttempt): PlacementTestPhase {
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
                part = next.part.toInt(),
                parts = next.parts.toInt(),
                lessonsSkipped = partSkipped,
                partsLeft = next.partsLeft.toInt(),
                minutesLeft = next.minutesLeft,
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
