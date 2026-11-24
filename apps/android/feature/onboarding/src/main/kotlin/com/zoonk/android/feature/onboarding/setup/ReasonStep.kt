package com.zoonk.android.feature.onboarding.setup

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.input.InputTransformation
import androidx.compose.foundation.text.input.TextFieldLineLimits
import androidx.compose.foundation.text.input.clearText
import androidx.compose.foundation.text.input.maxLengthTrim
import androidx.compose.foundation.text.input.setTextAndPlaceCursorAtEnd
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.onboarding.Choice
import com.zoonk.android.feature.onboarding.ChoiceList
import com.zoonk.android.feature.plan.reasonTitleResource
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.OutlinedTextField
import com.zoonk.api.models.OnboardingAnswerInput
import com.zoonk.api.models.OnboardingAnswerInputOneOf3
import com.zoonk.api.models.OnboardingLanguageAim
import java.util.Locale

@Composable
internal fun ColumnScope.ReasonStep(
    subject: String,
    aim: OnboardingLanguageAim?,
    certificateExample: String?,
    pending: Boolean,
    words: UnsentWords,
    onAnswer: (OnboardingAnswerInput) -> Unit,
) {
    val reason = words.values[0]
    val typed = words.values[1]
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
                    OnboardingAnswerInput.OnboardingAnswerInputOneOf3Value(
                        OnboardingAnswerInputOneOf3(
                            OnboardingAnswerInputOneOf3.Question.REASON,
                            OnboardingAnswerInputOneOf3.Reason.entries.first { it.value == chosen },
                            typed.trim().takeIf { chosen == "certificate" || chosen == "other" }?.ifBlank { null },
                        ),
                    ),
                )
            }
        },
    ) {
        ChoiceList(
            choices =
                aim?.reasons.orEmpty().map { row ->
                    val key = row.reason.value
                    Choice(
                        key,
                        stringResource(requireNotNull(reasonTitleResource(key))),
                        if (key == "certificate") {
                            certificateExample
                        } else {
                            stringResource(
                                when (key) {
                                    "travel" -> R.string.onboarding_reason_travel_description
                                    "talk" -> R.string.onboarding_reason_talk_description
                                    "work" -> R.string.onboarding_reason_work_description
                                    "fluent" -> R.string.onboarding_reason_fluent_description
                                    else -> R.string.onboarding_reason_other_description
                                },
                            )
                        },
                    )
                },
            value = reason,
            label = stringResource(R.string.onboarding_reason_choices),
            readOnly = pending,
            onChange = { key ->
                if (reason != key) {
                    words.fields[0].setTextAndPlaceCursorAtEnd(key)
                    words.fields[1].clearText()
                }
            },
            afterChoice = { key ->
                if (reason == key && (certificate || key == "other")) {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            state = words.fields[1],
                            inputTransformation = InputTransformation.maxLengthTrim(MAX_ANSWER_LENGTH),
                            lineLimits = TextFieldLineLimits.SingleLine,
                            keyboardOptions =
                                KeyboardOptions(
                                    capitalization = KeyboardCapitalization.Sentences,
                                    imeAction = ImeAction.Next,
                                ),
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
            },
        )
    }
}

internal fun certificateExample(
    language: String?,
    region: String?,
): String? {
    val tag = language?.let(Locale::forLanguageTag) ?: return null
    return when (tag.language) {
        "de" -> {
            "Goethe-Zertifikat"
        }

        "en" -> {
            "IELTS"
        }

        "es" -> {
            "DELE"
        }

        "fr" -> {
            "DELF"
        }

        "it" -> {
            "CELI"
        }

        "ja" -> {
            "JLPT"
        }

        "ko" -> {
            "TOPIK"
        }

        "pt" -> {
            val tagRegion = tag.country.takeIf { tag.script.isEmpty() || tag.script == "Latn" }
            when (region ?: tagRegion) {
                "BR" -> "Celpe-Bras"
                "PT" -> "CAPLE"
                else -> "ACTFL OPI"
            }
        }

        "zh" -> {
            "HSK"
        }

        else -> {
            null
        }
    }
}
