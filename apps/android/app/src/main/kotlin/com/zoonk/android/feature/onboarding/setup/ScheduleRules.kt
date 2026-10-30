package com.zoonk.android.feature.onboarding.setup

import com.zoonk.api.models.PlanTimeAdvice
import com.zoonk.api.models.PlanTimeAdviceInput
import com.zoonk.api.models.PlanTimeToCover
import com.zoonk.api.models.PlanTimeToCoverInput
import com.zoonk.api.models.PlanTimeToCoverSuggested
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

/** The goals typed together share the day's time; [place] is the shown goal's among them, the main one 0. */
internal data class GoalsTogether(
    val count: Int,
    val place: Int,
)

internal data class DaySplit(
    val mine: Int,
    val others: Int,
    val rest: Int,
)

/** Must match core's `splitDailyBudget`, which saves the day this way: the main goal weighs as two of the others. */
internal fun splitDailyBudget(
    budget: Int,
    count: Int,
): List<Int> {
    if (count <= 1) return if (count == 1) listOf(budget) else emptyList()
    val share = budget.toDouble() / (MAIN_GOAL_WEIGHT + count - 1)
    val other = maxOf(MIN_GOAL_MINUTES, (share / GOAL_MINUTES_STEP).toInt() * GOAL_MINUTES_STEP)
    val main = maxOf(MIN_GOAL_MINUTES, budget - other * (count - 1))
    return listOf(main) + List(count - 1) { other }
}

internal fun daySplit(
    minutes: Int?,
    together: GoalsTogether,
): DaySplit? {
    if (together.count < 2 || minutes == null) return null
    val shares = splitDailyBudget(minutes, together.count)
    val mine = shares.getOrElse(together.place) { minutes }
    return DaySplit(mine, together.count - 1, shares.sum() - mine)
}

private const val MAIN_GOAL_WEIGHT = 2
private const val MIN_GOAL_MINUTES = 5
private const val GOAL_MINUTES_STEP = 5

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

/** What the time shown means, or why that isn't known yet. */
internal sealed interface TimeLine {
    data object Asking : TimeLine

    data object AskFailed : TimeLine

    data object EveryTopic : TimeLine

    data class Everything(
        val suggested: Boolean,
    ) : TimeLine

    data object FindFailed : TimeLine

    data class Finish(
        val endDate: LocalDate,
    ) : TimeLine

    data object NoDays : TimeLine

    data object NoFinish : TimeLine

    data object PastDate : TimeLine

    data class Share(
        val share: Double,
    ) : TimeLine

    data object Working : TimeLine
}

internal fun suggestedMinutes(found: PlanTimeToCover?): Int? = found?.suggested?.minutes?.toInt()

/**
 * Null while the first time is still being worked out: no other time is shown in its place. The time
 * follows the suggestion as the days change only when the screen started on one; [settled] says none
 * is coming (no date, or asking failed), so the screen's own time shows.
 */
internal fun shownMinutes(
    fallback: Int,
    first: PlanTimeToCover?,
    found: PlanTimeToCover?,
    picked: Int?,
    settled: Boolean,
): Int? {
    if (picked != null) return picked
    if (first == null) return fallback.takeIf { settled }
    val firstSuggested = suggestedMinutes(first) ?: return fallback
    return suggestedMinutes(found) ?: firstSuggested
}

/** The time shown is a suggestion it follows, still the one for the days before: Continue waits for the new one. */
internal fun waitsForSuggestion(
    failed: Boolean,
    first: PlanTimeToCover?,
    found: PlanTimeToCover?,
    picked: Int?,
): Boolean = picked == null && found == null && !failed && suggestedMinutes(first) != null

/** Picking the suggested time again follows the suggestion as the days change, where it's followed. */
internal fun pickedMinutes(
    first: PlanTimeToCover?,
    found: PlanTimeToCover?,
    minutes: Int,
): Int? = minutes.takeUnless { suggestedMinutes(first) != null && suggestedMinutes(found) == minutes }

internal data class TooClose(
    val recommendedMinutes: Int?,
    val cause: Cause,
) {
    enum class Cause { Date, Days }
}

/**
 * Why no suggestion covers everything; null when one does, the time shown does, or the date passed.
 * The date is to blame only once every day is a study day: until then, more days bring the time down.
 */
internal fun tooClose(
    found: PlanTimeToCover?,
    line: TimeLine,
    studiesEveryDay: Boolean,
): TooClose? =
    when {
        found == null || found.pastDate || line is TimeLine.Everything -> null
        found.suggested?.kind == PlanTimeToCoverSuggested.Kind.EVERYTHING -> null
        else -> TooClose(found.recommendedMinutes?.toInt(), if (studiesEveryDay) TooClose.Cause.Date else TooClose.Cause.Days)
    }

/** Only while the time shown falls short of everything. */
internal fun offer(
    found: PlanTimeToCover?,
    line: TimeLine,
    minutes: Int?,
): PlanTimeToCoverSuggested? = found?.suggested?.takeIf { it.minutes.toInt() != minutes && line !is TimeLine.Everything }

/** [found] is the plan's answer for the days shown, [advice] its answer for the time shown on them; either is null while it's asked for. */
internal fun timeLine(
    advice: PlanTimeAdvice?,
    askFailed: Boolean,
    dated: Boolean,
    findFailed: Boolean,
    found: PlanTimeToCover?,
    hasDays: Boolean,
    minutes: Int?,
): TimeLine {
    val asking = if (askFailed) TimeLine.AskFailed else TimeLine.Asking
    return when {
        !hasDays -> TimeLine.NoDays
        minutes == null -> TimeLine.Working
        !dated && advice == null -> asking
        !dated -> advice?.endDate?.let(TimeLine::Finish) ?: TimeLine.NoFinish
        found == null -> if (findFailed) TimeLine.FindFailed else TimeLine.Working
        found.pastDate -> TimeLine.PastDate
        else -> datedLine(advice, asking, found.suggested, minutes)
    }
}

private fun datedLine(
    advice: PlanTimeAdvice?,
    asking: TimeLine,
    suggested: PlanTimeToCoverSuggested?,
    minutes: Int,
): TimeLine {
    if (suggested?.minutes?.toInt() == minutes) {
        return when (suggested.kind) {
            PlanTimeToCoverSuggested.Kind.EVERYTHING -> TimeLine.Everything(suggested = true)
            PlanTimeToCoverSuggested.Kind.EVERY_TOPIC -> TimeLine.EveryTopic
        }
    }
    val share = (advice ?: return asking).coveredShare ?: 0.0
    return if (share >= 1) TimeLine.Everything(suggested = false) else TimeLine.Share(share)
}

/** The time picked needs the plan's own answer, except the one it suggested. */
internal fun asksAboutTime(
    dated: Boolean,
    found: PlanTimeToCover?,
    fullCourse: Boolean,
    minutes: Int?,
): Boolean =
    when {
        minutes == null -> false
        !dated -> true
        found == null || found.pastDate -> false
        else -> fullCourse || found.suggested?.minutes?.toInt() != minutes
    }

/** An exam's choice to study everything holds until the time picked is known to cover it all. */
internal fun keepsFullCourse(
    checked: Boolean,
    line: TimeLine,
): Boolean = checked && line !is TimeLine.Everything
