package com.zoonk.android.feature.plan

import com.zoonk.api.models.PlanTimeAdvice
import com.zoonk.api.models.PlanTimeToCover
import com.zoonk.api.models.PlanTimeToCoverSuggested
import kotlinx.datetime.LocalDate

/** What the time shown means, or why that isn't known yet. */
sealed interface TimeLine {
    data object Asking : TimeLine

    data object AskFailed : TimeLine

    /** [whole] is false when the learner took part of the goal out of their plan, so everything is only what they kept. */
    data class Everything(
        val whole: Boolean,
    ) : TimeLine

    data object FindFailed : TimeLine

    data class Finish(
        val endDate: LocalDate,
    ) : TimeLine

    data object NoDays : TimeLine

    data object NoFinish : TimeLine

    data object PastDate : TimeLine

    /**
     * On a time that doesn't cover everything; [reachedShare] is 1 when every topic gets its first lessons, and null
     * when the plan doesn't say, which shows no sentence.
     */
    data class Share(
        val reachedShare: Double?,
    ) : TimeLine

    data object Working : TimeLine
}

/**
 * What the time shown covers on the days shown: by the date, the share it covers and the share whose topics it
 * starts, or when an undated goal finishes.
 */
data class LineAdvice(
    val coveredShare: Double?,
    val reachedShare: Double?,
    val endDate: LocalDate?,
)

fun PlanTimeAdvice.lineAdvice() = LineAdvice(coveredShare, reachedShare, endDate)

val TimeLine.isBusy: Boolean get() = this == TimeLine.Asking || this == TimeLine.Working

fun suggestedMinutes(found: PlanTimeToCover?): Int? = found?.suggested?.minutes?.toInt()

/** The longest time worth studying: what covers everything, or as much as any time does when part never fits. */
data class FullTime(
    val everything: Boolean,
    val minutes: Int,
)

internal fun fullTime(found: PlanTimeToCover?): FullTime? =
    found?.recommendedMinutes?.let { FullTime(everything = true, minutes = it.toInt()) }
        ?: found?.most?.let { FullTime(everything = false, minutes = it.minutes.toInt()) }

/** The picker's marked times: the suggestion, and beside a focus one the time that covers everything. */
data class MarkedTimes(
    val full: Int?,
    val suggested: Int?,
)

fun markedTimes(found: PlanTimeToCover?) =
    MarkedTimes(
        full = found?.recommendedMinutes?.toInt()?.takeIf { found.suggested?.kind == PlanTimeToCoverSuggested.Kind.FOCUS },
        suggested = suggestedMinutes(found),
    )

/** What covering everything takes, said beside a focus suggestion; [full] is null when not even a whole day covers everything. */
data class EverythingTakes(
    val full: FullTime?,
)

/** Beside a focus suggestion, the longer time that covers more; null when there's none to mention. */
internal fun longerTime(found: PlanTimeToCover?): EverythingTakes? {
    val suggested = found?.suggested?.takeIf { it.kind == PlanTimeToCoverSuggested.Kind.FOCUS } ?: return null
    val full = fullTime(found)
    return if (full != null && full.minutes <= suggested.minutes) null else EverythingTakes(full)
}

/** Under the time picked, while the suggestion is a focus: what covering everything takes, said as a fact, never offered. */
fun everythingTakesNote(found: PlanTimeToCover?): EverythingTakes? =
    EverythingTakes(fullTime(found)).takeIf { found?.suggested?.kind == PlanTimeToCoverSuggested.Kind.FOCUS }

/** The suggested time that covers everything, offered while a shorter one is shown; a focus suggestion is never offered. */
fun timeOffer(
    found: PlanTimeToCover?,
    line: TimeLine,
    minutes: Int?,
): Int? {
    val suggested = found?.suggested?.takeIf { it.kind == PlanTimeToCoverSuggested.Kind.EVERYTHING } ?: return null
    return suggested.minutes.toInt().takeIf { it != minutes && line !is TimeLine.Everything }
}

/** [found] is the plan's answer for the days shown, [advice] what the time shown covers on them; either is null while it's asked for. */
fun timeLine(
    advice: LineAdvice?,
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
        !dated -> advice?.let { it.endDate?.let(TimeLine::Finish) ?: TimeLine.NoFinish } ?: asking
        found?.pastDate == true -> TimeLine.PastDate
        else -> datedLine(advice, asking, findFailed, found, minutes)
    }
}

/** A share of 1 or none says nothing was taken out; any other means the learner took part out. */
private fun everythingLine(reachedShare: Double?) = TimeLine.Everything(whole = reachedShare == null || reachedShare >= 1)

private fun datedLine(
    advice: LineAdvice?,
    asking: TimeLine,
    findFailed: Boolean,
    found: PlanTimeToCover?,
    minutes: Int,
): TimeLine {
    val suggested = found?.suggested
    if (suggested?.minutes?.toInt() == minutes) {
        return when (suggested.kind) {
            PlanTimeToCoverSuggested.Kind.EVERYTHING -> everythingLine(suggested.reachedShare)
            PlanTimeToCoverSuggested.Kind.FOCUS -> TimeLine.Share(suggested.reachedShare)
        }
    }
    if (advice != null) {
        val covered = advice.coveredShare ?: 0.0
        return if (covered >= 1) everythingLine(advice.reachedShare) else TimeLine.Share(advice.reachedShare)
    }
    if (found == null) return if (findFailed) TimeLine.FindFailed else TimeLine.Working
    return asking
}
