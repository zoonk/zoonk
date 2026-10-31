package com.zoonk.android.feature.plan

import com.zoonk.api.models.PlanTimeAdvice
import com.zoonk.api.models.PlanTimeToCover
import com.zoonk.api.models.PlanTimeToCoverSuggested
import kotlinx.datetime.LocalDate

/** What the time shown means, or why that isn't known yet. */
internal sealed interface TimeLine {
    data object Asking : TimeLine

    data object AskFailed : TimeLine

    data class Everything(
        val suggested: Boolean,
    ) : TimeLine

    data object FindFailed : TimeLine

    data class Finish(
        val endDate: LocalDate,
    ) : TimeLine

    data class Focus(
        val coveredShare: Double,
        val everyTopic: Boolean,
    ) : TimeLine

    data object NoDays : TimeLine

    data object NoFinish : TimeLine

    data object PastDate : TimeLine

    data class Share(
        val share: Double,
    ) : TimeLine

    data object Working : TimeLine
}

/** What the time shown covers on the days shown: a share by the date, or when an undated goal finishes. */
internal data class LineAdvice(
    val coveredShare: Double?,
    val endDate: LocalDate?,
)

internal fun PlanTimeAdvice.lineAdvice() = LineAdvice(coveredShare, endDate)

internal val TimeLine.isBusy: Boolean get() = this == TimeLine.Asking || this == TimeLine.Working

internal fun suggestedMinutes(found: PlanTimeToCover?): Int? = found?.suggested?.minutes?.toInt()

/** The longest time worth studying: what covers everything, or as much as any time does when part never fits. */
internal data class FullTime(
    val coveredShare: Double,
    val everything: Boolean,
    val minutes: Int,
)

internal fun fullTime(found: PlanTimeToCover?): FullTime? =
    found?.recommendedMinutes?.let { FullTime(coveredShare = 1.0, everything = true, minutes = it.toInt()) }
        ?: found?.most?.let { FullTime(it.coveredShare, everything = false, minutes = it.minutes.toInt()) }

/** The picker's marked times: the suggestion, and beside a focus one the time that covers everything. */
internal data class MarkedTimes(
    val full: Int?,
    val suggested: Int?,
)

internal fun markedTimes(found: PlanTimeToCover?) =
    MarkedTimes(
        full = found?.recommendedMinutes?.toInt()?.takeIf { found.suggested?.kind == PlanTimeToCoverSuggested.Kind.FOCUS },
        suggested = suggestedMinutes(found),
    )

/** Beside a focus suggestion, the longer time that covers more; [full] is null when not even a whole day covers everything. */
internal data class LongerTime(
    val full: FullTime?,
)

/** Null when there's no longer time to mention. */
internal fun longerTime(found: PlanTimeToCover?): LongerTime? {
    val suggested = found?.suggested?.takeIf { it.kind == PlanTimeToCoverSuggested.Kind.FOCUS } ?: return null
    val full = fullTime(found)
    return if (full != null && full.minutes <= suggested.minutes) null else LongerTime(full)
}

internal sealed interface FullTimeNote {
    data class Takes(
        val full: FullTime?,
        val moreDays: Boolean,
    ) : FullTimeNote

    data object TooLong : FullTimeNote
}

/**
 * Beside a focus suggestion: what the longest useful time takes, or that the time shown, which
 * covers everything, is more than most people keep up. More days bring the time down until every
 * day is a study day, except where part never fits whatever the time.
 */
internal fun fullTimeNote(
    found: PlanTimeToCover?,
    line: TimeLine,
    studiesEveryDay: Boolean,
): FullTimeNote? {
    if (found?.suggested?.kind != PlanTimeToCoverSuggested.Kind.FOCUS) return null
    if (line is TimeLine.Everything) return FullTimeNote.TooLong
    val full = (longerTime(found) ?: return null).full
    val neverFits = full != null && !full.everything
    return FullTimeNote.Takes(full, moreDays = !studiesEveryDay && !neverFits)
}

internal enum class OfferKind { Everything, Focus, Full }

internal data class TimeOffer(
    val kind: OfferKind,
    val minutes: Int,
)

/** The suggestion while another time is shown, unless that time covers everything anyway; on a focus suggestion, the longest useful time. */
internal fun timeOffer(
    found: PlanTimeToCover?,
    line: TimeLine,
    minutes: Int?,
): TimeOffer? {
    val suggested = found?.suggested ?: return null
    val focus = suggested.kind == PlanTimeToCoverSuggested.Kind.FOCUS
    if (suggested.minutes.toInt() != minutes) {
        val covered = !focus && line is TimeLine.Everything
        return if (covered) null else TimeOffer(if (focus) OfferKind.Focus else OfferKind.Everything, suggested.minutes.toInt())
    }
    val full = fullTime(found)
    return if (focus && full != null && full.minutes > suggested.minutes) TimeOffer(OfferKind.Full, full.minutes) else null
}

/** [found] is the plan's answer for the days shown, [advice] what the time shown covers on them; either is null while it's asked for. */
internal fun timeLine(
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
            PlanTimeToCoverSuggested.Kind.EVERYTHING -> TimeLine.Everything(suggested = true)
            PlanTimeToCoverSuggested.Kind.FOCUS -> TimeLine.Focus(suggested.coveredShare, suggested.everyTopic)
        }
    }
    if (advice != null) {
        val share = advice.coveredShare ?: 0.0
        return if (share >= 1) TimeLine.Everything(suggested = false) else TimeLine.Share(share)
    }
    if (found == null) return if (findFailed) TimeLine.FindFailed else TimeLine.Working
    return asking
}
