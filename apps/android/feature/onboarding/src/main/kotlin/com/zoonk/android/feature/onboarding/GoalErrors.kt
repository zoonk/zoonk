package com.zoonk.android.feature.onboarding

import androidx.annotation.StringRes
import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import com.zoonk.android.R
import com.zoonk.android.feature.mindmaps.monthly
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LimitPeriod
import com.zoonk.android.ui.components.LimitTier
import com.zoonk.android.ui.components.comesBackLine
import com.zoonk.android.ui.components.gateSentence
import com.zoonk.api.models.AllowanceResponse
import com.zoonk.api.models.MonthlyAllowanceItem

sealed interface GoalLimitReason {
    data object ActiveGoals : GoalLimitReason

    data object DailyExplanations : GoalLimitReason

    data object DailyGoals : GoalLimitReason

    data object Guest : GoalLimitReason

    /** Counted over the last 30 days; [limit] says when one more fits. */
    data class MonthlyExplanations(
        val limit: Limit.Reached,
    ) : GoalLimitReason

    data class MonthlyGoals(
        val limit: Limit.Reached,
    ) : GoalLimitReason

    data object SignUpRequired : GoalLimitReason

    data object SlowDown : GoalLimitReason

    /** Lifted by Plus, not only by waiting. */
    val isPlusLimit get() = this == ActiveGoals || (this is MonthlyGoals && limit.tier == LimitTier.Free)

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
            val reached = limit.reached
            val daily = reached.period == LimitPeriod.Day
            when {
                limit.tier == "guest" -> {
                    GoalLimitReason.Guest
                }

                limit.resource == "activeGoals" -> {
                    GoalLimitReason.ActiveGoals
                }

                limit.resource == "explanation" -> {
                    if (daily) {
                        GoalLimitReason.DailyExplanations
                    } else {
                        GoalLimitReason.MonthlyExplanations(
                            reached,
                        )
                    }
                }

                else -> {
                    if (daily) GoalLimitReason.DailyGoals else GoalLimitReason.MonthlyGoals(reached)
                }
            }
        }

        Refusal.SlowDown, Refusal.Unsupported, Refusal.AlreadyRead, is Refusal.DayTooShort -> {
            GoalLimitReason.SlowDown
        }
    }

/** A guest's one goal asks for an account; other caps say when to try again. */
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

                Refusal.Unsupported, Refusal.AlreadyRead, is Refusal.DayTooShort -> {
                    GoalError.CouldNotRead
                }
            }
        }

        else -> {
            GoalError.CouldNotRead
        }
    }

/** The first cap a new goal would hit, checked in core's order. */
fun AllowanceResponse.goalStartLimit(): GoalLimitReason? {
    val goal = monthly(MonthlyAllowanceItem.Kind.GOAL)
    val period =
        when {
            goal == null -> null
            goal.totalLimit?.let { goal.usedTotal >= it } == true -> "total"
            goal.dailyLimit?.let { goal.usedToday >= it } == true -> "day"
            goal.monthlyLimit?.let { goal.usedThisMonth >= it } == true -> "month"
            else -> null
        }
    val limit =
        when {
            activeGoals.limit?.let { activeGoals.used >= it } == true -> UsageLimit("total", "activeGoals", tier.value)
            period != null -> UsageLimit(period, "goal", tier.value)
            else -> return null
        }
    return Refusal.Limit(limit).goalLimitReason()
}

@Composable
fun goalLimitMessage(reason: GoalLimitReason): String =
    when (reason) {
        GoalLimitReason.ActiveGoals -> stringResource(R.string.onboarding_limit_active_goals)
        GoalLimitReason.DailyExplanations -> stringResource(R.string.onboarding_limit_daily_explanations)
        GoalLimitReason.DailyGoals -> stringResource(R.string.onboarding_limit_daily_goals)
        GoalLimitReason.Guest -> stringResource(R.string.onboarding_limit_guest)
        is GoalLimitReason.MonthlyExplanations -> usedSentence(R.string.limit_quick_explanations_used, reason.limit)
        is GoalLimitReason.MonthlyGoals -> usedSentence(R.string.limit_goals_used, reason.limit)
        GoalLimitReason.SignUpRequired -> stringResource(R.string.onboarding_limit_sign_up_required)
        GoalLimitReason.SlowDown -> stringResource(R.string.onboarding_limit_slow_down)
    }

/** A cap used up over the last 30 days in one sentence: what ran out, then when more comes. */
@Composable
fun usedSentence(
    @StringRes title: Int,
    limit: Limit.Reached,
): String = gateSentence(stringResource(title), comesBackLine(limit))

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
            val reached = error.limit.reached
            when {
                error.limit.tier == "guest" -> stringResource(R.string.onboarding_read_limit_guest)
                reached.period != LimitPeriod.Day -> usedSentence(R.string.limit_goals_used, reached)
                error.limit.tier == "plus" -> stringResource(R.string.onboarding_read_limit_plus)
                else -> stringResource(R.string.onboarding_read_limit_free_day)
            }
        }
    }
