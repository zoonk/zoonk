package com.zoonk.android.feature.settings

import android.content.Intent
import android.os.Build
import android.provider.Settings
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
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
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.ui.characters.Buddy
import com.zoonk.android.ui.characters.BuddyGlasses
import com.zoonk.android.ui.characters.BuddyKind
import com.zoonk.android.ui.characters.BuddyLook
import com.zoonk.android.ui.characters.buddyName
import com.zoonk.android.ui.characters.buddyStageName
import com.zoonk.android.ui.characters.look
import com.zoonk.android.ui.characters.worn
import com.zoonk.android.ui.components.ButtonSize
import com.zoonk.android.ui.components.DropdownMenu
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.ListDivider
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.PageHeader
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.scaffold.PageScaffold
import com.zoonk.api.models.LearningProfile
import kotlinx.coroutines.launch
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

    fun setShareUsageData(share: Boolean) = save { profile.setShareUsageData(share) }

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
 * Main's preferences: the buddy, lesson sounds, a daily limit and sharing usage data, then the app's
 * language, which Android's own per-app language setting changes. Visitors only get the language.
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
                    Modifier
                        .widthIn(max = 640.dp)
                        .fillMaxWidth()
                        .padding(vertical = 16.dp),
                verticalArrangement = Arrangement.spacedBy(28.dp),
            ) {
                PageHeader(
                    stringResource(R.string.settings_preferences),
                    stringResource(R.string.settings_preferences_description),
                    Modifier.padding(horizontal = LIST_ITEM_INSET),
                )

                when (val state = profile) {
                    is LoadState.Loaded -> {
                        val look = summary.value?.buddy?.look() ?: BuddyLook()
                        BuddySection(state.value, look, preferences)
                        LessonsSection(state.value, preferences)
                        UsageDataSection(state.value, summary.value?.analytics?.usageDataSharing, preferences)
                    }

                    is LoadState.Failed -> {
                        LoadFailedMessage(onRetry = { scope.launch { app.learningProfile.profile.refresh() } })
                    }

                    LoadState.Loading -> {
                        CircularProgressIndicator(Modifier.align(Alignment.CenterHorizontally))
                    }

                    LoadState.Idle, LoadState.Empty -> {}
                }

                LanguageSection()
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
            leading = { Buddy(look, Modifier.size(36.dp)) },
            headline = { Text(buddyName(kind, profile.buddy.name), maxLines = 1, overflow = TextOverflow.Ellipsis) },
            supporting = {
                Text(stringResource(R.string.settings_preferences_buddy_line, buddyStageName(look.stage), stringResource(glasses.worn)))
            },
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

/**
 * The learner's own choice, which shows at once when they change it; with none yet, what the summary
 * resolved for where they are, which is off where the law asks first.
 */
@Composable
internal fun UsageDataSection(
    profile: LearningProfile,
    usageDataSharing: Boolean?,
    preferences: PreferencesViewModel,
) {
    SettingsSection(stringResource(R.string.settings_your_data)) {
        SwitchRow(
            title = stringResource(R.string.settings_preferences_share_usage_data),
            description = stringResource(R.string.settings_preferences_share_usage_data_description),
            checked = profile.shareUsageData ?: (usageDataSharing == true),
            onCheckedChange = preferences::setShareUsageData,
        )
    }
}

@Composable
private fun SwitchRow(
    title: String,
    description: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
) {
    ListRow(
        headline = { Text(title) },
        supporting = { Text(description) },
        trailing = { Switch(checked = checked, onCheckedChange = null) },
        modifier = Modifier.toggleable(value = checked, role = Role.Switch, onValueChange = onCheckedChange),
    )
}

/** What a row is set to, at its end in quiet words (main's select). */
@Composable
private fun SettingValue(text: String) {
    Text(text, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
}

/** Android keeps each app's language itself from API 33; below it the app follows the system's. */
@Composable
private fun LanguageSection() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
    val context = LocalContext.current
    val locale = currentLocale()

    SettingsSection(stringResource(R.string.settings_preferences_language)) {
        ListRow(
            headline = { Text(stringResource(R.string.settings_preferences_app_language)) },
            supporting = { Text(stringResource(R.string.settings_preferences_on_this_device)) },
            trailing = { SettingValue(locale.getDisplayLanguage(locale).replaceFirstChar { it.titlecase(locale) }) },
            onClick = { context.startActivity(Intent(Settings.ACTION_APP_LOCALE_SETTINGS, "package:${context.packageName}".toUri())) },
            chevron = true,
        )
    }
}
