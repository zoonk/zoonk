package com.zoonk.android.feature.onboarding.setup

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.listSaver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.country.CountryChoice
import com.zoonk.android.feature.country.CountrySheet
import com.zoonk.android.feature.country.choices
import com.zoonk.android.feature.country.lessonLanguageLine
import com.zoonk.android.feature.onboarding.Choice
import com.zoonk.android.feature.onboarding.ChoiceList
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.bleed
import com.zoonk.api.models.LearningProfileSuggestedInnerLessonVariety
import com.zoonk.api.models.OnboardingAnswerInput
import com.zoonk.api.models.OnboardingAnswerInputOneOf
import com.zoonk.api.models.OnboardingContentCountry

/**
 * Which country a country-dependent course is about. Unlike the other one-answer steps a tap only
 * picks, and Continue saves it, since a mis-tap would build a course for the wrong country; Skip
 * saves none, so the goal follows its language's own country.
 */
@Composable
internal fun ColumnScope.CountryStep(
    subject: String,
    country: OnboardingContentCountry,
    language: String,
    pending: Boolean,
    onAnswer: (OnboardingAnswerInput) -> Unit,
) {
    var picked by rememberSaveable(stateSaver = ChoiceSaver) { mutableStateOf<CountryChoice?>(null) }
    var choosing by rememberSaveable { mutableStateOf(false) }
    val suggested = country.suggested.choices()
    val listed =
        suggested.ifEmpty { listOfNotNull(country.defaultCountry?.let { CountryChoice(it.code, it.name) }) }
    // A country from the full list comes back as the list's first row, picked.
    val shown = listOfNotNull(picked?.takeIf { pick -> listed.none { it.code == pick.code } }) + listed
    val home = stringResource(R.string.settings_home_country)
    val title = stringResource(R.string.onboarding_variety_title)
    val answer = { code: String? ->
        onAnswer(
            OnboardingAnswerInput.OnboardingAnswerInputOneOfValue(
                OnboardingAnswerInputOneOf(OnboardingAnswerInputOneOf.Question.CONTENT_COUNTRY, code),
            ),
        )
    }
    val notice =
        lessonLanguageLine(picked?.lessonVariety)
            ?: country.defaultCountry?.let { stringResource(R.string.onboarding_country_skip_default, it.name) }

    StepForm(
        title = stringResource(R.string.onboarding_country_title),
        description = stringResource(R.string.onboarding_country_description),
        subject = subject,
        canContinue = picked != null,
        pending = pending,
        onContinue = { picked?.let { answer(it.code) } },
        onSkip = { answer(null) },
        notice =
            notice?.let {
                {
                    Text(
                        it,
                        Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
            },
    ) {
        Column {
            ChoiceList(
                choices = shown.map { Choice(it.code, it.name, home.takeIf { _ -> it.home }) },
                value = picked?.code,
                label = title,
                onChange = { code -> picked = shown.first { it.code == code } },
                readOnly = pending,
            )
            HorizontalDivider(Modifier.padding(horizontal = LIST_ITEM_INSET).bleed(LIST_ITEM_INSET))
            ListRow(
                headline = { Text(stringResource(R.string.onboarding_country_other)) },
                onClick = { choosing = true },
                enabled = !pending,
                modifier = Modifier.bleed(LIST_ITEM_INSET),
            )
        }
    }

    if (choosing) {
        CountrySheet(
            title = title,
            suggested = suggested,
            language = language,
            selected = picked?.code,
            onPick = { choice ->
                picked = choice
                choosing = false
            },
            onDismiss = { choosing = false },
        )
    }
}

private val ChoiceSaver =
    listSaver<CountryChoice?, String?>(
        save = { listOf(it?.code, it?.name, it?.lessonVariety?.language, it?.lessonVariety?.region, it?.home?.toString()) },
        restore = { (code, name, language, region, home) ->
            if (code == null || name == null) {
                null
            } else {
                CountryChoice(
                    code,
                    name,
                    if (language != null && region != null) LearningProfileSuggestedInnerLessonVariety(language, region) else null,
                    home == "true",
                )
            }
        },
    )
