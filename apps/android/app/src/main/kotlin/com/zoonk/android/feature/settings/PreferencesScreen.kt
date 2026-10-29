package com.zoonk.android.feature.settings

import android.content.Intent
import android.os.Build
import android.provider.Settings
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
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
import com.zoonk.android.ui.characters.BuddyGlassesPicker
import com.zoonk.android.ui.characters.BuddyKind
import com.zoonk.android.ui.characters.BuddyLook
import com.zoonk.android.ui.characters.BuddyPicker
import com.zoonk.android.ui.characters.BuddyStage
import com.zoonk.android.ui.characters.buddyName
import com.zoonk.android.ui.characters.look
import com.zoonk.android.ui.characters.worn
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.SectionHeader
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

    fun setDailyLimit(minutes: Long?) = save { profile.setDailyLimit(minutes) }

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
 * Main's preferences: the buddy, lesson sounds and a daily limit, then the app's language, which
 * Android's own per-app language setting changes. Visitors only get the language.
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
                        .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(24.dp),
            ) {
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

    Section(stringResource(R.string.settings_preferences_buddy)) {
        OutlinedCard(Modifier.fillMaxWidth()) {
            ListItem(
                leadingContent = { Buddy(look, Modifier.size(40.dp)) },
                headlineContent = { Text(buddyName(kind, profile.buddy.name)) },
                supportingContent = {
                    Text(stringResource(R.string.settings_preferences_buddy_line, stageName(look.stage), stringResource(glasses.worn)))
                },
            )
            OutlinedButton(
                onClick = { preferences.editBuddy(true) },
                modifier = Modifier.padding(start = 16.dp, end = 16.dp, bottom = 16.dp),
            ) {
                Text(stringResource(editLabel))
            }
        }
    }

    if (preferences.isEditingBuddy) {
        BuddyEditor(
            profile = profile,
            look = look,
            isSaving = preferences.isSavingBuddy,
            saveFailed = preferences.buddySaveFailed,
            onClose = { preferences.editBuddy(false) },
            onSave = preferences::setBuddy,
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun BuddyEditor(
    profile: LearningProfile,
    look: BuddyLook,
    isSaving: Boolean,
    saveFailed: Boolean,
    onClose: () -> Unit,
    onSave: (BuddyKind, BuddyGlasses, String) -> Unit,
) {
    var kind by rememberSaveable { mutableStateOf(look.kind) }
    var glasses by rememberSaveable { mutableStateOf(look.glasses) }
    var name by rememberSaveable { mutableStateOf(profile.buddy.name.orEmpty()) }
    val earned = profile.availableGlasses.map { BuddyGlasses.of(it.value) }.toSet() + BuddyGlasses.Round

    ModalBottomSheet(onDismissRequest = onClose, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Column(Modifier.navigationBarsPadding().imePadding()) {
            Column(
                modifier =
                    Modifier
                        .weight(1f, fill = false)
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 24.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Text(stringResource(R.string.settings_preferences_buddy), style = MaterialTheme.typography.titleLarge)
                BuddyPicker(
                    kind = kind,
                    name = name,
                    onSelect = { kind = it },
                    onNameChange = { name = it },
                    glasses = glasses,
                    look = look,
                )
                Text(stringResource(R.string.buddy_glasses), style = MaterialTheme.typography.titleMedium)
                BuddyGlassesPicker(look = look.copy(kind = kind), earned = earned, selected = glasses, onSelect = { glasses = it })
            }
            HorizontalDivider()
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (saveFailed) {
                    Text(
                        text = stringResource(R.string.settings_preferences_save_failed),
                        modifier = Modifier.weight(1f).semantics { liveRegion = LiveRegionMode.Polite },
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                } else {
                    Spacer(Modifier.weight(1f))
                }
                TextButton(onClick = onClose) { Text(stringResource(R.string.settings_cancel)) }
                Button(onClick = { onSave(kind, glasses, name) }, enabled = !isSaving) { Text(stringResource(R.string.settings_save)) }
            }
        }
    }
}

@Composable
private fun LessonsSection(
    profile: LearningProfile,
    preferences: PreferencesViewModel,
) {
    var isChoosingLimit by rememberSaveable { mutableStateOf(false) }
    val locale = currentLocale()

    @Composable
    fun limitLabel(minutes: Long?) =
        minutes?.let { stringResource(R.string.settings_preferences_limit_a_day, formatMinutes(it.toInt(), locale)) }
            ?: stringResource(R.string.settings_preferences_no_limit)

    Section(stringResource(R.string.settings_preferences_lessons)) {
        OutlinedCard(Modifier.fillMaxWidth()) {
            ListItem(
                headlineContent = { Text(stringResource(R.string.settings_preferences_sounds)) },
                supportingContent = { Text(stringResource(R.string.settings_preferences_sounds_description)) },
                trailingContent = { Switch(checked = profile.soundsEnabled, onCheckedChange = null) },
                modifier =
                    Modifier.toggleable(
                        value = profile.soundsEnabled,
                        role = Role.Switch,
                        onValueChange = preferences::setSoundsEnabled,
                    ),
            )
            HorizontalDivider()
            Box {
                ListItem(
                    headlineContent = { Text(stringResource(R.string.settings_preferences_daily_limit)) },
                    supportingContent = { Text(stringResource(R.string.settings_preferences_daily_limit_description)) },
                    trailingContent = { Text(limitLabel(profile.dailyLimitMinutes)) },
                    modifier = Modifier.clickable(role = Role.DropdownList) { isChoosingLimit = true },
                )
                DropdownMenu(
                    expanded = isChoosingLimit,
                    onDismissRequest = { isChoosingLimit = false },
                    modifier = Modifier.align(Alignment.TopEnd),
                ) {
                    (listOf<Long?>(null) + DAILY_LIMIT_CHOICES).forEach { minutes ->
                        val isCurrent = minutes == profile.dailyLimitMinutes
                        DropdownMenuItem(
                            text = { Text(limitLabel(minutes)) },
                            trailingIcon =
                                if (isCurrent) {
                                    (
                                        {
                                            Icon(
                                                painterResource(R.drawable.ic_check),
                                                contentDescription = null,
                                            )
                                        }
                                    )
                                } else {
                                    null
                                },
                            modifier = Modifier.semantics { selected = isCurrent },
                            onClick = {
                                isChoosingLimit = false
                                if (minutes != profile.dailyLimitMinutes) preferences.setDailyLimit(minutes)
                            },
                        )
                    }
                }
            }
        }
    }
}

/** Android keeps each app's language itself from API 33; below it the app follows the system's. */
@Composable
private fun LanguageSection() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
    val context = LocalContext.current
    val locale = currentLocale()

    Section(stringResource(R.string.settings_preferences_language)) {
        OutlinedCard(Modifier.fillMaxWidth()) {
            ListItem(
                headlineContent = { Text(stringResource(R.string.settings_preferences_app_language)) },
                supportingContent = { Text(stringResource(R.string.settings_preferences_on_this_device)) },
                trailingContent = { Text(locale.getDisplayLanguage(locale).replaceFirstChar { it.titlecase(locale) }) },
                modifier =
                    Modifier.clickable(role = Role.Button) {
                        context.startActivity(Intent(Settings.ACTION_APP_LOCALE_SETTINGS, "package:${context.packageName}".toUri()))
                    },
            )
        }
    }
}

@Composable
private fun stageName(stage: BuddyStage): String =
    stringResource(
        when (stage) {
            BuddyStage.Baby -> R.string.buddy_stage_baby
            BuddyStage.Young -> R.string.buddy_stage_young
            BuddyStage.Adult -> R.string.buddy_stage_adult
        },
    )

@Composable
private fun Section(
    title: String,
    content: @Composable () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionHeader(title)
        content()
    }
}

/** Core's `DAILY_LIMIT_CHOICES`. */
private val DAILY_LIMIT_CHOICES = listOf<Long?>(15, 30, 45, 60, 90, 120, 180)
