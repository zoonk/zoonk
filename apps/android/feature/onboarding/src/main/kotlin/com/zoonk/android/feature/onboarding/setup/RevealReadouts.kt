package com.zoonk.android.feature.onboarding.setup

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.VerticalDivider
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.plan.FinishReadout
import com.zoonk.android.feature.plan.aimAhead
import com.zoonk.android.feature.plan.studyDaysWords
import com.zoonk.android.ui.components.Readout
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.api.models.Goal
import com.zoonk.api.models.Plan
import java.time.LocalDate

/**
 * Main's `RevealReadouts`: the time a day and where the plan ends, side by side between two rules: the days left
 * before a date, or when an undated plan finishes ([FinishReadout]).
 */
@Composable
internal fun RevealReadouts(
    plan: Plan,
    goal: Goal,
    today: LocalDate,
) {
    val locale = currentLocale()
    val shape = plan.schedule.shape
    val weekend = shape.weekend
    val weekdayMinutes = plan.schedule.weekdayMinutes.map { it.toInt() }
    val time =
        when {
            weekend != null -> stringResource(R.string.onboarding_reveal_weekends, formatMinutes(weekend.toInt(), locale))
            weekdayMinutes.all { it > 0 } -> stringResource(R.string.onboarding_reveal_a_day)
            else -> studyDaysWords(weekdayMinutes, locale)
        }
    val facts = plan.revealFacts(today)
    Column {
        HorizontalDivider()
        Row(Modifier.height(IntrinsicSize.Min).padding(vertical = 12.dp)) {
            RevealReadout(formatMinutes(shape.weekdays.toInt(), locale), time, Modifier.weight(1f).padding(end = 12.dp))
            val finish = Modifier.weight(1f).padding(start = 12.dp)
            when {
                facts.days != null -> {
                    VerticalDivider()
                    RevealReadout(daysWords(facts.days, facts.daysEstimated), untilWords(goal), finish)
                }

                facts.forecast != null -> {
                    VerticalDivider()
                    FinishReadout(facts.forecast, finish, aim = plan.aimAhead)
                }
            }
        }
        HorizontalDivider()
    }
}

@Composable
private fun daysWords(
    days: Int,
    estimated: Boolean,
): String =
    pluralStringResource(
        if (estimated) R.plurals.onboarding_reveal_days_estimated else R.plurals.onboarding_reveal_days,
        days,
        formatNumber(days.toDouble(), currentLocale()),
    )

@Composable
private fun untilWords(goal: Goal): String =
    stringResource(if (goal.kind == Goal.Kind.EXAM) R.string.onboarding_reveal_until_exam else R.string.onboarding_reveal_until_date)

@Composable
private fun RevealReadout(
    value: String,
    label: String,
    modifier: Modifier = Modifier,
) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Readout(value)
        Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
    }
}
