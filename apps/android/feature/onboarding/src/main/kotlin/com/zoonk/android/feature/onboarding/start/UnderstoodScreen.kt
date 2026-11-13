package com.zoonk.android.feature.onboarding.start

import android.text.format.DateFormat
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
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalResources
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withLink
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.app.openWebPage
import com.zoonk.android.feature.country.CountrySheet
import com.zoonk.android.feature.country.choices
import com.zoonk.android.feature.onboarding.GoalError
import com.zoonk.android.feature.onboarding.GoalLimitReason
import com.zoonk.android.feature.onboarding.setup.TargetDatePicker
import com.zoonk.android.feature.onboarding.setup.goalZone
import com.zoonk.android.feature.onboarding.setup.targetDateBounds
import com.zoonk.android.feature.plan.Variety
import com.zoonk.android.feature.plan.VarietySheet
import com.zoonk.android.feature.subscription.GateWords
import com.zoonk.android.feature.subscription.SubscribeGate
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.ButtonIcon
import com.zoonk.android.ui.components.ButtonSize
import com.zoonk.android.ui.components.MAX_GOAL_LENGTH
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.OutlinedTextField
import com.zoonk.android.ui.components.TextButton
import com.zoonk.android.ui.components.TimeOfDayDialog
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.FACT_SEPARATOR
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import com.zoonk.api.models.GoalUnderstandingOneOf
import com.zoonk.api.models.OnboardingDraftEdit
import com.zoonk.api.models.OnboardingDraftEditOneOf
import com.zoonk.api.models.OnboardingDraftEditOneOf1
import com.zoonk.api.models.OnboardingDraftEditOneOf2
import com.zoonk.api.models.OnboardingDraftEditOneOf3
import com.zoonk.api.models.OnboardingDraftEditOneOf4
import com.zoonk.api.models.OnboardingDraftEditOneOf5
import com.zoonk.api.models.UnderstoodGoal
import kotlinx.datetime.toKotlinLocalDate
import java.time.LocalDate
import java.time.LocalTime

