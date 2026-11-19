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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.plan.studyDaysWords
import com.zoonk.android.ui.components.Readout
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.api.models.Goal
import com.zoonk.api.models.Plan
import java.time.LocalDate

/** Main's `RevealReadouts`: the time a day and where the plan ends, side by side between two rules. */
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
    val finish = revealFinish(plan, goal, today)
    Column {
        HorizontalDivider()
        Row(Modifier.height(IntrinsicSize.Min).padding(vertical = 12.dp)) {
            RevealReadout(formatMinutes(shape.weekdays.toInt(), locale), time, Modifier.weight(1f).padding(end = 12.dp))
            finish?.let {
                VerticalDivider()
                RevealReadout(it.value, it.label, Modifier.weight(1f).padding(start = 12.dp), it.isQuantity)
            }
        }
        HorizontalDivider()
    }
}

/** A level such as "B2" reads whole, where a quantity's words read small beside its number. */
private data class RevealFinish(
    val value: String,
    val label: String,
    val isQuantity: Boolean = true,
)

/** Where the plan ends: the days left before a date, the level a language plan reaches, or the month it ends. */
@Composable
private fun revealFinish(
    plan: Plan,
    goal: Goal,
    today: LocalDate,
): RevealFinish? {
    val locale = currentLocale()
    val facts = plan.revealFacts(today)
    val aim = plan.languageAim?.takeIf { facts.days == null && it.choices.any { choice -> choice.aim.value == it.aim?.value } }
    return when {
        aim != null -> {
            RevealFinish(
                aim.label ?: aim.aim?.value.orEmpty(),
                facts.end
                    ?.let { stringResource(R.string.onboarding_aim_by_month, formatDate(it, locale, DateStyle.Month)) }
                    .orEmpty(),
                isQuantity = false,
            )
        }

        facts.days != null -> {
            RevealFinish(
                pluralStringResource(
                    if (facts.daysEstimated) R.plurals.onboarding_reveal_days_estimated else R.plurals.onboarding_reveal_days,
                    facts.days,
                    formatNumber(facts.days.toDouble(), locale),
                ),
                stringResource(
                    if (goal.kind == Goal.Kind.EXAM) R.string.onboarding_reveal_until_exam else R.string.onboarding_reveal_until_date,
                ),
            )
        }

        facts.end != null -> {
            RevealFinish(formatDate(facts.end, locale, DateStyle.MonthShort), stringResource(R.string.onboarding_reveal_estimated_finish))
        }

        else -> {
            null
        }
    }
}

@Composable
private fun RevealReadout(
    value: String,
    label: String,
    modifier: Modifier = Modifier,
    isQuantity: Boolean = true,
) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        if (isQuantity) {
            Readout(value)
        } else {
            Text(value, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.SemiBold)
        }
        Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
    }
}
