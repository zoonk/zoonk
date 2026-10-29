package com.zoonk.android.feature.today

import com.zoonk.android.feature.session.DayStep
import com.zoonk.android.feature.session.DayView
import com.zoonk.android.feature.session.EmptyDay
import com.zoonk.api.models.LessonGenerationStatus
import com.zoonk.api.models.StudyBlock

/**
 * A day with no blocks is a rest day, one still being outlined (`waiting`), or one with nothing new
 * (`ahead`): never a finished session.
 */
data class SessionState(
    val ahead: Boolean,
    val done: Boolean,
    val limitReached: Boolean,
    val rest: Boolean,
    val started: Boolean,
    val waiting: Boolean,
)

fun DayView.sessionState(): SessionState {
    val empty = steps.isEmpty()
    val limitReached = dailyLimit?.reached == true
    val studyDay = empty && !limitReached && minutes.dailyGoal > 0

    return SessionState(
        ahead = studyDay && emptyDay != EmptyDay.LessonsComing,
        done = !empty && nextPosition == null,
        limitReached = limitReached,
        rest = empty && !limitReached && minutes.dailyGoal == 0.0,
        started = steps.any { it.status != StudyBlock.Status.PENDING },
        waiting = studyDay && emptyDay == EmptyDay.LessonsComing,
    )
}

enum class DayState { Ahead, Done, Limit, Rest, Underway, Waiting }

fun DayView.dayState(): DayState {
    val state = sessionState()
    val hasNext = steps.any { it.position == nextPosition }

    return when {
        state.waiting -> DayState.Waiting
        hasNext && !state.limitReached -> DayState.Underway
        state.limitReached && !state.done -> DayState.Limit
        state.ahead -> DayState.Ahead
        state.rest -> DayState.Rest
        else -> DayState.Done
    }
}

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

fun DayView.showsFreshStart(studiedToday: Boolean): Boolean = freshStart != null && !studiedToday && !sessionState().started

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
        sessionState().waiting ||
        steps.any { step ->
            (step.status == StudyBlock.Status.PENDING || step.status == StudyBlock.Status.ACTIVE) && step.isBeingWritten(lessonStatus)
        }

/** Being done for the day, or resting, never hides what comes next. */
fun DayView.upNextLessons(pastDate: Boolean): List<com.zoonk.api.models.StudyExtraTimeLessonsInner> {
    val state = dayState()
    return if (pastDate || (state != DayState.Done && state != DayState.Rest) || !extraTime.available) emptyList() else extraTime.lessons
}
