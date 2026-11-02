package com.zoonk.android.feature.plan

import androidx.compose.runtime.Composable
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import com.zoonk.android.R
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
            if (pace.days ==
                1
            ) {
                stringResource(R.string.plan_pace_one_day_ahead)
            } else {
                pluralStringResource(R.plurals.plan_pace_days_ahead, pace.days, pace.days)
            }
        }

        is Pace.Behind -> {
            if (pace.lessons != null && pace.lessons > 0) {
                pluralStringResource(R.plurals.plan_pace_lessons_to_catch_up, pace.lessons, pace.lessons)
            } else if (pace.days == 1) {
                stringResource(R.string.plan_pace_one_day_behind)
            } else {
                pluralStringResource(R.plurals.plan_pace_days_behind, pace.days, pace.days)
            }
        }

        is Pace.ChallengesLeft -> {
            pluralStringResource(R.plurals.plan_pace_challenges_left, pace.challenges, pace.challenges)
        }

        Pace.Finished -> {
            stringResource(R.string.plan_pace_finished)
        }

        is Pace.NeedsAdjusting -> {
            stringResource(R.string.plan_pace_needs_adjusting)
        }

        Pace.OnTrack -> {
            stringResource(R.string.plan_pace_keeping_pace)
        }

        is Pace.PastDate -> {
            stringResource(R.string.plan_pace_past_your_date)
        }
    }

data class PaceFix(
    val text: String,
    val adjust: Boolean,
)

@Composable
fun paceFix(
    pace: Pace,
    isExam: Boolean,
): PaceFix? =
    when (pace) {
        is Pace.PastDate -> {
            PaceFix(pastDateSentence(pace.lessons, isExam), adjust = false)
        }

        is Pace.ChallengesLeft -> {
            PaceFix(
                stringResource(
                    if (pace.challenges ==
                        1
                    ) {
                        R.string.plan_pace_win_challenge
                    } else {
                        R.string.plan_pace_win_challenges
                    },
                ),
                adjust = false,
            )
        }

        is Pace.NeedsAdjusting -> {
            PaceFix(stringResource(R.string.plan_pace_no_longer_fits), adjust = true)
        }

        is Pace.Behind -> {
            if (pace.lessons != null && pace.lessons > 0) {
                PaceFix(pluralStringResource(R.plurals.plan_pace_earlier_lessons_first, pace.lessons, pace.lessons), adjust = false)
            } else {
                val days = pluralStringResource(R.plurals.plan_pace_days, pace.days, pace.days)
                PaceFix(
                    pluralStringResource(R.plurals.plan_pace_more_minutes, pace.extraMinutesPerDay, pace.extraMinutesPerDay, days),
                    adjust = false,
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
