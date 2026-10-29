package com.zoonk.android.feature.onboarding.start

import android.text.format.DateFormat
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SelectableDates
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimePicker
import androidx.compose.material3.TimePickerDialog
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberTimePickerState
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
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalResources
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.net.toUri
import com.zoonk.android.R
import com.zoonk.android.feature.onboarding.GoalError
import com.zoonk.android.feature.onboarding.GoalLimitReason
import com.zoonk.android.ui.components.MAX_GOAL_LENGTH
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import com.zoonk.api.models.GoalUnderstandingOneOf
import com.zoonk.api.models.OnboardingDraftEdit
import com.zoonk.api.models.OnboardingDraftEditOneOf
import com.zoonk.api.models.OnboardingDraftEditOneOf1
import com.zoonk.api.models.OnboardingDraftEditOneOf2
import com.zoonk.api.models.OnboardingDraftEditOneOf3
import com.zoonk.api.models.UnderstoodGoal
import kotlinx.coroutines.launch
import kotlinx.datetime.toKotlinLocalDate
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneOffset

@Composable
internal fun ColumnScope.UnderstoodScreen(
    goal: String,
    understanding: GoalUnderstandingOneOf,
    material: List<String>,
    isCreating: Boolean,
    error: GoalError?,
    goalLimit: GoalLimitReason?,
    onConfirm: () -> Unit,
    onRevise: suspend (OnboardingDraftEdit) -> Boolean,
    onRewrite: (String) -> Unit,
    onCreateAccount: () -> Unit,
    onSeePlus: () -> Unit,
    onOpenPlan: () -> Unit,
) {
    val locale = currentLocale()
    val resources = LocalResources.current
    val is24Hour = DateFormat.is24HourFormat(LocalContext.current)
    val rows = remember(resources, locale, is24Hour) { UnderstoodRows(resources, locale, is24Hour) }
    var rewriting by rememberSaveable { mutableStateOf(false) }
    var editing by rememberSaveable { mutableStateOf<String?>(null) }
    val firstGoalRows =
        listOfNotNull(
            rows.materialRow(material),
            rows.scheduleRow(understanding.schedule, minutesSaid(understanding.goals.firstOrNull())),
        )
    val plusLimit = listOfNotNull((error as? GoalError.Limit)?.reason, goalLimit).firstOrNull { it.isPlusLimit }

    if (rewriting) {
        RewriteWords(words = goal, disabled = isCreating, onCancel = { rewriting = false }, onRewrite = onRewrite)
    } else {
        TypedGoal(goal)
    }

    OnboardingHeading(
        stringResource(R.string.onboarding_understood_title),
        stringResource(
            if (understanding.goals.size >
                1
            ) {
                R.string.onboarding_understood_description_shared
            } else {
                R.string.onboarding_understood_description
            },
        ),
    )

    understanding.goals.forEachIndexed { index, understood ->
        Column {
            (rows.rows(understood) + if (index == 0) firstGoalRows else emptyList()).forEachIndexed { place, row ->
                if (place > 0) HorizontalDivider()
                val key = "$index:${row.editable?.key ?: row.id}"
                FactRow(
                    row = row,
                    editValue = editValue(understood, row),
                    editing = editing == key,
                    onEdit = { editing = if (it) key else null },
                    onSave = { value -> row.editable?.let { field -> onRevise(draftEdit(field, index, value)) } ?: false },
                )
            }
        }
    }

    if (plusLimit != null) {
        GoalLimitWall(plusLimit, onSeePlus, onOpenPlan)
    } else {
        GoalFooter(error, onCreateAccount, onOpenPlan) {
            Button(onClick = onConfirm, enabled = !isCreating && !rewriting, modifier = Modifier.fillMaxWidth()) {
                Text(stringResource(if (isCreating) R.string.onboarding_saving_goal else R.string.onboarding_looks_right))
            }
            TextButton(onClick = { rewriting = true }, enabled = !isCreating && !rewriting, modifier = Modifier.fillMaxWidth()) {
                Text(stringResource(R.string.onboarding_fix_something))
            }
        }
    }
}

