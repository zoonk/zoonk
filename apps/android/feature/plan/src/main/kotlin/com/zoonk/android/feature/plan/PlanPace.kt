package com.zoonk.android.feature.plan

import androidx.compose.runtime.Composable
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import com.zoonk.android.R
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.api.models.PlanStatus
import com.zoonk.api.models.PlanStatusOneOf5

/** The learner's pace against their plan (the API's `status`), never whether the plan reaches the goal. */
sealed interface Pace {
    data object OnTrack : Pace

    data class Ahead(
        val days: Int,
    ) : Pace

    /** [lessons] from earlier days come first, when the plan knows them. */
    data class Behind(
        val days: Int,
        val extraMinutesPerDay: Int,
        val lessons: Int?,
    ) : Pace

    data class ChallengesLeft(
        val challenges: Int,
    ) : Pace

    data object Finished : Pace

    data class NeedsAdjusting(
        val options: List<PlanStatusOneOf5.Options>,
    ) : Pace

    data class PastDate(
        val lessons: Int,
    ) : Pace
}

val PlanStatus.pace: Pace
    get() =
        when (this) {
            is PlanStatus.PlanStatusOneOfValue -> Pace.OnTrack
            is PlanStatus.PlanStatusOneOf1Value -> Pace.Ahead(value.days.toInt())
            is PlanStatus.PlanStatusOneOf2Value -> Pace.Behind(value.days.toInt(), value.extraMinutesPerDay.toInt(), value.lessons?.toInt())
            is PlanStatus.PlanStatusOneOf3Value -> Pace.ChallengesLeft(value.challenges.toInt())
            is PlanStatus.PlanStatusOneOf4Value -> Pace.Finished
            is PlanStatus.PlanStatusOneOf5Value -> Pace.NeedsAdjusting(value.options)
            is PlanStatus.PlanStatusOneOf6Value -> Pace.PastDate(value.lessons.toInt())
        }

@Composable
fun paceText(pace: Pace): String =
    when (pace) {
        is Pace.Ahead -> {
            pluralStringResource(R.plurals.plan_pace_days_ahead, pace.days, pace.days)
        }

        is Pace.Behind -> {
            if (pace.lessons != null && pace.lessons > 0) {
                pluralStringResource(R.plurals.plan_pace_lessons_behind, pace.lessons, pace.lessons)
            } else {
                pluralStringResource(R.plurals.plan_pace_days_behind, pace.days, pace.days)
            }
        }

        is Pace.ChallengesLeft -> {
            pluralStringResource(R.plurals.plan_pace_challenges_to_go, pace.challenges, pace.challenges)
        }

        Pace.Finished -> {
            stringResource(R.string.plan_pace_finished)
        }

        is Pace.NeedsAdjusting -> {
            stringResource(R.string.plan_pace_not_enough_time)
        }

        Pace.OnTrack -> {
            stringResource(R.string.plan_pace_up_to_date)
        }

        is Pace.PastDate -> {
            stringResource(R.string.plan_pace_date_passed)
        }
    }

/** The schedule sheet's one sentence; [adjust] offers Adjust plan, [today] a way to Today. */
data class PaceFix(
    val text: String,
    val adjust: Boolean = false,
    val today: Boolean = false,
)

@Composable
fun paceFix(
    pace: Pace,
    isExam: Boolean,
): PaceFix? =
    when (pace) {
        is Pace.PastDate -> {
            PaceFix(pastDateSentence(pace.lessons, isExam))
        }

        is Pace.ChallengesLeft -> {
            PaceFix(stringResource(if (pace.challenges == 1) R.string.plan_pace_win_challenge else R.string.plan_pace_win_challenges))
        }

        is Pace.NeedsAdjusting -> {
            PaceFix(stringResource(R.string.plan_pace_no_longer_fits), adjust = true)
        }

        is Pace.Behind -> {
            if (pace.lessons != null && pace.lessons > 0) {
                PaceFix(stringResource(R.string.plan_pace_lessons_first_today), today = true)
            } else {
                PaceFix(
                    stringResource(
                        R.string.plan_pace_more_minutes_a_day,
                        formatNumber(pace.extraMinutesPerDay.toDouble(), currentLocale()),
                        pluralStringResource(R.plurals.plan_pace_days, pace.days, pace.days),
                    ),
                )
            }
        }

        else -> {
            null
        }
    }

/** Never "ended": the plan keeps the lessons left until the learner adjusts it. */
@Composable
fun pastDateSentence(
    lessons: Int,
    isExam: Boolean,
): String =
    if (isExam) {
        pluralStringResource(R.plurals.plan_past_date_exam_sentence, lessons, lessons)
    } else {
        pluralStringResource(R.plurals.plan_past_date_goal_sentence, lessons, lessons)
    }
