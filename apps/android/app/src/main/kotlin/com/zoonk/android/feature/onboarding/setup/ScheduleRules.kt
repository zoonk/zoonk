package com.zoonk.android.feature.onboarding.setup

import androidx.compose.runtime.saveable.Saver
import com.zoonk.android.feature.plan.DaySplit
import com.zoonk.android.feature.plan.TimeLine
import com.zoonk.android.feature.plan.isBusy
import com.zoonk.android.feature.plan.suggestedMinutes
import com.zoonk.api.models.OnboardingTimeChoicesInner
import com.zoonk.api.models.PlanTimeAdviceInput
import com.zoonk.api.models.PlanTimeToCover
import com.zoonk.api.models.PlanTimeToCoverInput

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

internal val DaySplitSaver =
    Saver<DaySplit?, List<Int>>(
        save = { split -> split?.let { listOf(it.mine, it.others, it.rest) } },
        restore = { (mine, others, rest) -> DaySplit(mine, others, rest) },
    )

/**
 * Core's split of the time shown among the goals typed together: the question's own times carry
 * theirs, and a suggestion between them its own; the screen keeps a picked suggestion's split once
 * later weeks suggest other times.
 */
internal fun daySplit(
    minutes: Int?,
    choices: List<OnboardingTimeChoicesInner>,
    answers: List<PlanTimeToCover?>,
): DaySplit? {
    minutes ?: return null
    choices.find { it.minutes.toInt() == minutes }?.let { choice ->
        return choice.split?.let { DaySplit(it.mine.toInt(), it.others.toInt(), it.rest.toInt()) }
    }
    return answers
        .firstNotNullOfOrNull { answer -> answer?.suggested?.takeIf { it.minutes.toInt() == minutes } }
        ?.split
        ?.let { DaySplit(it.mine.toInt(), it.others.toInt(), it.rest.toInt()) }
}

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

/** The plan's answer for the days shown and what it says about the time shown. */
internal data class TimeAnswerState(
    val found: PlanTimeToCover?,
    val line: TimeLine,
    val updating: Boolean = false,
)

/** While the time shown is worked out again, the last answer stays in place, marked as updating. */
internal fun shownAnswer(
    last: TimeAnswerState,
    now: TimeAnswerState,
): TimeAnswerState {
    val updating = now.line.isBusy && !last.line.isBusy
    return (if (updating) last else now).copy(updating = updating)
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
