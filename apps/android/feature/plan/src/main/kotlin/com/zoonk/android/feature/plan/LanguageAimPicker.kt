package com.zoonk.android.feature.plan

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
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
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.ModalBottomSheet
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.factsLine
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.api.models.LanguageAimChoicesInner
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import kotlin.math.roundToLong

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

fun aimEndDate(
    today: LocalDate,
    endDate: LocalDate?,
    currentHours: Long,
    hours: Long,
): LocalDate? =
    endDate?.takeIf { currentHours > 0 }?.let {
        val days = (ChronoUnit.DAYS.between(today, it).toDouble() * hours / currentHours).roundToLong()
        if (days > MAX_PLAN_DAYS) null else today.plusDays(days)
    }

@Composable
fun LanguageAimRow(
    aim: String,
    choices: List<LanguageAimChoicesInner>,
    onPick: (String, () -> Unit) -> Unit,
    pending: Boolean = false,
    failed: Boolean = false,
    endDate: LocalDate? = null,
    today: LocalDate = LocalDate.now(),
    description: String? = null,
) {
    if (choices.isEmpty()) return
    var open by rememberSaveable { mutableStateOf(false) }
    ListRow(
        headline = { Text(stringResource(R.string.onboarding_your_aim)) },
        supporting = { Text(listOfNotNull(aim, languageAimName(aim)).factsLine()) },
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
            today,
            description,
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
    today: LocalDate = LocalDate.now(),
    description: String? = null,
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
            val currentHours = choices.firstOrNull { it.aim.value == aim }?.hours ?: 0
            choices.forEach { choice ->
                val date = aimEndDate(today, endDate, currentHours, choice.hours)
                ListRow(
                    headline = { Text(listOfNotNull(choice.aim.value, languageAimName(choice.aim.value)).factsLine()) },
                    supporting = {
                        Text(
                            if (date ==
                                null
                            ) {
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
                    leading = { RadioButton(selected = choice.aim.value == aim, onClick = null) },
                    busy = pending && picked == choice.aim.value,
                    enabled = !pending || picked == choice.aim.value,
                    onClick = {
                        if (!pending) {
                            if (choice.aim.value ==
                                aim
                            ) {
                                onDismiss()
                            } else {
                                picked = choice.aim.value
                                onPick(choice.aim.value)
                            }
                        }
                    },
                    chevron = false,
                )
            }
            if (failed) Text(stringResource(R.string.onboarding_save_failed), color = MaterialTheme.colorScheme.error)
        }
    }
}
