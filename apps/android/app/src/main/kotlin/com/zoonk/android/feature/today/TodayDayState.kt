package com.zoonk.android.feature.today

import com.zoonk.android.feature.session.DayStep
import com.zoonk.android.feature.session.DayView
import com.zoonk.api.models.LessonGenerationStatus
import com.zoonk.api.models.StudyBlock
import com.zoonk.api.models.StudySession

val DayView.limitReached: Boolean
    get() = dailyLimit?.reached == true

/** The learner's daily time limit is shorter than the day's plan, so the day stops at it. */
val DayView.limitCapsDay: Boolean
    get() = dailyLimit?.limitMinutes?.let { it < minutes.dailyGoal } == true

/** The limit ended the day before it held the plan's time. */
val DayView.limitCutDayShort: Boolean
    get() = limitReached && minutes.planned < minutes.dailyGoal

val DayView.started: Boolean
    get() = steps.any { it.status != StudyBlock.Status.PENDING }

val DayView.nextStep: DayStep?
    get() = steps.firstOrNull { it.position == nextPosition }

data class TodayQueue(
    val done: List<DayStep>,
    val before: List<DayStep>,
    val after: List<DayStep>,
)

fun DayView.queue(nextPosition: Long): TodayQueue {
    val nextIndex = steps.indexOfFirst { it.position == nextPosition }

    return TodayQueue(
        done = steps.filter(DayStep::isFinished),
        before = steps.take(nextIndex.coerceAtLeast(0)).filterNot(DayStep::isFinished),
        after = steps.drop(nextIndex + 1).filterNot(DayStep::isFinished),
    )
}

fun DayView.minutesLeft(): Long = steps.filterNot(DayStep::isFinished).sumOf { it.estimatedMinutes }

fun DayView.showsFreshStart(studiedToday: Boolean): Boolean = freshStart != null && !studiedToday && !started

/** The minutes actually studied, never the plan's minutes for the blocks done. */
fun DayView.studiedToday(): Long = week.days.firstOrNull { it.isToday }?.minutes ?: 0

/**
 * A lesson nobody has started writing is written when the learner opens it, so it never claims to
 * be in progress.
 */
fun DayStep.isBeingWritten(lessonStatus: Map<String, LessonGenerationStatus>): Boolean =
    kind == StudyBlock.Kind.LEARN && lessonId != null && lessonStatus[lessonId.toString()] == LessonGenerationStatus.GENERATING

/** While lessons are written or outlined, Today reads itself again until they land. */
fun DayView.isWaitingForLessons(lessonStatus: Map<String, LessonGenerationStatus>): Boolean =
    lessonsComing ||
        state == StudySession.State.WAITING ||
        steps.any { step ->
            (step.status == StudyBlock.Status.PENDING || step.status == StudyBlock.Status.ACTIVE) && step.isBeingWritten(lessonStatus)
        }

/** Being done for the day, or resting, never hides what comes next. */
fun DayView.upNextLessons(pastDate: Boolean): List<com.zoonk.api.models.StudyExtraTimeLessonsInner> {
    val dayEnded = state == StudySession.State.DONE || state == StudySession.State.REST
    return if (pastDate || !dayEnded || !extraTime.available) emptyList() else extraTime.lessons
}
