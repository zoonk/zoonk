package com.zoonk.android.feature.country

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.data.KeyedResources
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.MediaPending
import com.zoonk.android.ui.components.ModalBottomSheet
import com.zoonk.android.ui.components.OutlinedTextField
import com.zoonk.android.ui.components.SectionLabel
import com.zoonk.android.ui.components.TextButton
import com.zoonk.android.ui.theme.zoonk
import kotlinx.coroutines.launch
import java.text.Normalizer
import java.util.Locale

/** Every country by language, from the container's `CountryStore`, for the pickers; the app's frame provides it. */
val LocalCountryCatalog = staticCompositionLocalOf<KeyedResources<String, List<CountryChoice>>?> { null }

/**
 * The one country picker: a search over [suggested] then every country, named in [language], which
 * it reads once the sheet opens. A tap on a country picks it ([onPick]); on the [selected] one, it just closes.
 * With [allowNone], "Not set" comes first and picks null. While [pending], the row picked spins.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CountrySheet(
    title: String,
    suggested: List<CountryChoice>,
    language: String,
    selected: String?,
    onPick: (CountryChoice?) -> Unit,
    onDismiss: () -> Unit,
    allowNone: Boolean = false,
    pending: Boolean = false,
    failed: Boolean = false,
) {
    val catalog = LocalCountryCatalog.current?.get(language)
    val all = catalog?.collectShown()?.value ?: LoadState.Loading
    val scope = rememberCoroutineScope()
    var query by rememberSaveable { mutableStateOf("") }
    var picked by rememberSaveable { mutableStateOf<String?>(null) }
    val pick = { choice: CountryChoice? ->
        if (choice?.code == selected) {
            onDismiss()
        } else {
            picked = choice?.code ?: NONE
            onPick(choice)
        }
    }
    val row =
        @Composable { choice: CountryChoice ->
            CountryRow(choice, choice.code == selected, busy = pending && picked == choice.code, enabled = !pending) { pick(choice) }
        }
    val matches = query.takeIf { it.isNotBlank() }?.let { text -> (all.value ?: suggested).filter { matchesCountry(text, it.name) } }

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Column(Modifier.fillMaxHeight()) {
            Column(Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(title, Modifier.semantics { heading() }, style = MaterialTheme.typography.titleLarge)
                if (failed) {
                    Text(
                        stringResource(R.string.onboarding_save_failed),
                        Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
                OutlinedTextField(
                    value = query,
                    onValueChange = { query = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = stringResource(R.string.country_search),
                    leadingIcon = { Icon(painterResource(R.drawable.ic_search), contentDescription = null) },
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                    singleLine = true,
                )
                matches?.let { ResultCount(it.size) }
            }
            LazyColumn(Modifier.weight(1f).selectableGroup(), contentPadding = PaddingValues(bottom = 32.dp)) {
                if (matches != null) {
                    if (matches.isEmpty()) {
                        item(key = "no-match") { Quiet(stringResource(R.string.country_no_match)) }
                    }
                    items(matches, key = { "match-${it.code}" }, contentType = { "country" }) { row(it) }
                    return@LazyColumn
                }
                if (allowNone) {
                    item(key = "none", contentType = "country") {
                        val none = CountryChoice("", stringResource(R.string.settings_home_country_none))
                        CountryRow(none, selected == null, busy = pending && picked == NONE, enabled = !pending) { pick(null) }
                    }
                }
                if (suggested.isNotEmpty()) {
                    label("suggested", R.string.country_suggested)
                    items(suggested, key = { "suggested-${it.code}" }, contentType = { "country" }) { row(it) }
                }
                label("all", R.string.country_all)
                when (val state = all) {
                    is LoadState.Loaded -> {
                        items(state.value, key = { "all-${it.code}" }, contentType = { "country" }) { row(it) }
                    }

                    is LoadState.Failed -> {
                        item(key = "failed") {
                            Column(Modifier.padding(horizontal = LIST_ITEM_INSET, vertical = 8.dp)) {
                                Text(stringResource(R.string.country_load_failed), style = MaterialTheme.typography.bodyMedium)
                                TextButton(onClick = { scope.launch { catalog?.refresh() } }) {
                                    Text(stringResource(R.string.load_failed_try_again))
                                }
                            }
                        }
                    }

                    else -> {
                        items(count = SKELETON_ROWS, key = { "skeleton-$it" }, contentType = { "skeleton" }) {
                            MediaPending(
                                Modifier.fillMaxWidth().padding(horizontal = LIST_ITEM_INSET, vertical = 6.dp).heightIn(min = 40.dp),
                            ) {}
                        }
                    }
                }
            }
        }
    }
}

private fun LazyListScope.label(
    key: String,
    text: Int,
) = item(key = key, contentType = "label") {
    SectionLabel(stringResource(text), Modifier.padding(start = LIST_ITEM_INSET, end = LIST_ITEM_INSET, top = 16.dp, bottom = 4.dp))
}

/** As the onboarding's choice rows: a radio, the picked one tinted. Where the learner lives says so, and TalkBack reads it with the name. */
@Composable
private fun CountryRow(
    choice: CountryChoice,
    selected: Boolean,
    busy: Boolean,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    val home = stringResource(R.string.settings_home_country)
    val spoken = stringResource(R.string.country_home_label, choice.name)
    ListRow(
        headline = { Text(choice.name, Modifier.semantics { if (choice.home) contentDescription = spoken }) },
        busy = busy,
        supporting = if (choice.home) ({ Text(home, Modifier.clearAndSetSemantics {}) }) else null,
        modifier =
            Modifier
                .background(if (selected) MaterialTheme.zoonk.selectedTint else Color.Transparent)
                .selectable(selected = selected, enabled = enabled, role = Role.RadioButton, onClick = onClick),
        trailing = { RadioButton(selected = selected, onClick = null) },
    )
    HorizontalDivider(Modifier.padding(horizontal = LIST_ITEM_INSET))
}

@Composable
private fun Quiet(text: String) {
    Text(
        text,
        Modifier.padding(horizontal = LIST_ITEM_INSET, vertical = 16.dp),
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        style = MaterialTheme.typography.bodyMedium,
    )
}

/** Spoken as the search changes, so TalkBack hears how many countries match without leaving the field. */
@Composable
private fun ResultCount(count: Int) {
    val words =
        if (count == 0) stringResource(R.string.country_no_match) else pluralStringResource(R.plurals.country_result_count, count, count)
    Box(
        Modifier.semantics {
            liveRegion = LiveRegionMode.Polite
            contentDescription = words
        },
    )
}

/** Main's search: case and accents don't matter, and any word may start the match ("uni" finds "Reino Unido"). */
fun matchesCountry(
    query: String,
    name: String,
): Boolean {
    val words = normalize(query)
    val text = normalize(name)
    return text.startsWith(words) || WORD_STARTS.any { text.contains("$it$words") }
}

private fun normalize(text: String) =
    Normalizer
        .normalize(text, Normalizer.Form.NFD)
        .replace(COMBINING_ACCENTS, "")
        .lowercase(Locale.ROOT)
        .trim()

private val COMBINING_ACCENTS = Regex("\\p{Mn}+")
private val WORD_STARTS = listOf(" ", "-", "(", "'")

/** The "Not set" row's mark while it saves. */
private const val NONE = ""

private const val SKELETON_ROWS = 6
