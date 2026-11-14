package com.zoonk.android.feature.settings

import android.content.Intent
import android.os.Build
import android.provider.Settings
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.net.toUri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.app.LocalSnackbarHostState
import com.zoonk.android.data.LearningProfileStore
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.country.CountryChoice
import com.zoonk.android.feature.country.CountrySheet
import com.zoonk.android.feature.country.choices
import com.zoonk.android.feature.country.shownLanguage
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.ui.characters.Buddy
import com.zoonk.android.ui.characters.BuddyCrop
import com.zoonk.android.ui.characters.BuddyGlasses
import com.zoonk.android.ui.characters.BuddyKind
import com.zoonk.android.ui.characters.BuddyLook
import com.zoonk.android.ui.characters.buddyName
import com.zoonk.android.ui.characters.look
import com.zoonk.android.ui.components.ButtonSize
import com.zoonk.android.ui.components.DropdownMenu
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.ListDivider
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.PageTitleRow
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.scaffold.PageScaffold
import com.zoonk.api.models.LearningProfile
import kotlinx.coroutines.launch
import java.util.Locale
import com.zoonk.api.models.Buddy as ProfileBuddy

class PreferencesViewModel(
    private val profile: LearningProfileStore,
) : ViewModel() {
    /** A change didn't save: it was put back. */
    var saveFailed by mutableStateOf(false)
        private set

    var isEditingBuddy by mutableStateOf(false)
        private set

    var isSavingBuddy by mutableStateOf(false)
        private set

    var buddySaveFailed by mutableStateOf(false)
        private set

    fun editBuddy(editing: Boolean) {
        isEditingBuddy = editing
        buddySaveFailed = false
    }

    fun saveFailedShown() {
        saveFailed = false
    }

    fun setSoundsEnabled(enabled: Boolean) = save { profile.setSoundsEnabled(enabled) }

    fun setHomeCountry(country: CountryChoice) = save { profile.setHomeCountry(country) }

    fun setBuddy(
        kind: BuddyKind,
        glasses: BuddyGlasses,
        name: String,
    ) {
        if (isSavingBuddy) return
        isSavingBuddy = true
        buddySaveFailed = false
        viewModelScope.launch {
            val saved =
                profile.setBuddy(
                    ProfileBuddy.Kind.entries.first { it.value == kind.key },
                    ProfileBuddy.Glasses.entries.first { it.value == glasses.key },
                    name.trim().ifEmpty { null },
                )
            isSavingBuddy = false
            if (saved) isEditingBuddy = false else buddySaveFailed = true
        }
    }

    private fun save(write: suspend () -> Boolean) {
        saveFailed = false
        viewModelScope.launch { saveFailed = !write() }
    }
}

/**
 * Main's preferences: the buddy and lesson sounds, then the app's language, which Android's own per-app
 * language setting changes, and where the learner lives. Visitors only get the language.
 */
@Composable
fun PreferencesScreen(
    app: AppContainer,
    navigator: AppNavigator,
) {
    val profile by app.learningProfile.profile.collectShown()
    val summary by app.learnerSummary.summary.collectShown()
    val preferences = viewModel { PreferencesViewModel(app.learningProfile) }
    val scope = rememberCoroutineScope()
    val snackbars = LocalSnackbarHostState.current
    val saveFailed = stringResource(R.string.settings_preferences_save_failed)

    LaunchedEffect(preferences.saveFailed) {
        if (preferences.saveFailed) {
            preferences.saveFailedShown()
            snackbars.showSnackbar(saveFailed)
        }
    }

    PageScaffold(onBack = { navigator.back() }, title = { Text(stringResource(R.string.settings_preferences)) }) { padding ->
        Box(
            modifier =
                Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .verticalScroll(rememberScrollState()),
            contentAlignment = Alignment.TopCenter,
        ) {
            Column(
                modifier =
                    Modifier.settingsColumn(),
                verticalArrangement = Arrangement.spacedBy(28.dp),
            ) {
                PageTitleRow(stringResource(R.string.settings_preferences), Modifier.padding(horizontal = LIST_ITEM_INSET))

                when (val state = profile) {
                    is LoadState.Loaded -> {
                        val look = summary.value?.buddy?.look() ?: BuddyLook()
                        BuddySection(state.value, look, preferences)
                        LessonsSection(state.value, preferences)
                    }

                    is LoadState.Failed -> {
                        LoadFailedMessage(onRetry = { scope.launch { app.learningProfile.profile.refresh() } })
                    }

                    LoadState.Loading -> {
                        CircularProgressIndicator(Modifier.align(Alignment.CenterHorizontally))
                    }

                    LoadState.Idle, LoadState.Empty -> {}
                }

                LanguageSection((profile as? LoadState.Loaded)?.value, preferences)
            }
        }
    }
}

