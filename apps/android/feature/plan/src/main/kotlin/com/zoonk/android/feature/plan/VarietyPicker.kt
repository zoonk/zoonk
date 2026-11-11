package com.zoonk.android.feature.plan

import android.content.res.Resources
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalResources
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.onboarding.Choice
import com.zoonk.android.feature.onboarding.ChoiceList
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.ModalBottomSheet
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.varietyName
import com.zoonk.android.ui.format.varietyNameInSentence
import com.zoonk.api.models.RegionChoice
import java.util.Locale

/** A language goal's country, null until the learner chooses one, among those its language lists. */
@Immutable
data class Variety(
    val language: String,
    val region: String?,
    val choices: List<RegionChoice>,
) {
    val taughtRegion: String? get() = choices.firstOrNull { it.taught }?.code
}

/** Says that only the buddy and practice calls follow a country other than the one lessons teach. */
fun varietyNote(
    resources: Resources,
    locale: Locale,
    language: String,
    region: String?,
    taughtRegion: String?,
): String? {
    if (region == null || taughtRegion == null || region == taughtRegion) return null
    return resources.getString(
        R.string.onboarding_variety_note,
        varietyNameInSentence(language, region, locale),
        varietyNameInSentence(language, taughtRegion, locale),
    )
}

/** The Adjust plan row, as the aim's: the language, with its country once chosen, and Change. */
@Composable
internal fun VarietyRow(
    variety: Variety,
    onPick: (String?, () -> Unit) -> Unit,
    pending: Boolean,
    failed: Boolean,
    modifier: Modifier = Modifier,
) {
    var open by rememberSaveable { mutableStateOf(false) }
    ListRow(
        headline = { Text(stringResource(R.string.onboarding_row_language)) },
        supporting = { Text(varietyName(variety.language, variety.region, currentLocale())) },
        trailing = { Text(stringResource(R.string.onboarding_aim_change)) },
        chevron = false,
        onClick = { open = true },
        modifier = modifier,
    )
    if (open) {
        VarietySheet(variety, onDismiss = { open = false }, onPick = { onPick(it) { open = false } }, pending, failed)
    }
}

/** The countries to choose from, "No preference" first; choosing one saves it. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VarietySheet(
    variety: Variety,
    onDismiss: () -> Unit,
    onPick: (String?) -> Unit,
    pending: Boolean = false,
    failed: Boolean = false,
) {
    val title = stringResource(R.string.onboarding_row_language)
    val locale = currentLocale()
    val note = varietyNote(LocalResources.current, locale, variety.language, variety.region, variety.taughtRegion)
    var picked by rememberSaveable { mutableStateOf<String?>(null) }
    val choices =
        listOf(Choice(NO_REGION, stringResource(R.string.onboarding_variety_none))) +
            variety.choices.map { Choice(it.code, it.name) }

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            Modifier.verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(title, Modifier.semantics { heading() }, style = MaterialTheme.typography.titleLarge)
            // A language's countries run past the screen, so the error shows up here, where the learner is reading.
            Text(
                note ?: stringResource(
                    R.string.onboarding_variety_description,
                    varietyNameInSentence(variety.language, variety.taughtRegion, locale),
                ),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
            if (failed) {
                Text(
                    stringResource(R.string.onboarding_save_failed),
                    Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
            ChoiceList(
                choices = choices,
                value = variety.region ?: NO_REGION,
                label = title,
                readOnly = pending,
                busyValue = picked.takeIf { pending },
                onChange = {
                    if (it == (variety.region ?: NO_REGION)) {
                        onDismiss()
                    } else {
                        picked = it
                        onPick(it.ifEmpty { null })
                    }
                },
            )
        }
    }
}

/** "No preference" in the list, sent as null. */
private const val NO_REGION = ""
