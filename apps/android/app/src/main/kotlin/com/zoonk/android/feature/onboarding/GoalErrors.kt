package com.zoonk.android.feature.onboarding

import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import com.zoonk.android.R
import com.zoonk.api.models.AllowanceItem
import com.zoonk.api.models.AllowanceResponse

enum class GoalLimitReason {
    DailyExplanations,
    DailyGoals,
    Guest,
    MonthlyExplanations,
    MonthlyGoals,
    OneActiveGoal,
    SignUpRequired,
    SlowDown,
    ;

    /** Lifted by Plus, not by waiting. */
    val isPlusLimit get() = this == OneActiveGoal || this == MonthlyGoals

    val needsAccount get() = this == Guest || this == SignUpRequired
}

/** What a goal screen says went wrong; [needsAccount] shows Create a free account instead of a retry. */
sealed interface GoalError {
    data object CouldNotRead : GoalError

    data object OneMoment : GoalError

    data object CouldNotSave : GoalError

    /** A cap on reading new goals (small AI calls), not on goals themselves. */
    data class ReadLimit(
        val limit: UsageLimit,
    ) : GoalError

    data class Limit(
        val reason: GoalLimitReason,
    ) : GoalError

    val needsAccount: Boolean
        get() =
            when (this) {
                is Limit -> reason.needsAccount
                is ReadLimit -> limit.tier == "guest"
                else -> false
            }
}

fun Refusal.goalLimitReason(): GoalLimitReason =
    when (this) {
        Refusal.SignUpRequired -> {
            GoalLimitReason.SignUpRequired
        }

        is Refusal.Limit -> {
            val monthly = limit.period == "month"
            when {
                limit.tier == "guest" -> GoalLimitReason.Guest
                limit.resource == "activeGoals" -> GoalLimitReason.OneActiveGoal
                limit.resource == "explanation" -> if (monthly) GoalLimitReason.MonthlyExplanations else GoalLimitReason.DailyExplanations
                else -> if (monthly) GoalLimitReason.MonthlyGoals else GoalLimitReason.DailyGoals
            }
        }

        Refusal.SlowDown, Refusal.Unsupported -> {
            GoalLimitReason.SlowDown
        }
    }

/** Main's `useStartError`: a guest's one goal asks for an account, other caps say when to try again. */
fun WriteOutcome<*>.startError(): GoalError =
    when (this) {
        is WriteOutcome.Refused -> {
            when (val refusal = refusal) {
                is Refusal.Limit -> {
                    if (refusal.limit.resource == "goal" || refusal.limit.resource == "activeGoals") {
                        GoalError.Limit(GoalLimitReason.Guest)
                    } else {
                        GoalError.ReadLimit(refusal.limit)
                    }
                }

                Refusal.SignUpRequired -> {
                    GoalError.Limit(GoalLimitReason.SignUpRequired)
                }

                Refusal.SlowDown -> {
                    GoalError.OneMoment
                }

                Refusal.Unsupported -> {
                    GoalError.CouldNotRead
                }
            }
        }

        else -> {
            GoalError.CouldNotRead
        }
    }

/** Main's `findGoalStartLimit`: the first cap a new goal would hit, checked in core's order. */
fun AllowanceResponse.goalStartLimit(): GoalLimitReason? {
    val goal = items.find { it.kind == AllowanceItem.Kind.GOAL }
    val period =
        when {
            goal == null -> null
            goal.totalLimit?.let { goal.usedTotal >= it } == true -> "total"
            goal.dailyLimit?.let { goal.usedToday >= it } == true -> "day"
            goal.monthlyLimit?.let { goal.usedThisMonth >= it } == true -> "month"
            else -> null
        }
    val resource =
        when {
            period != null -> "goal"
            activeGoals.limit?.let { activeGoals.used >= it } == true -> "activeGoals"
            else -> return null
        }
    return Refusal.Limit(UsageLimit(period ?: "total", resource, tier.value)).goalLimitReason()
}

@Composable
fun goalLimitMessage(reason: GoalLimitReason): String =
    stringResource(
        when (reason) {
            GoalLimitReason.DailyExplanations -> R.string.onboarding_limit_daily_explanations
            GoalLimitReason.DailyGoals -> R.string.onboarding_limit_daily_goals
            GoalLimitReason.Guest -> R.string.onboarding_limit_guest
            GoalLimitReason.MonthlyExplanations -> R.string.onboarding_limit_monthly_explanations
            GoalLimitReason.MonthlyGoals -> R.string.onboarding_limit_monthly_goals
            GoalLimitReason.OneActiveGoal -> R.string.onboarding_limit_one_active_goal
            GoalLimitReason.SignUpRequired -> R.string.onboarding_limit_sign_up_required
            GoalLimitReason.SlowDown -> R.string.onboarding_limit_slow_down
        },
    )

@Composable
fun goalErrorMessage(error: GoalError): String =
    when (error) {
        GoalError.CouldNotRead -> {
            stringResource(R.string.onboarding_error_could_not_read)
        }

        GoalError.OneMoment -> {
            stringResource(R.string.onboarding_error_one_moment)
        }

        GoalError.CouldNotSave -> {
            stringResource(R.string.onboarding_error_could_not_save)
        }

        is GoalError.Limit -> {
            goalLimitMessage(error.reason)
        }

        is GoalError.ReadLimit -> {
            stringResource(
                when {
                    error.limit.tier == "guest" -> R.string.onboarding_read_limit_guest
                    error.limit.tier == "plus" -> R.string.onboarding_read_limit_plus
                    error.limit.period == "month" -> R.string.onboarding_read_limit_free_month
                    else -> R.string.onboarding_read_limit_free_day
                },
            )
        }
    }
