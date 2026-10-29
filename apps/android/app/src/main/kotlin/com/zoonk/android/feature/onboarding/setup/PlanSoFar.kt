package com.zoonk.android.feature.onboarding.setup

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalResources
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.onboarding.start.UnderstoodRows
import com.zoonk.android.feature.onboarding.start.facts
import com.zoonk.android.feature.onboarding.start.text
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.Goal
import kotlinx.datetime.toJavaLocalDate
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import java.time.LocalDate
import java.time.temporal.ChronoUnit

internal data class PlanFact(
    val label: String,
    val value: String,
    val count: String? = null,
    val chip: Boolean = false,
)

@Composable
internal fun planFacts(goal: Goal): List<PlanFact> {
    val locale = currentLocale()
    val details = goal.details
    val date =
        goal.targetDate?.toJavaLocalDate()?.let { day ->
            val days =
                ChronoUnit.DAYS
                    .between(LocalDate.now(), day)
                    .toInt()
                    .coerceAtLeast(0)
            PlanFact(
                label =
                    stringResource(
                        if (goal.kind ==
                            Goal.Kind.EXAM
                        ) {
                            R.string.onboarding_row_exam_date
                        } else {
                            R.string.onboarding_date_label
                        },
                    ),
                value = formatDate(day, locale, DateStyle.Long),
                count = pluralStringResource(R.plurals.onboarding_days, days, days),
                chip = true,
            )
        }
    val answered = (details["answered"] as? JsonArray)?.any { (it as? JsonPrimitive)?.contentOrNull == "schedule" } == true
    val resources = LocalResources.current
    val rows = remember(resources, locale) { UnderstoodRows(resources, locale, is24Hour = false) }
    val facts = goal.facts()

    return listOfNotNull(PlanFact(stringResource(R.string.onboarding_row_goal), goal.title, chip = true), date) +
        (rows.languageRows(facts) + rows.detailRows(facts, cutoff = null)).map { PlanFact(it.label, it.value, chip = it.id in CHIP_ROWS) } +
        listOfNotNull(
            details.text("levelNote")?.let { PlanFact(stringResource(R.string.onboarding_row_level), it) },
            if (answered) {
                PlanFact(
                    stringResource(R.string.onboarding_time_a_day),
                    formatMinutes(goal.dailyMinutes.toInt(), locale),
                )
            } else {
                null
            },
        )
}

/** Short facts that also sit as chips over the schedule question on phones. */
private val CHIP_ROWS = setOf("targetLanguage", "targetCourse", "institution", "targetPosition", "targetScore")

@Composable
internal fun PlanSoFar(goal: Goal) {
    Column(Modifier.verticalScroll(rememberScrollState()).padding(24.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionHeader(stringResource(R.string.onboarding_plan_so_far))
        planFacts(goal).forEachIndexed { index, fact ->
            if (index > 0) HorizontalDivider()
            Row(
                Modifier
                    .fillMaxWidth()
                    .semantics(mergeDescendants = true) {
                    }.padding(vertical = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text(
                    fact.label,
                    modifier = Modifier.weight(LABEL_WEIGHT),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodySmall,
                )
                Column(Modifier.weight(1 - LABEL_WEIGHT)) {
                    Text(fact.value, fontWeight = FontWeight.Medium, style = MaterialTheme.typography.bodyMedium)
                    fact.count?.let {
                        Text(
                            it,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            style = MaterialTheme.typography.bodySmall.withTabularFigures(),
                        )
                    }
                }
            }
        }
    }
}

private const val LABEL_WEIGHT = 0.35f
