package com.zoonk.android.feature.plan

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.components.MonthReadout
import com.zoonk.android.ui.components.Readout
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import com.zoonk.api.models.Plan
import java.time.LocalDate

/** A language plan ends where its aim is, so its finish names the aim; null when the aim isn't one of its choices. */
val Plan.aimAhead: String?
    get() = languageAim?.takeIf { aim -> aim.choices.any { it.aim.value == aim.aim?.value } }?.let { it.label ?: it.aim?.value }

/** When the plan finishes, in a sentence, as its precision says: "March 2027", or "2031" once it's far off. */
@Composable
fun forecastDate(forecast: PlanForecast.On): String =
    if (forecast.year) {
        formatPlanDate(forecast.date, forecast.date, currentLocale(), year = true)
    } else {
        formatDate(forecast.date, currentLocale(), DateStyle.Month)
    }

@Composable
private fun monthYear(date: LocalDate): String = formatDate(date, currentLocale(), DateStyle.MonthShort)

/**
 * Main's finish readout, in the plan's reveal and beside the time a day: when an undated plan finishes, big over what
 * that is ("Mar 2027", "estimated finish"); a language plan's [aim] and when it's reached ("B2", "by Mar 2027"); or
 * "10+ years" past the years a plan lays out. Its month reads big and its year small, so the eye lands on when.
 */
@Composable
fun FinishReadout(
    forecast: PlanForecast,
    modifier: Modifier = Modifier,
    aim: String? = null,
    end: Boolean = false,
) {
    val locale = currentLocale()
    val align = if (end) TextAlign.End else null

    Column(
        modifier.semantics(mergeDescendants = true) {},
        verticalArrangement = Arrangement.spacedBy(4.dp),
        horizontalAlignment = if (end) Alignment.End else Alignment.Start,
    ) {
        val label =
            when {
                forecast is PlanForecast.Beyond -> {
                    Readout(stringResource(R.string.plan_finish_years_plus), textAlign = align)
                    stringResource(R.string.plan_finish_to_finish)
                }

                aim != null -> {
                    Text(aim, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.SemiBold, textAlign = align)
                    stringResource(R.string.onboarding_aim_by_month, forecastDate(forecast as PlanForecast.On))
                }

                (forecast as PlanForecast.On).year -> {
                    Readout(forecastDate(forecast), textAlign = align)
                    stringResource(R.string.onboarding_reveal_estimated_finish)
                }

                else -> {
                    val year = formatPlanDate(forecast.date, forecast.date, locale, year = true)
                    MonthReadout(monthYear(forecast.date), year, textAlign = align)
                    stringResource(R.string.onboarding_reveal_estimated_finish)
                }
            }
        Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall, textAlign = align)
    }
}

/**
 * The time a day with when the plan finishes at it beside it, as the time question and Adjust plan show them; under it
 * when they don't fit side by side. While a newer answer is worked out ([updating]), the last one stays, dimmed.
 */
@Composable
fun TimeWithFinish(
    forecast: PlanForecast?,
    modifier: Modifier = Modifier,
    aim: String? = null,
    updating: Boolean = false,
    picker: @Composable () -> Unit,
) {
    val busy = stringResource(R.string.plan_finish_working)
    FlowRow(
        modifier,
        horizontalArrangement = Arrangement.spacedBy(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        itemVerticalAlignment = Alignment.Bottom,
    ) {
        Box(Modifier.weight(1f)) { picker() }
        forecast?.let {
            FinishReadout(
                it,
                Modifier
                    .alpha(if (updating) UPDATING_ALPHA else 1f)
                    .semantics {
                        liveRegion = LiveRegionMode.Polite
                        if (updating) stateDescription = busy
                    },
                aim = aim,
                end = true,
            )
        }
    }
}
