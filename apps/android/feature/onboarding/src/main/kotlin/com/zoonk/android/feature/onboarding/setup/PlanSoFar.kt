package com.zoonk.android.feature.onboarding.setup

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalResources
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.language.parseCefrScore
import com.zoonk.android.feature.onboarding.start.UnderstoodRows
import com.zoonk.android.feature.onboarding.start.facts
import com.zoonk.android.feature.onboarding.start.text
import com.zoonk.android.feature.plan.levelRangeFacts
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.ApiJson
import com.zoonk.api.models.Goal
import com.zoonk.api.models.LanguageLevelTestOneOfResult
import kotlinx.datetime.toJavaLocalDate
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import java.time.LocalDate
import java.time.temporal.ChronoUnit

internal data class PlanFact(
    val label: String,
    val value: String,
    val count: String? = null,
    val note: String? = null,
)

@Composable
internal fun planFacts(goal: Goal): List<PlanFact> {
    val locale = currentLocale()
    val details = goal.details
    val dateLabel = stringResource(if (goal.kind == Goal.Kind.EXAM) R.string.onboarding_row_exam_date else R.string.onboarding_date_label)
    val today = LocalDate.now(goalZone(goal.timezone))
    val date =
        goal.targetDate?.toJavaLocalDate()?.let { day ->
            val days =
                ChronoUnit.DAYS
                    .between(today, day)
                    .toInt()
                    .coerceAtLeast(0)
            PlanFact(
                label = dateLabel,
                value = formatDate(day, locale, DateStyle.Long),
                count = pluralStringResource(R.plurals.onboarding_days, days, days),
            )
        } ?: PlanFact(
            dateLabel,
            stringResource(if (goal.kind == Goal.Kind.EXAM) R.string.onboarding_row_to_be_confirmed else R.string.plan_end_none_set),
        ).takeIf { details.answered("targetDate") }
    val resources = LocalResources.current
    val rows = remember(resources, locale, today) { UnderstoodRows(resources, locale, is24Hour = false, today = today) }
    val facts = goal.facts()

    return listOfNotNull(PlanFact(stringResource(R.string.onboarding_row_goal), goal.displayName), date) +
        (rows.languageRows(facts) + rows.detailRows(facts, cutoff = null)).map { row ->
            PlanFact(row.label, row.value, note = row.note)
        } +
        listOfNotNull(
            levelFact(goal),
            if (details.answered("schedule")) {
                PlanFact(
                    stringResource(R.string.onboarding_time_a_day),
                    formatMinutes(goal.dailyMinutes.toInt(), locale),
                )
            } else {
                null
            },
        )
}

@Composable
private fun levelFact(goal: Goal): PlanFact? {
    if (goal.kind != Goal.Kind.LANGUAGE) {
        return setupLevel(goal.details)?.let { PlanFact(stringResource(R.string.onboarding_row_level), it) }
    }

    val test = goal.details["levelTest"] as? JsonObject
    val result =
        (test?.get("lastResult") as? JsonObject)?.let {
            runCatching { ApiJson.decodeFromJsonElement(LanguageLevelTestOneOfResult.serializer(), it) }.getOrNull()
        }
    val ranges = result?.let { levelRangeFacts(it.ranges) }.orEmpty()
    return ranges.takeIf { it.isNotEmpty() }?.let {
        PlanFact(stringResource(R.string.placementtest_level_title), it.joinToString(" · "))
    }
}

@Composable
private fun setupLevel(details: Map<String, JsonElement>): String? {
    val level = details.text("level")
    val own = OWN_LEVELS[level]?.let { stringResource(it) }
    return when {
        level != null && parseCefrScore(level) != null -> level
        own != null && details.answered("level") -> own
        else -> details.text("levelNote")?.takeIf(String::isNotBlank) ?: own
    }
}

private fun Map<String, JsonElement>.answered(question: String) =
    (this["answered"] as? JsonArray)?.any { (it as? JsonPrimitive)?.contentOrNull == question } == true

private val OWN_LEVELS =
    mapOf(
        "none" to R.string.onboarding_level_none,
        "basic" to R.string.onboarding_level_basic,
        "intermediate" to R.string.onboarding_level_intermediate,
        "advanced" to R.string.onboarding_level_advanced,
    )

@Composable
internal fun PlanSoFar(goal: Goal) {
    Column(Modifier.verticalScroll(rememberScrollState()).padding(24.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionHeader(stringResource(R.string.onboarding_plan_so_far))
        planFacts(goal).forEachIndexed { index, fact ->
            if (index > 0) HorizontalDivider()
            FlowRow(
                Modifier
                    .fillMaxWidth()
                    .semantics(mergeDescendants = true) {
                    }.padding(vertical = 4.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    fact.label,
                    modifier = Modifier.padding(end = 16.dp).alignByBaseline(),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodySmall,
                )
                Column(Modifier.alignByBaseline(), horizontalAlignment = Alignment.End) {
                    Text(fact.value, fontWeight = FontWeight.Medium, style = MaterialTheme.typography.bodyMedium)
                    fact.note?.let {
                        Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
                    }
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
