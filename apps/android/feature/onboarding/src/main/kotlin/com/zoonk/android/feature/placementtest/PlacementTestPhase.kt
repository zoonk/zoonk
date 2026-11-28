package com.zoonk.android.feature.placementtest

import com.zoonk.android.data.LoadState
import com.zoonk.android.data.value
import com.zoonk.android.feature.onboarding.setup.isPending
import com.zoonk.android.feature.onboarding.setup.item
import com.zoonk.api.models.Placement
import com.zoonk.api.models.PlacementAttempt
import com.zoonk.api.models.PlacementCompletion
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

    /** The test's questions are still being written. */
    data object Waiting : PlacementTestPhase

    /** The test's next question can't be had and nothing is writing it: the first days place the learner instead. */
    data object Unavailable : PlacementTestPhase

    /**
     * Writing the test's questions failed: starting it again retries them. With no [attempt], the course a test was
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
        val number get() = attempt.answered.toInt() + 1
    }

    /** The test asks nothing more and isn't closed yet: closing it is the next save. */
    data class Over(
        val attempt: PlacementAttempt,
    ) : PlacementTestPhase

    /**
     * The test's end: where the learner starts ([chapter]), the course's line ([course]) and the lesson that's next.
     * [changeId] is set only when something was skipped, for Undo.
     */
    @Serializable
    data class Result(
        val lessonsSkipped: Int,
        @Contextual val attemptId: UUID? = null,
        @Contextual val changeId: UUID? = null,
        val heldUntilTomorrow: Boolean = false,
        @Contextual val nextLessonId: UUID? = null,
        val nextLesson: String? = null,
        val nextMinutes: Int? = null,
        val chapter: String? = null,
        val course: Course? = null,
    ) : PlacementTestPhase

    /** The course in plan order, for the result's line; null when the result exists before the plan does. */
    @Serializable
    data class Course(
        val lessons: Int,
        val chapters: List<Chapter>,
    )

    /**
     * A chapter's lessons: how many the test started the learner past ([skipped]), how many were already behind them for
     * any other reason ([done]), and whether they start in it.
     */
    @Serializable
    data class Chapter(
        val lessons: Int,
        val skipped: Int,
        val start: Boolean,
        val done: Int = 0,
    )
}

/** What closing a test in this visit showed, while the read still has it where the close left it. */
@Serializable
internal data class ClosedTest(
    @Contextual val attemptId: UUID,
    val result: PlacementTestPhase.Result,
) {
    /** The [read] is from after the close, or from just before it; another device that started a new test since wins. */
    fun standsIn(read: Placement): Boolean = read.attempt?.let { it.id == attemptId } ?: (read.result?.attemptId == attemptId)
}

/**
 * With no test open, the offer, or the wait for its questions once the learner [asked] for it; an open one goes on where
 * it stopped, once its questions are written. A test closed in this visit ([closed]) shows its result until the learner
 * moves on. [finished] shows a test that's over with its result instead of a new offer, as onboarding does.
 * [awaiting]: the learner's start came back before the course had questions.
 */
internal fun placementTestPhase(
    placement: LoadState<Placement>,
    closed: ClosedTest?,
    finished: Boolean = false,
    asked: Boolean = false,
    awaiting: Boolean = false,
): PlacementTestPhase {
    if (placement.isPending) return PlacementTestPhase.Loading
    if (placement is LoadState.Failed) return PlacementTestPhase.LoadFailed

    val read = placement.value ?: return PlacementTestPhase.Choose
    closed?.takeIf { it.standsIn(read) }?.let { return it.result }
    val attempt = read.attempt
    val result = read.result

    return when {
        attempt == null -> {
            when {
                finished && result != null -> result.phase()
                asked -> read.unopened(awaiting)
                else -> PlacementTestPhase.Choose
            }
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
                ?: PlacementTestPhase.Over(attempt)
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

internal val Placement.isReady
    get() = status == PlacementStatus.ASKING || status == PlacementStatus.DONE

/** An open test with nothing more to ask, which closing applies. */
internal fun Placement.over(): PlacementAttempt? = attempt?.takeIf { isReady && next == null }

/** The attempt onboarding's step names once the test closed; leaving before that is leaving without a test. */
internal val PlacementTestPhase.closedAttempt: UUID?
    get() = (this as? PlacementTestPhase.Result)?.attemptId

/** A test's result, with Undo only when it skipped something. */
internal fun PlacementResult.phase() =
    PlacementTestPhase.Result(
        lessonsSkipped = lessonsSkipped.toInt(),
        attemptId = attemptId,
        changeId = changeId?.takeIf { lessonsSkipped > 0 },
        heldUntilTomorrow = heldUntilTomorrow == true,
        nextLessonId = nextLesson?.id,
        nextLesson = nextLesson?.title,
        nextMinutes = nextLesson?.estimatedMinutes?.toInt(),
        chapter = chapter?.takeIf { it.isNotBlank() },
        course =
            course?.let { line ->
                PlacementTestPhase.Course(
                    lessons = line.lessons.toInt(),
                    chapters =
                        line.chapters.map {
                            PlacementTestPhase.Chapter(it.lessons.toInt(), it.skipped.toInt(), it.start, done = it.done.toInt())
                        },
                )
            },
    )

/** What closing [attempt] showed: its result, or what it skipped when the server sent no result. */
internal fun PlacementCompletion.closed(attempt: PlacementAttempt): ClosedTest {
    val skipped = lessonsSkipped.toInt()
    val shown =
        result?.phase() ?: PlacementTestPhase.Result(
            lessonsSkipped = skipped,
            attemptId = attempt.id,
            changeId = changeId.takeIf { skipped > 0 },
            heldUntilTomorrow = heldUntilTomorrow == true,
        )
    return ClosedTest(attempt.id, shown)
}
