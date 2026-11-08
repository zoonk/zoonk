package com.zoonk.android.feature.onboarding.setup

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.plan.reasonTitleResource
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.OutlinedTextField
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.factsLine
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.api.models.OnboardingAnswerInput
import com.zoonk.api.models.OnboardingAnswerInputOneOf2
import com.zoonk.api.models.OnboardingLanguageAim

@Composable
internal fun ColumnScope.ReasonStep(
    subject: String,
    aim: OnboardingLanguageAim?,
    pending: Boolean,
    words: UnsentWords,
    onAnswer: (OnboardingAnswerInput) -> Unit,
) {
    var reason by words.field(0)
    var typed by words.field(1)
    val certificate = reason == "certificate"
    StepForm(
        title = stringResource(R.string.onboarding_reason_title),
        subject = subject,
        description = stringResource(R.string.onboarding_reason_description),
        pending = pending,
        canContinue = reason.isNotEmpty() && (!certificate || typed.isNotBlank()),
        onContinue = {
            reason.takeIf { it.isNotEmpty() }?.let { chosen ->
                onAnswer(
                    OnboardingAnswerInput.OnboardingAnswerInputOneOf2Value(
                        OnboardingAnswerInputOneOf2(
                            OnboardingAnswerInputOneOf2.Question.REASON,
                            OnboardingAnswerInputOneOf2.Reason.entries.first { it.value == chosen },
                            typed.trim().takeIf { chosen == "certificate" || chosen == "other" }?.ifBlank { null },
                        ),
                    ),
                )
            }
        },
    ) {
        aim?.reasons?.forEach { row ->
            val key = row.reason.value
            ListRow(
                headline = { Text(stringResource(requireNotNull(reasonTitleResource(key)))) },
                supporting = {
                    Text(
                        stringResource(
                            when (key) {
                                "travel" -> R.string.onboarding_reason_travel_description
                                "talk" -> R.string.onboarding_reason_talk_description
                                "work" -> R.string.onboarding_reason_work_description
                                "fluent" -> R.string.onboarding_reason_fluent_description
                                "certificate" -> R.string.onboarding_reason_certificate_description
                                else -> R.string.onboarding_reason_other_description
                            },
                        ),
                    )
                },
                leading = { RadioButton(selected = reason == key, onClick = null, enabled = !pending) },
                meta = {
                    Text(
                        listOfNotNull(
                            row.aim?.value,
                            row.hours?.let {
                                stringResource(R.string.onboarding_aim_hours, formatNumber(it.toDouble(), currentLocale()))
                            },
                        ).factsLine()
                            .ifEmpty { stringResource(R.string.onboarding_reason_exam) },
                    )
                },
                enabled = !pending,
                onClick = {
                    if (reason != key) {
                        reason = key
                        typed = ""
                    }
                },
                chevron = false,
            )
            if (reason == key && (certificate || key == "other")) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = typed,
                        onValueChange = { typed = it },
                        enabled = !pending,
                        label =
                            stringResource(
                                if (certificate) R.string.onboarding_reason_which_exam else R.string.onboarding_reason_your_words,
                            ),
                    )
                    if (certificate) {
                        Text(
                            stringResource(R.string.onboarding_reason_exam_plan),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }
        Text(
            stringResource(R.string.onboarding_reason_hours_note),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}
