package com.zoonk.android.feature.session

import com.zoonk.api.models.StudyBlock
import com.zoonk.api.models.StudyExtraTime
import com.zoonk.api.models.StudySession
import com.zoonk.api.models.StudySessionExamAccess
import com.zoonk.api.models.StudySessionFullMeal
import com.zoonk.api.models.StudySessionMinutes
import com.zoonk.api.models.StudySessionWeek
import com.zoonk.api.models.StudySessionWeekTime
import kotlinx.datetime.LocalDate
import java.util.Locale
import java.util.UUID

val GOAL: UUID = UUID.fromString("5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2d01")
val SESSION: UUID = UUID.fromString("5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2d02")
internal val DAY: LocalDate = LocalDate(2026, 10, 28)

fun blockId(position: Int): UUID = UUID.fromString("5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2e%02d".format(Locale.ROOT, position))

fun step(
    position: Int,
    status: StudyBlock.Status = StudyBlock.Status.PENDING,
    kind: StudyBlock.Kind = StudyBlock.Kind.LEARN,
    screen: StudyBlock.Screen = StudyBlock.Screen.LESSON,
    saved: Boolean = true,
    lessonId: UUID? = UUID.fromString("5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2f%02d".format(Locale.ROOT, position)),
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
        areas = emptyList(),
        topics = emptyList(),
        oftenTested = false,
        estimatedMinutes = 5,
        questions = 0,
        answered = 0,
        lessonId = lessonId,
        chapterId = null,
        areaId = null,
        planItemId = null,
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

fun day(
    steps: List<DayStep> = listOf(step(0), step(1)),
    nextPosition: Long? = steps.firstOrNull { !it.isFinished }?.position,
    dailyGoal: Double = 20.0,
    saved: Boolean = true,
): DayView =
    DayView(
        sessionId = if (saved) SESSION else null,
        goalId = GOAL,
        localDate = DAY,
        steps = steps,
        nextPosition = nextPosition,
        state = StudySession.State.UNDERWAY,
        missions = emptyList(),
        fullMeal = StudySessionFullMeal(bonus = 0, earned = false, ready = false),
        dailyLimit = null,
        emptyDay = null,
        minutes = StudySessionMinutes(dailyGoal = dailyGoal, done = 0, planned = dailyGoal.toLong()),
        freshStart = null,
        examAccess = StudySessionExamAccess(includesMockExams = true, trialEnded = false),
        examTomorrow = false,
        extraTime = StudyExtraTime(available = false, lessons = emptyList(), minutes = 10, reason = null),
        catchUp = null,
        lessonsComing = false,
        lessonsToPrepare = false,
        plusLessons = emptyList(),
        week =
            StudySessionWeek(
                days = emptyList(),
                nextStudyDate = null,
                time = StudySessionWeekTime(studiedMinutes = 0, targetMinutes = 100.0),
            ),
        dayEndsAt = 0,
    )