@Composable
internal fun ColumnScope.UnderstoodScreen(
    goal: String,
    understanding: GoalUnderstandingOneOf,
    activeGoalsLeft: Long?,
    timeZone: String,
    material: List<String>,
    hasAccount: Boolean,
    isCreating: Boolean,
    error: GoalError?,
    goalLimit: GoalLimitReason?,
    onConfirm: () -> Unit,
    edits: FactEdits,
    onRewrite: (String) -> Unit,
    onCreateAccount: () -> Unit,
    onSubscribe: () -> Unit,
    onOpenPlan: () -> Unit,
) {
    val locale = currentLocale()
    val resources = LocalResources.current
    val is24Hour = DateFormat.is24HourFormat(LocalContext.current)
    val rows = remember(resources, locale, is24Hour) { UnderstoodRows(resources, locale, is24Hour) }
    var rewriting by rememberSaveable { mutableStateOf(false) }
    var clearedCountry by rememberSaveable { mutableStateOf(listOf<Int>()) }
    val firstGoalRows =
        listOfNotNull(
            rows.materialRow(material),
            rows.scheduleRow(understanding.schedule, minutesSaid(understanding.goals.firstOrNull())),
        )
    val startable = understanding.startableGoals(activeGoalsLeft)
    val locked = understanding.goals.drop(startable.size)
    val full = activeGoalsLeft == 0L
    // A full card's way on for a guest is a free account, which has room; for an account it's a pause or Plus.
    val shownError = if (full && !hasAccount) GoalError.Limit(GoalLimitReason.Guest) else error
    // The draft counts the goals the plan can still follow; the up-front read of that cap may be older.
    val plusLimit =
        GoalLimitReason.ActiveGoals.takeIf { full && hasAccount }
            ?: listOfNotNull((shownError as? GoalError.Limit)?.reason, goalLimit.takeIf { it != GoalLimitReason.ActiveGoals })
                .firstOrNull { it.isPlusLimit }

    if (rewriting) {
        RewriteWords(words = goal, disabled = isCreating, onCancel = { rewriting = false }, onRewrite = onRewrite)
    } else {
        TypedGoal(goal)
    }

    OnboardingHeading(
        stringResource(R.string.onboarding_understood_title),
        stringResource(
            if (startable.size >
                1
            ) {
                R.string.onboarding_understood_description_shared
            } else {
                R.string.onboarding_understood_description
            },
        ),
    )

    startable.forEachIndexed { index, understood ->
        Column {
            (rows.rows(understood, index in clearedCountry) + if (index == 0) firstGoalRows else emptyList()).forEachIndexed { place, row ->
                if (place > 0) HorizontalDivider()
                val key = "$index:${row.editable?.key ?: row.id}"
                FactRow(
                    row = row,
                    timeZone = timeZone,
                    languageAim = understood.languageAim.takeIf { row.id == "targetScore" },
                    variety = understood.variety().takeIf { row.editable == EditableField.TargetRegion },
                    country = understood.takeIf { row.editable == EditableField.ContentCountry },
                    editValue = editValue(understood, row),
                    editing = edits.editing == key,
                    saving = edits.saving != null,
                    failed = edits.failed == key,
                    onEdit = { edits.onEdit(if (it) key else null) },
                    onSave = { value ->
                        row.editable?.let { field ->
                            if (field == EditableField.TargetRegion && value.isEmpty()) clearedCountry = clearedCountry + index
                            edits.onRevise(key, draftEdit(field, index, value))
                        }
                    },
                )
            }
        }
    }

    if (locked.isNotEmpty()) {
        val remedy = (if (hasAccount) onSubscribe else onCreateAccount).takeIf { plusLimit == null && shownError?.needsAccount != true }
        LockedGoals(locked, rows, timeZone, waiting = startable.isNotEmpty(), hasAccount, remedy)
    }

    if (plusLimit != null) {
        GoalLimitWall(plusLimit, onSubscribe, onOpenPlan)
    } else {
        GoalFooter(shownError, onCreateAccount, onOpenPlan, onSubscribe) {
            Button(
                busy = isCreating,
                onClick = onConfirm,
                modifier = Modifier.fillMaxWidth(),
                enabled = !rewriting,
            ) {
                Text(stringResource(R.string.onboarding_looks_right))
            }
            TextButton(onClick = { rewriting = true }, enabled = !isCreating && !rewriting, modifier = Modifier.fillMaxWidth()) {
                Text(stringResource(R.string.onboarding_fix_something))
            }
        }
    }
}

/**
 * Read as the card read them, with no fixes: they start later from the goal switcher, as they are. They wait in the
 * learner's goals only when a goal on the card starts ([waiting]); otherwise the plan's limit below explains them. A
 * guest's next step is a free account, which follows more goals at once; an account's is Plus.
 */
