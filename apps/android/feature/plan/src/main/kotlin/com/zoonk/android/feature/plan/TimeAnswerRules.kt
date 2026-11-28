package com.zoonk.android.feature.plan

import com.zoonk.api.models.PlanTimeAdvice
import com.zoonk.api.models.PlanTimeToCover
import com.zoonk.api.models.PlanTimeToCoverSuggested

/** What the line under the time says, or why that isn't known yet. */
sealed interface TimeLine {
    data object Asking : TimeLine

    data object AskFailed : TimeLine

    data object FindFailed : TimeLine

    /** Said by the finish readout beside the time, not in the line. */
    data class Finish(
        val forecast: PlanForecast,
    ) : TimeLine

    data object NoDays : TimeLine

    data object NoFinish : TimeLine

    data object PastDate : TimeLine

    /** A dated goal's suggested time a day; [focus] when it's capped, so the plan starts with what matters most. */
    data class Suggest(
        val minutes: Int,
        val focus: Boolean,
    ) : TimeLine

    data object Working : TimeLine
}

/** When an undated goal finishes at the time shown; null [forecast] when there's no finish to show. */
data class LineAdvice(
    val forecast: PlanForecast?,
)

fun PlanTimeAdvice.lineAdvice() = LineAdvice(forecast)

val TimeLine.isBusy: Boolean get() = this == TimeLine.Asking || this == TimeLine.Working

fun suggestedMinutes(found: PlanTimeToCover?): Int? = found?.suggested?.minutes?.toInt()

/** The suggested time, offered while a shorter one is picked; a longer one is the learner's and offers nothing. */
fun timeOffer(
    line: TimeLine,
    minutes: Int?,
): Int? = (line as? TimeLine.Suggest)?.minutes?.takeIf { minutes != null && minutes < it }

/**
 * [found] is the plan's answer for the days shown; [advice] when an undated goal finishes at the time shown. Either is
 * null while it's asked for. A dated goal's line is about the suggestion, so it doesn't change as the time does.
 */
fun timeLine(
    advice: LineAdvice?,
    askFailed: Boolean,
    dated: Boolean,
    findFailed: Boolean,
    found: PlanTimeToCover?,
    hasDays: Boolean,
    minutes: Int?,
): TimeLine =
    when {
        !hasDays -> {
            TimeLine.NoDays
        }

        minutes == null -> {
            TimeLine.Working
        }

        !dated -> {
            advice?.let { it.forecast?.let(TimeLine::Finish) ?: TimeLine.NoFinish }
                ?: if (askFailed) TimeLine.AskFailed else TimeLine.Asking
        }

        found == null -> {
            if (findFailed) TimeLine.FindFailed else TimeLine.Working
        }

        found.pastDate -> {
            TimeLine.PastDate
        }

        else -> {
            found.suggested?.let { TimeLine.Suggest(it.minutes.toInt(), it.kind == PlanTimeToCoverSuggested.Kind.FOCUS) }
                ?: TimeLine.FindFailed
        }
    }