@Composable
private fun BuddySection(
    profile: LearningProfile,
    summaryLook: BuddyLook,
    preferences: PreferencesViewModel,
) {
    val kind = BuddyKind.of(profile.buddy.kind.value)
    val glasses = BuddyGlasses.of(profile.buddy.glasses.value)
    val look = summaryLook.copy(kind = kind, glasses = glasses)
    val editLabel = if (profile.buddy.picked) R.string.settings_preferences_change else R.string.settings_preferences_choose_buddy

    SettingsSection(stringResource(R.string.settings_preferences_buddy)) {
        ListRow(
            leading = { Buddy(look, Modifier.size(32.dp), crop = BuddyCrop.Face) },
            headline = { Text(buddyName(kind, profile.buddy.name), maxLines = 1, overflow = TextOverflow.Ellipsis) },
            trailing = {
                OutlinedButton(onClick = { preferences.editBuddy(true) }, size = ButtonSize.Small) { Text(stringResource(editLabel)) }
            },
        )
    }

    if (preferences.isEditingBuddy) {
        BuddyEditor(
            look = look,
            name = profile.buddy.name.orEmpty(),
            earnedGlasses = profile.availableGlasses.map { BuddyGlasses.of(it.value) }.toSet() + BuddyGlasses.Round,
            isSaving = preferences.isSavingBuddy,
            saveFailed = preferences.buddySaveFailed,
            onClose = { preferences.editBuddy(false) },
            onSave = preferences::setBuddy,
        )
    }
}

@Composable
internal fun LessonsSection(
    profile: LearningProfile,
    preferences: PreferencesViewModel,
) {
    SettingsSection(stringResource(R.string.settings_preferences_lessons)) {
        Column {
            SwitchRow(
                title = stringResource(R.string.settings_preferences_sounds),
                description = stringResource(R.string.settings_preferences_sounds_description),
                checked = profile.soundsEnabled,
                onCheckedChange = preferences::setSoundsEnabled,
            )
        }
    }
}

@Composable
internal fun SwitchRow(
    title: String,
    description: String?,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
) {
    ListRow(
        headline = { Text(title) },
        supporting = description?.let { { Text(it) } },
        trailing = { Switch(checked = checked, onCheckedChange = null) },
        modifier = Modifier.toggleable(value = checked, role = Role.Switch, onValueChange = onCheckedChange),
    )
}

/** What a row is set to, at its end in quiet words (main's select). */
@Composable
private fun SettingValue(text: String) {
    Text(text, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
}

/**
 * The app's language, which Android keeps per app from API 33 (below it the app follows the system's),
 * then where the learner lives, for a learner with a profile: the fix for a language's country sits
 * right under it.
 */
@Composable
internal fun LanguageSection(
    profile: LearningProfile?,
    preferences: PreferencesViewModel,
) {
    val perAppLanguage = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
    if (!perAppLanguage && profile == null) return
    val context = LocalContext.current

    SettingsSection(stringResource(R.string.settings_preferences_language)) {
        Column {
            if (perAppLanguage) {
                ListRow(
                    headline = { Text(stringResource(R.string.settings_preferences_app_language)) },
                    trailing = { SettingValue(appLanguageName(currentLocale())) },
                    onClick = {
                        context.startActivity(
                            Intent(Settings.ACTION_APP_LOCALE_SETTINGS, "package:${context.packageName}".toUri()),
                        )
                    },
                    chevron = true,
                )
            }
            profile?.let { HomeCountryRow(it, preferences) }
        }
    }
}

/** Where the learner lives, from where they signed in until they change it: a pick saves at once. "Not set" shows only when nobody knows. */
@Composable
private fun HomeCountryRow(
    profile: LearningProfile,
    preferences: PreferencesViewModel,
) {
    var choosing by rememberSaveable { mutableStateOf(false) }
    val title = stringResource(R.string.settings_home_country)

    ListRow(
        headline = { Text(title) },
        supporting = { Text(stringResource(R.string.settings_home_country_why)) },
        trailing = { SettingValue(profile.homeCountryName ?: stringResource(R.string.settings_home_country_none)) },
        onClick = { choosing = true },
        chevron = true,
    )
    if (choosing) {
        CountrySheet(
            title = title,
            suggested = profile.suggested.choices(),
            language = shownLanguage(),
            selected = profile.homeCountry,
            onPick = { picked ->
                choosing = false
                picked?.let(preferences::setHomeCountry)
            },
            onDismiss = { choosing = false },
        )
    }
}

/** As each language names itself, with the country Zoonk writes it for where it has more than one. */
@Composable
private fun appLanguageName(locale: Locale): String =
    when (locale.language) {
        "en" -> stringResource(R.string.settings_app_language_en)
        "es" -> stringResource(R.string.settings_app_language_es)
        "pt" -> stringResource(R.string.settings_app_language_pt)
        else -> locale.getDisplayLanguage(locale).replaceFirstChar { it.titlecase(locale) }
    }