@Composable
private fun RewriteWords(
    words: String,
    disabled: Boolean,
    onCancel: () -> Unit,
    onRewrite: (String) -> Unit,
) {
    var value by rememberSaveable { mutableStateOf(words) }
    val focus = remember { FocusRequester() }
    val submit = { value.trim().takeIf { it.isNotEmpty() && !disabled }?.let(onRewrite) }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedTextField(
            value = value,
            onValueChange = { value = it.take(MAX_GOAL_LENGTH) },
            modifier = Modifier.fillMaxWidth().focusRequester(focus),
            label = { Text(stringResource(R.string.onboarding_what_you_wrote)) },
            supportingText = { Text(stringResource(R.string.onboarding_rewrite_hint)) },
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Go),
            keyboardActions = KeyboardActions(onGo = { submit() }),
            minLines = 2,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(
                onClick = { submit() },
                enabled = value.isNotBlank() && !disabled,
            ) { Text(stringResource(R.string.onboarding_read_again)) }
            TextButton(onClick = onCancel) { Text(stringResource(R.string.onboarding_cancel)) }
        }
    }
    LaunchedEffect(Unit) { focus.requestFocus() }
}

@Composable
private fun FactRow(
    row: UnderstoodRow,
    editValue: String,
    editing: Boolean,
    onEdit: (Boolean) -> Unit,
    onSave: suspend (String) -> Boolean,
) {
    val scope = rememberCoroutineScope()
    var saving by remember { mutableStateOf(false) }
    var failed by remember { mutableStateOf(false) }
    val save: (String) -> Unit = { value ->
        if (!saving) {
            saving = true
            failed = false
            scope.launch {
                val saved = onSave(value)
                saving = false
                failed = !saved
                if (saved) onEdit(false)
            }
        }
    }
    val label = if (editing) row.editLabel ?: row.label else row.label
    val editor = row.editable?.kind

    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp), verticalAlignment = Alignment.Top) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)

            if (editing && editor == EditorKind.Text) {
                TextEditor(label, editValue, saving, onCancel = { onEdit(false) }, onSave = save)
            } else {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), itemVerticalAlignment = Alignment.Bottom) {
                    Text(row.value, fontWeight = FontWeight.Medium, style = MaterialTheme.typography.bodyLarge)
                    row.badge?.let {
                        Text(
                            it,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            style = MaterialTheme.typography.labelSmall,
                        )
                    }
                }
                RowNote(row)
                row.suggestedDate?.let { date ->
                    OutlinedButton(onClick = { save(date.toString()) }, enabled = !saving, modifier = Modifier.padding(top = 6.dp)) {
                        Text(stringResource(R.string.onboarding_use_this_date))
                    }
                }
                if (row.choiceDates.isNotEmpty()) {
                    FlowRow(modifier = Modifier.padding(top = 6.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        row.choiceDates.forEach { date ->
                            OutlinedButton(onClick = { save(date.toString()) }, enabled = !saving) {
                                Text(formatDate(date, currentLocale(), DateStyle.Short))
                            }
                        }
                    }
                }
            }

            if (failed) {
                Text(
                    stringResource(R.string.onboarding_save_failed),
                    modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        }

        if (row.editable != null && !(editing && editor == EditorKind.Text)) {
            IconButton(onClick = { onEdit(true) }) {
                Icon(
                    painterResource(R.drawable.ic_edit),
                    contentDescription = stringResource(R.string.onboarding_edit_fact, row.label),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }

    if (editing && editor == EditorKind.Date) {
        DateEditor(initial = editValue, onDismiss = { onEdit(false) }, onPick = save)
    }
    if (editing && editor == EditorKind.Time) {
        TimeEditor(initial = editValue, onDismiss = { onEdit(false) }, onPick = save)
    }
}

@Composable
private fun RowNote(row: UnderstoodRow) {
    val context = LocalContext.current
    if (row.note == null && row.source == null) return

    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), itemVerticalAlignment = Alignment.CenterVertically) {
        row.note?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall) }
        row.source?.let { source ->
            TextButton(onClick = { CustomTabsIntent.Builder().build().launchUrl(context, source.url.toUri()) }) {
                Text(
                    stringResource(R.string.onboarding_source, sourceName(source)),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    style = MaterialTheme.typography.bodySmall,
                )
                Icon(
                    painterResource(R.drawable.ic_open_in_new),
                    contentDescription = null,
                    modifier = Modifier.padding(start = 4.dp).size(14.dp),
                )
            }
        }
    }
}

@Composable
private fun TextEditor(
    label: String,
    initial: String,
    saving: Boolean,
    onCancel: () -> Unit,
    onSave: (String) -> Unit,
) {
    var value by rememberSaveable { mutableStateOf(initial) }
    val focus = remember { FocusRequester() }
    val submit = { value.trim().takeIf { it.isNotEmpty() }?.let(onSave) }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedTextField(
            value = value,
            onValueChange = { value = it },
            modifier = Modifier.fillMaxWidth().focusRequester(focus),
            label = { Text(label) },
            singleLine = true,
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
            keyboardActions = KeyboardActions(onDone = { submit() }),
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = { submit() }, enabled = !saving) {
                Text(stringResource(if (saving) R.string.onboarding_saving else R.string.onboarding_save))
            }
            TextButton(onClick = onCancel, enabled = !saving) { Text(stringResource(R.string.onboarding_cancel)) }
        }
    }
    LaunchedEffect(Unit) { focus.requestFocus() }
}