@Composable
private fun LockedGoals(
    goals: List<UnderstoodGoal>,
    rows: UnderstoodRows,
    timeZone: String,
    waiting: Boolean,
    hasAccount: Boolean,
    onRemedy: (() -> Unit)?,
) {
    goals.forEach { goal ->
        Column {
            rows.rows(goal).forEachIndexed { place, row ->
                if (place > 0) HorizontalDivider()
                FactRow(
                    row = row.copy(editable = null, suggestedDate = null, choiceDates = emptyList()),
                    timeZone = timeZone,
                    editValue = "",
                    editing = false,
                    saving = false,
                    failed = false,
                    onEdit = {},
                    onSave = {},
                )
            }
        }
    }
    if (!waiting) return
    if (hasAccount) {
        val title = stringResource(R.string.onboarding_understood_locked_title)
        val line = pluralStringResource(R.plurals.onboarding_understood_locked_line, goals.size)
        if (onRemedy != null) SubscribeGate(title, onSubscribe = onRemedy, line = line) else GateWords(title, line)
    } else {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            GateWords(stringResource(R.string.onboarding_understood_free_account_title), line = null)
            onRemedy?.let { createAccount ->
                OutlinedButton(
                    onClick = createAccount,
                    size = ButtonSize.Small,
                ) { Text(stringResource(R.string.onboarding_create_account)) }
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
            label = stringResource(R.string.onboarding_what_you_wrote),
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

/** The fixes in flight live in the screen's ViewModel, so a rotation never drops a save. */
internal class FactEdits(
    val editing: String?,
    val saving: String?,
    val failed: String?,
    val onEdit: (String?) -> Unit,
    val onRevise: (String, OnboardingDraftEdit) -> Unit,
)

@Composable
private fun FactRow(
    row: UnderstoodRow,
    languageAim: com.zoonk.api.models.LanguageAim? = null,
    variety: Variety? = null,
    country: UnderstoodGoal? = null,
    timeZone: String,
    editValue: String,
    editing: Boolean,
    saving: Boolean,
    failed: Boolean,
    onEdit: (Boolean) -> Unit,
    onSave: (String) -> Unit,
) {
    val save: (String) -> Unit = { value -> if (!saving) onSave(value) }
    val label = if (editing) row.editLabel ?: row.label else row.label
    val editor = row.editable?.kind.takeIf { languageAim == null }
    val today = LocalDate.now(goalZone(timeZone))
    val offered = targetDateBounds(today)

    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp), verticalAlignment = Alignment.Top) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            if (!editing) {
                Column(Modifier.semantics(mergeDescendants = true) {}, verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
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
                }
            } else {
                Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
            }

            if (editing && editor == EditorKind.Text) {
                TextEditor(label, editValue, saving, onCancel = { onEdit(false) }, onSave = save)
            } else {
                RowNote(row)
                row.suggestedDate?.takeIf { it in offered }?.let { date ->
                    OutlinedButton(onClick = { save(date.toString()) }, enabled = !saving, modifier = Modifier.padding(top = 6.dp)) {
                        Text(stringResource(R.string.onboarding_use_this_date))
                    }
                }
                val choiceDates = row.choiceDates.filter { it in offered }
                if (choiceDates.isNotEmpty()) {
                    FlowRow(modifier = Modifier.padding(top = 6.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        choiceDates.forEach { date ->
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
        TargetDatePicker(
            today = today,
            initial = runCatching { LocalDate.parse(editValue) }.getOrNull(),
            onDismiss = { onEdit(false) },
            onPick = { save(it.toString()) },
        )
    }
    if (editing && languageAim != null) {
        com.zoonk.android.feature.plan.LanguageAimSheet(
            languageAim.aim?.value,
            languageAim.choices,
            onDismiss = { onEdit(false) },
            onPick = save,
            pending = saving,
            failed = failed,
        )
    }
    if (editing && editor == EditorKind.Time) {
        TimeEditor(initial = editValue, onDismiss = { onEdit(false) }, onPick = save)
    }
    if (editing && country != null) {
        CountrySheet(
            title = stringResource(R.string.onboarding_variety_title),
            suggested = country.suggested.choices(),
            language = country.draft.language,
            selected = country.contentCountry?.code,
            onPick = { it?.let { picked -> save(picked.code) } },
            onDismiss = { onEdit(false) },
            pending = saving,
            failed = failed,
        )
    }
    if (editing && variety != null) {
        VarietySheet(variety, onDismiss = { onEdit(false) }, onPick = { save(it.orEmpty()) }, pending = saving, failed = failed)
    }
}

private fun UnderstoodGoal.variety() =
    draft.targetLanguage
        ?.takeIf {
            regionChoices.isNotEmpty()
        }?.let { Variety(it, draft.targetRegion, regionChoices) }

@Composable
private fun RowNote(row: UnderstoodRow) {
    val context = LocalContext.current
    if (row.note == null && row.source == null) return
    val muted = MaterialTheme.colorScheme.onSurfaceVariant
    val sourceText = row.source?.let { stringResource(R.string.onboarding_source, sourceName(it)) }

    val text =
        buildAnnotatedString {
            row.note?.let(::append)
            if (row.note != null && row.source != null) append(FACT_SEPARATOR)
            val source = row.source
            if (source != null && sourceText != null) {
                withLink(
                    LinkAnnotation.Clickable(
                        tag = source.url,
                        styles = TextLinkStyles(SpanStyle(color = muted, textDecoration = TextDecoration.Underline)),
                        linkInteractionListener = { openWebPage(context, source.url) },
                    ),
                ) { append("$sourceText ↗") }
            }
        }
    Text(text, color = muted, style = MaterialTheme.typography.bodySmall)
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
            label = label,
            singleLine = true,
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
            keyboardActions = KeyboardActions(onDone = { submit() }),
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(busy = saving, onClick = { submit() }) {
                Text(stringResource(R.string.onboarding_save))
            }
            TextButton(onClick = onCancel, enabled = !saving) { Text(stringResource(R.string.onboarding_cancel)) }
        }
    }
    LaunchedEffect(Unit) { focus.requestFocus() }
}

@Composable
private fun TimeEditor(
    initial: String,
    onDismiss: () -> Unit,
    onPick: (String) -> Unit,
) {
    TimeOfDayDialog(
        initial = runCatching { LocalTime.parse(initial) }.getOrNull() ?: LocalTime.of(DEFAULT_STUDY_HOUR, 0),
        title = stringResource(R.string.onboarding_row_when_you_study),
        confirmLabel = stringResource(R.string.onboarding_save),
        dismissLabel = stringResource(R.string.onboarding_cancel),
        onPick = { onPick(it.toString()) },
        onDismiss = onDismiss,
    )
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
        null, EditableField.StudyTime, EditableField.TargetRegion, EditableField.ContentCountry -> {
            row.editDefault ?: row.value
        }

        EditableField.DisplayName -> {
            goal.draft.displayName.orEmpty()
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
            OnboardingDraftEdit.OnboardingDraftEditOneOf5Value(OnboardingDraftEditOneOf5(OnboardingDraftEditOneOf5.Field.STUDY_TIME, value))
        }

        EditableField.ContentCountry -> {
            OnboardingDraftEdit.OnboardingDraftEditOneOfValue(
                OnboardingDraftEditOneOf(OnboardingDraftEditOneOf.Field.CONTENT_COUNTRY, goal.toLong(), value),
            )
        }

        EditableField.TargetRegion -> {
            OnboardingDraftEdit.OnboardingDraftEditOneOf4Value(
                OnboardingDraftEditOneOf4(OnboardingDraftEditOneOf4.Field.TARGET_REGION, goal.toLong(), value.ifEmpty { null }),
            )
        }

        EditableField.DisplayName -> {
            OnboardingDraftEdit.OnboardingDraftEditOneOf1Value(
                OnboardingDraftEditOneOf1(OnboardingDraftEditOneOf1.Field.DISPLAY_NAME, goal.toLong(), value),
            )
        }

        EditableField.TargetDate -> {
            OnboardingDraftEdit.OnboardingDraftEditOneOf2Value(
                OnboardingDraftEditOneOf2(
                    OnboardingDraftEditOneOf2.Field.TARGET_DATE,
                    goal.toLong(),
                    LocalDate.parse(value).toKotlinLocalDate(),
                ),
            )
        }

        else -> {
            OnboardingDraftEdit.OnboardingDraftEditOneOf3Value(
                OnboardingDraftEditOneOf3(OnboardingDraftEditOneOf3.Field.entries.first { it.value == field.key }, goal.toLong(), value),
            )
        }
    }

private const val MAX_SOURCE_TITLE_LENGTH = 40
private const val DEFAULT_STUDY_HOUR = 19
