package com.zoonk.android.feature.onboarding.setup

import com.zoonk.api.models.PlanTimeAdvice
import com.zoonk.api.models.PlanTimeAdviceInput
import com.zoonk.api.models.PlanTimeToCover
import com.zoonk.api.models.PlanTimeToCoverInput
import kotlinx.datetime.LocalDate

/** Sunday is 0, as the plan numbers weekdays. */
internal val EVERY_DAY = (0..6).toList()

private val WEEKDAYS = (1..5).toList()

internal fun isWeekend(day: Int) = day == 0 || day == 6

/** A new goal's every-day week was never chosen, so the question opens on Monday to Friday unless someone chose fewer days. */
internal fun startingDays(goalDays: List<Int>): List<Int> = goalDays.takeIf { it.isNotEmpty() && it.size < EVERY_DAY.size } ?: WEEKDAYS

internal data class StudyWeek(
    val studyDays: List<Int>,
    val weekendMinutes: Int? = null,
    val fullCourse: Boolean = false,
)

internal fun studyWeek(
    days: List<Int>,
    minutes: Int,
    weekend: Int?,
    fullCourse: Boolean = false,
) = StudyWeek(days, weekend?.takeIf { it != minutes }, fullCourse)

internal fun StudyWeek.adviceInput(minutes: Int) =
    PlanTimeAdviceInput(
        studyDays = studyDays.map(Int::toLong),
        weekendMinutes = weekendMinutes?.toLong(),
        dailyMinutes = minutes.toLong(),
        fullCourse = fullCourse.takeIf { it },
    )

internal fun StudyWeek.coverInput() =
    PlanTimeToCoverInput(studyDays = studyDays.map(Int::toLong), weekendMinutes = weekendMinutes?.toLong())

/** Finding a time asks about the days and the weekend's time, never the daily time it's looking for. */
internal fun findWeek(
    days: List<Int>,
    weekend: Int?,
) = StudyWeek(days, weekend)

internal data class AdviceAnswer(
    val advice: PlanTimeAdvice,
    val week: StudyWeek,
    val minutes: Int,
)

internal fun weekAdvice(
    answer: AdviceAnswer?,
    week: StudyWeek,
): PlanTimeAdvice? = answer?.takeIf { it.week == week && it.advice.ready }?.advice

/** Times not asked about are unknown: extra time can change an exam's mock cadence. */
internal data class PickedShare(
    val known: Boolean,
    val share: Double?,
)

internal fun pickedShare(
    advice: PlanTimeAdvice?,
    answer: AdviceAnswer?,
    found: PlanTimeToCover?,
    minutes: Int,
): PickedShare =
    when {
        advice == null -> PickedShare(false, null)
        answer?.minutes == minutes -> PickedShare(true, advice.coveredShare)
        found != null && found.recommendedMinutes?.toInt() == minutes -> PickedShare(true, 1.0)
        else -> PickedShare(false, null)
    }

internal data class Finish(
    val minutes: Int,
    val end: LocalDate,
    val examDate: LocalDate,
    val namedMonth: Boolean,
)

internal fun fullCourseEnd(
    advice: PlanTimeAdvice?,
    answer: AdviceAnswer?,
    minutes: Int,
): Finish? {
    val end = advice?.fullCourseEndDate?.takeIf { answer?.minutes == minutes } ?: return null
    val examDate = advice.targetDate ?: return null
    return Finish(minutes, end, examDate, advice.targetDateNamedMonth)
}

/** Studying everything only matters while the picked time doesn't already cover it. */
internal fun keepsFullCourse(
    checked: Boolean,
    picked: PickedShare,
): Boolean = checked && !(picked.known && (picked.share ?: 0.0) >= 1)

internal data class Estimate(
    val advice: PlanTimeAdvice?,
    val share: Double?,
    val stale: Boolean,
    val staleMinutes: Int?,
    val failed: Boolean,
)

internal fun estimate(
    advice: PlanTimeAdvice?,
    answer: AdviceAnswer?,
    picked: PickedShare,
    status: PollStatus,
): Estimate {
    val last = answer?.advice?.takeIf { it.ready }
    val stale = !picked.known
    return Estimate(
        advice = advice ?: last,
        share = if (picked.known) picked.share else last?.coveredShare,
        stale = stale,
        staleMinutes = if (stale) answer?.minutes else null,
        failed = stale && status == PollStatus.Failed,
    )
}

internal fun showsEstimate(
    estimate: Estimate,
    picked: PickedShare,
    status: PollStatus,
): Boolean = if (picked.known) picked.share != null else estimate.share != null || estimate.failed || status != PollStatus.Failed

/** The time the plan offered: one that covers everything, or one that studies every topic. */
internal fun offeredMinutes(found: PlanTimeToCover?): Int? = (found?.recommendedMinutes ?: found?.coreMinutes)?.toInt()

internal enum class FindStatus { Pending, Answered, Building, Failed }
