package com.zoonk.android.feature.today

import com.zoonk.android.feature.session.DayStep
import com.zoonk.android.feature.session.DayView
import com.zoonk.api.models.StudyBlock
import com.zoonk.api.models.StudyBlockLesson
import com.zoonk.api.models.StudySession
import java.util.UUID

val DayView.started: Boolean
    get() = steps.any { it.status != StudyBlock.Status.PENDING }

val DayView.nextStep: DayStep?
    get() = steps.firstOrNull { it.position == nextPosition }

data class TodayQueue(
    val done: List<DayStep>,
    val before: List<DayStep>,
    val after: List<DayStep>,
)

/** Without a next block, every step still to do comes after the done ones. */
val DayView.queue: TodayQueue
    get() {
        val nextIndex = steps.indexOfFirst { it.position == nextPosition }

        return TodayQueue(
            done = steps.filter(DayStep::isFinished),
            before = steps.take(nextIndex.coerceAtLeast(0)).filterNot(DayStep::isFinished),
            after = steps.drop(nextIndex + 1).filterNot(DayStep::isFinished),
        )
    }

/** The day's time left past [shown]'s rows; extra work isn't in the day's time. */
internal fun DayView.minutesAfter(shown: List<DayStep>): Double =
    (minutes.left - shown.filter { !it.isFinished && !it.extra }.sumOf { it.estimatedMinutes }).coerceAtLeast(0.0)

internal val DayView.heldMinutes: Double
    get() = if (lessonsComing || lessonsToPrepare) minutesAfter(steps) else 0.0

fun DayView.showsFreshStart(studiedToday: Boolean): Boolean = freshStart != null && !studiedToday && !started

/** The minutes actually studied, never the plan's minutes for the blocks done. */
fun DayView.studiedToday(): Long = week.days.firstOrNull { it.isToday }?.minutes ?: 0

/** While the day's lessons are outlined, Today reads itself again until they land. */
val DayView.isWaitingForOutline: Boolean
    get() = lessonsComing || state == StudySession.State.WAITING

/** The day's lessons still to do that its read says are being written, each with what the read says of it. */
val DayView.lessonsBeingWritten: Map<UUID, StudyBlockLesson>
    get() =
        steps
            .filter { (it.status == StudyBlock.Status.PENDING || it.status == StudyBlock.Status.ACTIVE) && it.isBeingWritten }
            .mapNotNull { step -> step.lessonId?.let { id -> step.lesson?.let { id to it } } }
            .toMap()

/** Being done for the day, resting, or waiting on a mock never hides what comes next; core lists them only then. */
fun DayView.upNextLessons(pastDate: Boolean): List<com.zoonk.api.models.StudyExtraTimeLessonsInner> =
    if (pastDate || !extraTime.available) emptyList() else extraTime.lessons
