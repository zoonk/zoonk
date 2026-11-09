package com.zoonk.android.feature.plan

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.onboarding.Choice
import com.zoonk.android.feature.onboarding.ChoiceList
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.ModalBottomSheet
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.factsLine
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.api.models.LanguageAimChoicesInner
import java.time.LocalDate

@Composable
fun languageAimName(aim: String): String? = languageAimNameResource(aim)?.let { stringResource(it) }

fun languageAimNameResource(aim: String): Int? =
    when (aim) {
        "A2" -> R.string.onboarding_aim_travel
        "B1" -> R.string.onboarding_aim_talk
        "B2" -> R.string.onboarding_aim_work
        "C1" -> R.string.onboarding_aim_fluent
        else -> null
    }

fun reasonTitleResource(reason: String): Int? =
    when (reason) {
        "travel" -> R.string.onboarding_reason_travel
        "talk" -> R.string.onboarding_reason_talk
        "work" -> R.string.onboarding_reason_work
        "fluent" -> R.string.onboarding_reason_fluent
        "certificate" -> R.string.onboarding_reason_certificate
        "other" -> R.string.onboarding_purpose_other
        else -> null
    }

@Composable
fun LanguageAimRow(
    aim: String,
    choices: List<LanguageAimChoicesInner>,
    onPick: (String, () -> Unit) -> Unit,
    pending: Boolean = false,
    failed: Boolean = false,
    endDate: LocalDate? = null,
    description: String? = null,
    note: String? = null,
    dates: @Composable () -> Map<String, LocalDate?> = { emptyMap() },
) {
    if (choices.isEmpty()) return
    var open by rememberSaveable { mutableStateOf(false) }
    ListRow(
        headline = { Text(stringResource(R.string.onboarding_your_aim)) },
        supporting = {
            Text(listOfNotNull(aim, languageAimName(aim)).factsLine())
            note?.let { Text(it) }
        },
        trailing = { Text(stringResource(R.string.onboarding_aim_change)) },
        chevron = false,
        onClick = { open = true },
    )
    if (open) {
        LanguageAimSheet(
            aim,
            choices,
            onDismiss = { open = false },
            onPick = { onPick(it) { open = false } },
            pending,
            failed,
            endDate,
            description,
            endDates = dates(),
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LanguageAimSheet(
    aim: String?,
    choices: List<LanguageAimChoicesInner>,
    onDismiss: () -> Unit,
    onPick: (String) -> Unit,
    pending: Boolean = false,
    failed: Boolean = false,
    endDate: LocalDate? = null,
    description: String? = null,
    endDates: Map<String, LocalDate?> = emptyMap(),
) {
    val locale = currentLocale()
    var picked by rememberSaveable { mutableStateOf<String?>(null) }
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            Modifier.verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                stringResource(R.string.onboarding_aim_picker_title),
                Modifier.semantics { heading() },
                style = MaterialTheme.typography.titleLarge,
            )
            description?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium) }
            ChoiceList(
                choices =
                    choices.map { choice ->
                        val date = if (choice.aim.value == aim) endDate else endDates[choice.aim.value]
                        Choice(
                            choice.aim.value,
                            listOfNotNull(choice.aim.value, languageAimName(choice.aim.value)).factsLine(),
                            if (date == null) {
                                stringResource(R.string.onboarding_aim_hours_more, formatNumber(choice.hours.toDouble(), locale))
                            } else {
                                stringResource(
                                    R.string.onboarding_aim_hours_month,
                                    formatNumber(choice.hours.toDouble(), locale),
                                    formatDate(date, locale, DateStyle.MonthShort),
                                )
                            },
                        )
                    },
                value = aim,
                label = stringResource(R.string.onboarding_aim_picker_title),
                readOnly = pending,
                busyValue = picked.takeIf { pending },
                onChange = {
                    if (it == aim) {
                        onDismiss()
                    } else {
                        picked = it
                        onPick(it)
                    }
                },
            )
            if (failed) Text(stringResource(R.string.onboarding_save_failed), color = MaterialTheme.colorScheme.error)
        }
    }
}
