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

/** The plan's answer for the days shown, with whether the goal's date has passed. */
internal data class FoundTime(
    val time: PlanTimeToCover,
    val pastDate: Boolean,
)

internal fun foundTime(
    time: PlanTimeToCover,
    today: LocalDate,
) = FoundTime(time, pastDate = time.targetDate?.let { it < today } == true)

internal data class SuggestedTime(
    val coversEverything: Boolean,
    val minutes: Int,
)

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

/** More time a day than this is never a learner's starting time, even when it's what covers it all. */
private const val LONGEST_SUGGESTED_MINUTES = 240

private fun PlanTimeToCover.suggestedTime(): SuggestedTime? {
    val everything = recommendedMinutes?.toInt()?.takeIf { it <= LONGEST_SUGGESTED_MINUTES }
    val everyTopic = coreMinutes?.toInt()?.takeIf { it <= LONGEST_SUGGESTED_MINUTES }
    return when {
        everything != null -> SuggestedTime(coversEverything = true, minutes = everything)
        everyTopic != null -> SuggestedTime(coversEverything = false, minutes = everyTopic)
        else -> null
    }
}

internal fun suggestedMinutes(found: FoundTime?): Int? =
    found
        ?.takeUnless { it.pastDate }
        ?.time
        ?.suggestedTime()
        ?.minutes

/**
 * Null while the first time is still being worked out: no other time is shown in its place. The time
 * follows the suggestion as the days change only when the screen started on one; [settled] says none
 * is coming (no date, or asking failed), so the screen's own time shows.
 */
internal fun shownMinutes(
    fallback: Int,
    first: FoundTime?,
    found: FoundTime?,
    picked: Int?,
    settled: Boolean,
): Int? {
    if (picked != null) return picked
    if (first == null) return fallback.takeIf { settled }
    val firstSuggested = suggestedMinutes(first) ?: return fallback
    return suggestedMinutes(found) ?: firstSuggested
}

/** Picking the suggested time again follows the suggestion as the days change, where it's followed. */
internal fun pickedMinutes(
    first: FoundTime?,
    found: FoundTime?,
    minutes: Int,
): Int? = minutes.takeUnless { suggestedMinutes(first) != null && suggestedMinutes(found) == minutes }

internal data class TooClose(
    val recommendedMinutes: Int?,
)

/** Why no suggestion covers everything; null when one does, the time shown does, or the date passed. */
internal fun tooClose(
    found: FoundTime?,
    line: TimeLine,
): TooClose? =
    when {
        found == null || found.pastDate || line is TimeLine.Everything -> null
        found.time.suggestedTime()?.coversEverything == true -> null
        else -> TooClose(found.time.recommendedMinutes?.toInt())
    }

/** Only while the time shown falls short of everything. */
internal fun offer(
    found: FoundTime?,
    line: TimeLine,
    minutes: Int?,
): SuggestedTime? =
    found
        ?.takeUnless { it.pastDate }
        ?.time
        ?.suggestedTime()
        ?.takeIf { it.minutes != minutes && line !is TimeLine.Everything }

/** [found] is the plan's answer for the days shown, [advice] its answer for the time shown on them; either is null while it's asked for. */
internal fun timeLine(
    advice: PlanTimeAdvice?,
    askFailed: Boolean,
    dated: Boolean,
    findFailed: Boolean,
    found: FoundTime?,
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
        else -> datedLine(advice, asking, found.time.suggestedTime(), minutes)
    }
}

private fun datedLine(
    advice: PlanTimeAdvice?,
    asking: TimeLine,
    suggested: SuggestedTime?,
    minutes: Int,
): TimeLine {
    if (suggested?.minutes == minutes) {
        return if (suggested.coversEverything) TimeLine.Everything(suggested = true) else TimeLine.EveryTopic
    }
    val share = (advice ?: return asking).coveredShare ?: 0.0
    return if (share >= 1) TimeLine.Everything(suggested = false) else TimeLine.Share(share)
}

/** The time picked needs the plan's own answer, except the one it suggested. */
internal fun asksAboutTime(
    dated: Boolean,
    found: FoundTime?,
    fullCourse: Boolean,
    minutes: Int?,
): Boolean =
    when {
        minutes == null -> false
        !dated -> true
        found == null || found.pastDate -> false
        else -> fullCourse || found.time.suggestedTime()?.minutes != minutes
    }

/** An exam's choice to study everything holds until the time picked is known to cover it all. */
internal fun keepsFullCourse(
    checked: Boolean,
    line: TimeLine,
): Boolean = checked && line !is TimeLine.Everything
