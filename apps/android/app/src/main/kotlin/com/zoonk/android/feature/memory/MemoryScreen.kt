package com.zoonk.android.feature.memory

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.MenuDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
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
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.collectShown
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.scaffold.PageScaffold
import com.zoonk.api.models.Memory
import com.zoonk.api.models.MemoryCategory
import com.zoonk.api.models.MemoryFact
import com.zoonk.api.models.MemorySource
import kotlinx.coroutines.launch
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/** Main's memory page: the switch, what Zoonk remembers by label, and the download. */
@Composable
fun MemoryScreen(
    app: AppContainer,
    navigator: AppNavigator,
) {
    val memory by app.memory.memory.collectShown()
    val screen = viewModel { MemoryViewModel(app.memory) }
    val scope = rememberCoroutineScope()

    PageScaffold(onBack = { navigator.back() }, title = { Text(stringResource(R.string.settings_memory)) }) { padding ->
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
                Text(
                    text = stringResource(R.string.memory_description),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )

                when (val state = memory) {
                    is LoadState.Loaded -> {
                        Loaded(state.value, screen)
                    }

                    is LoadState.Failed -> {
                        LoadFailedMessage(onRetry = { scope.launch { app.memory.memory.refresh() } })
                    }

                    LoadState.Idle, LoadState.Loading, LoadState.Empty -> {
                        CircularProgressIndicator(Modifier.align(Alignment.CenterHorizontally))
                    }
                }
            }
        }
    }
}

@Composable
private fun Loaded(
    memory: Memory,
    screen: MemoryViewModel,
) {
    val context = LocalContext.current
    val export =
        rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri ->
            if (uri != null) screen.export { context.contentResolver.openOutputStream(uri) }
        }
    val groups = MemoryCategory.entries.map { category -> category to memory.facts.filter { it.category == category } }.filter { it.second.isNotEmpty() }

    OutlinedCard(Modifier.fillMaxWidth()) {
        ListItem(
            headlineContent = { Text(stringResource(R.string.memory_use)) },
            supportingContent = {
                Text(stringResource(if (memory.enabled) R.string.memory_use_on else R.string.memory_use_off))
            },
            trailingContent = { Switch(checked = memory.enabled, onCheckedChange = null) },
            modifier = Modifier.toggleable(value = memory.enabled, role = Role.Switch, onValueChange = screen::setEnabled),
        )
    }

    screen.lastChange?.let { change -> MemoryUpdated(listOf(change), onUndo = screen::undo) }

    if (screen.saveFailed) {
        Text(
            text = stringResource(R.string.memory_save_failed),
            modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
            color = MaterialTheme.colorScheme.error,
            style = MaterialTheme.typography.bodyMedium,
        )
    }

    if (groups.isEmpty()) {
        Text(
            text = stringResource(if (memory.enabled) R.string.memory_empty_on else R.string.memory_empty_off),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
    } else {
        groups.forEach { (category, facts) ->
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                SectionHeader(categoryName(category))
                OutlinedCard(Modifier.fillMaxWidth()) {
                    facts.forEachIndexed { index, fact ->
                        if (index > 0) HorizontalDivider()
                        FactRow(fact, onEdit = { screen.updateFact(fact.id, it) }, onDelete = { screen.deleteFact(fact.id) })
                    }
                }
            }
        }
    }

    OutlinedCard(Modifier.fillMaxWidth()) {
        ListItem(
            headlineContent = { Text(stringResource(R.string.memory_download)) },
            supportingContent = { Text(stringResource(R.string.memory_download_description)) },
        )
        OutlinedButton(
            onClick = { export.launch(EXPORT_FILE_NAME) },
            enabled = !screen.isExporting,
            modifier =
                Modifier
                    .align(Alignment.End)
                    .padding(start = 16.dp, end = 16.dp, bottom = 16.dp),
            contentPadding = ButtonDefaults.ButtonWithIconContentPadding,
        ) {
            if (screen.isExporting) {
                CircularProgressIndicator(Modifier.size(ButtonDefaults.IconSize), color = LocalContentColor.current, strokeWidth = 2.dp)
            } else {
                Icon(painterResource(R.drawable.ic_download), contentDescription = null, modifier = Modifier.size(ButtonDefaults.IconSize))
            }
            Spacer(Modifier.size(ButtonDefaults.IconSpacing))
            Text(stringResource(if (screen.isExporting) R.string.settings_download_preparing else R.string.settings_download))
        }
    }
    if (screen.exportFailed) {
        Text(
            text = stringResource(R.string.settings_download_failed),
            modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
            color = MaterialTheme.colorScheme.error,
            style = MaterialTheme.typography.bodyMedium,
        )
    }

    Text(
        text = stringResource(R.string.memory_sensitive_note),
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        style = MaterialTheme.typography.bodySmall,
    )
}

