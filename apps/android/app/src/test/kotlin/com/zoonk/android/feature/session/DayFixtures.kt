package com.zoonk.android.feature.session

import com.zoonk.api.models.DailyTimeLimit
import com.zoonk.api.models.StudyBlock
import com.zoonk.api.models.StudyExtraTime
import com.zoonk.api.models.StudySessionExamAccess
import com.zoonk.api.models.StudySessionFullMeal
import com.zoonk.api.models.StudySessionMinutes
import com.zoonk.api.models.StudySessionWeek
import com.zoonk.api.models.StudySessionWeekTime
import kotlinx.datetime.LocalDate
import java.util.UUID

internal val GOAL: UUID = UUID.fromString("5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2d01")
internal val SESSION: UUID = UUID.fromString("5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2d02")
internal val DAY: LocalDate = LocalDate(2026, 10, 28)

internal fun blockId(position: Int): UUID = UUID.fromString("5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2e%02d".format(position))

internal fun step(
    position: Int,
    status: StudyBlock.Status = StudyBlock.Status.PENDING,
    kind: StudyBlock.Kind = StudyBlock.Kind.LEARN,
    screen: StudyBlock.Screen = StudyBlock.Screen.LESSON,
    saved: Boolean = true,
    lessonId: UUID? = UUID.fromString("5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2f%02d".format(position)),
    planItemId: UUID? = null,
    minutes: Long = 5,
): DayStep =
    DayStep(
        id = if (saved) blockId(position) else null,
        position = position.toLong(),
        kind = kind,
        status = status,
        screen = screen,
        title = "Lesson $position",
        canDo = null,
        subject = null,
        oftenTested = false,
        estimatedMinutes = minutes,
        questions = 0,
        answered = 0,
        lessonId = lessonId,
        chapterId = null,
        areaId = null,
        planItemId = planItemId,
        planItemKey = "plan:$position",
        canTestOut = false,
        checkpoint = null,
        capsules = emptyList(),
        extra = false,
        fullReview = false,
        mistakesOnly = false,
        refresh = false,
        reinforcement = false,
        weakest = false,
        waitReason = null,
    )

internal fun day(
    steps: List<DayStep> = listOf(step(0), step(1)),
    nextPosition: Long? = steps.firstOrNull { !it.isFinished }?.position,
    dailyGoal: Double = 20.0,
    limitReached: Boolean = false,
    emptyDay: EmptyDay? = null,
    saved: Boolean = true,
): DayView =
    DayView(
        sessionId = if (saved) SESSION else null,
        goalId = GOAL,
        localDate = DAY,
        steps = steps,
        nextPosition = nextPosition,
        missions = emptyList(),
        fullMeal = StudySessionFullMeal(bonus = 0, earned = false, ready = false),
        dailyLimit = if (limitReached) DailyTimeLimit(limitMinutes = 30, reached = true, remainingMinutes = 0, usedMinutes = 30) else null,
        emptyDay = emptyDay,
        minutes = StudySessionMinutes(dailyGoal = dailyGoal, done = 0, planned = dailyGoal.toLong()),
        freshStart = null,
        examAccess = StudySessionExamAccess(includesMockExams = true, trialEnded = false),
        examTomorrow = false,
        extraTime = StudyExtraTime(available = false, lessons = emptyList(), minutes = 10, reason = null),
        catchUp = null,
        lessonsComing = false,
        plusLessons = emptyList(),
        week =
            StudySessionWeek(
                days = emptyList(),
                daysHitGoal = 0,
                nextStudyDate = null,
                studyDays = 5,
                time = StudySessionWeekTime(studiedMinutes = 0, targetMinutes = 100.0),
            ),
        dayEndsAt = 0,
    )