/** From today on, as core refuses an earlier date. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DateEditor(
    initial: String,
    onDismiss: () -> Unit,
    onPick: (String) -> Unit,
) {
    val today = LocalDate.now()
    val start = runCatching { LocalDate.parse(initial) }.getOrNull()?.takeIf { it >= today }
    val state =
        rememberDatePickerState(
            initialSelectedDateMillis = start?.atStartOfDay(ZoneOffset.UTC)?.toInstant()?.toEpochMilli(),
            yearRange = today.year..today.year + MAX_YEARS_AHEAD,
            selectableDates =
                object : SelectableDates {
                    override fun isSelectableDate(utcTimeMillis: Long) =
                        !Instant
                            .ofEpochMilli(utcTimeMillis)
                            .atZone(ZoneOffset.UTC)
                            .toLocalDate()
                            .isBefore(today)
                },
        )
    DatePickerDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(
                onClick = {
                    state.selectedDateMillis?.let {
                        onPick(
                            Instant
                                .ofEpochMilli(it)
                                .atZone(ZoneOffset.UTC)
                                .toLocalDate()
                                .toString(),
                        )
                    }
                    onDismiss()
                },
                enabled = state.selectedDateMillis != null,
            ) { Text(stringResource(R.string.onboarding_save)) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.onboarding_cancel)) } },
    ) { DatePicker(state) }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TimeEditor(
    initial: String,
    onDismiss: () -> Unit,
    onPick: (String) -> Unit,
) {
    val start = runCatching { LocalTime.parse(initial) }.getOrNull() ?: LocalTime.of(DEFAULT_STUDY_HOUR, 0)
    val state = rememberTimePickerState(start.hour, start.minute, DateFormat.is24HourFormat(LocalContext.current))
    TimePickerDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(
                onClick = {
                    onPick("%02d:%02d".format(state.hour, state.minute))
                    onDismiss()
                },
            ) { Text(stringResource(R.string.onboarding_save)) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.onboarding_cancel)) } },
        title = { Text(stringResource(R.string.onboarding_row_when_you_study)) },
    ) { TimePicker(state) }
}

private fun sourceName(source: RowSource): String {
    val title = source.title?.trim()?.takeIf { it.isNotEmpty() && it.length <= MAX_SOURCE_TITLE_LENGTH }
    return title ?: runCatching {
        java.net
            .URI(source.url)
            .host
            ?.removePrefix("www.")
    }.getOrNull() ?: source.url
}

private fun editValue(
    goal: UnderstoodGoal,
    row: UnderstoodRow,
): String =
    when (row.editable) {
        null, EditableField.StudyTime -> {
            row.editDefault ?: row.value
        }

        EditableField.Title -> {
            goal.draft.title
        }

        EditableField.TargetDate -> {
            goal.draft.targetDate?.toString() ?: row.editDefault.orEmpty()
        }

        else -> {
            goal.draft.details
                .text(row.editable.key)
                .orEmpty()
        }
    }

private fun draftEdit(
    field: EditableField,
    goal: Int,
    value: String,
): OnboardingDraftEdit =
    when (field) {
        EditableField.StudyTime -> {
            OnboardingDraftEdit.OnboardingDraftEditOneOf3Value(OnboardingDraftEditOneOf3(OnboardingDraftEditOneOf3.Field.STUDY_TIME, value))
        }

        EditableField.Title -> {
            OnboardingDraftEdit.OnboardingDraftEditOneOfValue(
                OnboardingDraftEditOneOf(OnboardingDraftEditOneOf.Field.TITLE, goal.toLong(), value),
            )
        }

        EditableField.TargetDate -> {
            OnboardingDraftEdit.OnboardingDraftEditOneOf1Value(
                OnboardingDraftEditOneOf1(
                    OnboardingDraftEditOneOf1.Field.TARGET_DATE,
                    goal.toLong(),
                    LocalDate.parse(value).toKotlinLocalDate(),
                ),
            )
        }

        else -> {
            OnboardingDraftEdit.OnboardingDraftEditOneOf2Value(
                OnboardingDraftEditOneOf2(OnboardingDraftEditOneOf2.Field.entries.first { it.value == field.key }, goal.toLong(), value),
            )
        }
    }

private const val MAX_SOURCE_TITLE_LENGTH = 40
private const val MAX_YEARS_AHEAD = 10
private const val DEFAULT_STUDY_HOUR = 19