@Composable
private fun FactRow(
    fact: MemoryFact,
    onEdit: (String) -> Unit,
    onDelete: () -> Unit,
) {
    var isMenuOpen by rememberSaveable { mutableStateOf(false) }
    var isEditing by rememberSaveable { mutableStateOf(false) }

    ListItem(
        headlineContent = { Text(fact.statement) },
        supportingContent = { Text(stringResource(R.string.memory_fact_source, sourceName(fact), factDate(fact))) },
        trailingContent = {
            Box {
                IconButton(onClick = { isMenuOpen = true }) {
                    Icon(painterResource(R.drawable.ic_more_vert), contentDescription = stringResource(R.string.memory_fact_options, fact.statement))
                }
                DropdownMenu(expanded = isMenuOpen, onDismissRequest = { isMenuOpen = false }) {
                    DropdownMenuItem(
                        text = { Text(stringResource(R.string.memory_edit)) },
                        leadingIcon = { Icon(painterResource(R.drawable.ic_edit), contentDescription = null) },
                        onClick = {
                            isMenuOpen = false
                            isEditing = true
                        },
                    )
                    DropdownMenuItem(
                        text = { Text(stringResource(R.string.memory_delete)) },
                        leadingIcon = { Icon(painterResource(R.drawable.ic_delete), contentDescription = null) },
                        colors =
                            MenuDefaults.itemColors(
                                textColor = MaterialTheme.colorScheme.error,
                                leadingIconColor = MaterialTheme.colorScheme.error,
                            ),
                        onClick = {
                            isMenuOpen = false
                            onDelete()
                        },
                    )
                }
            }
        },
    )

    if (isEditing) {
        EditFactDialog(
            fact = fact,
            onClose = { isEditing = false },
            onSave = {
                isEditing = false
                onEdit(it)
            },
        )
    }
}

@Composable
private fun EditFactDialog(
    fact: MemoryFact,
    onClose: () -> Unit,
    onSave: (String) -> Unit,
) {
    var statement by rememberSaveable { mutableStateOf(fact.statement) }
    val trimmed = statement.trim()

    AlertDialog(
        onDismissRequest = onClose,
        title = { Text(stringResource(R.string.memory_edit_title)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(stringResource(R.string.memory_edit_description))
                OutlinedTextField(
                    value = statement,
                    onValueChange = { statement = it.take(MAX_STATEMENT_LENGTH) },
                    label = { Text(stringResource(R.string.memory_edit_label)) },
                )
            }
        },
        confirmButton = {
            TextButton(onClick = { onSave(trimmed) }, enabled = trimmed.isNotEmpty() && trimmed != fact.statement) {
                Text(stringResource(R.string.settings_save))
            }
        },
        dismissButton = { TextButton(onClick = onClose) { Text(stringResource(R.string.settings_cancel)) } },
    )
}

@Composable
private fun categoryName(category: MemoryCategory): String =
    stringResource(
        when (category) {
            MemoryCategory.GOALS -> R.string.memory_category_goals
            MemoryCategory.BACKGROUND -> R.string.memory_category_background
            MemoryCategory.ROUTINE -> R.string.memory_category_routine
            MemoryCategory.PREFERENCES -> R.string.memory_category_preferences
            MemoryCategory.LEARNING -> R.string.memory_category_learning
            MemoryCategory.CONTEXT -> R.string.memory_category_context
        },
    )

@Composable
private fun sourceName(fact: MemoryFact): String =
    stringResource(
        when {
            fact.origin == MemoryFact.Origin.NOTICED -> R.string.memory_source_noticed
            fact.source == null -> R.string.memory_source_you
            fact.source?.kind == MemorySource.Kind.CHAT -> R.string.memory_source_chat
            fact.source?.kind == MemorySource.Kind.ONBOARDING -> R.string.memory_source_onboarding
            else -> R.string.memory_source_session
        },
    )

@Composable
private fun factDate(fact: MemoryFact): String =
    DateTimeFormatter
        .ofPattern(android.text.format.DateFormat.getBestDateTimePattern(currentLocale(), "MMMd"), currentLocale())
        .format(java.time.Instant.ofEpochMilli(fact.createdAt.toEpochMilliseconds()).atZone(ZoneId.systemDefault()))

/** Core's `MAX_MEMORY_STATEMENT_LENGTH`. */
private const val MAX_STATEMENT_LENGTH = 160
private const val EXPORT_FILE_NAME = "zoonk-memory.json"
