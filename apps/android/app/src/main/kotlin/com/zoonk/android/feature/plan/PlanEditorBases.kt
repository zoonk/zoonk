package com.zoonk.android.feature.plan

import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuAnchorType
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.components.DisclosureRow
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.LabelChip
import com.zoonk.android.ui.components.bleed
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.format.formatPercent
import com.zoonk.api.models.PlanBase
import com.zoonk.api.models.PlanBaseMinutes
import com.zoonk.api.models.PlanBases
import com.zoonk.api.models.PlanBasesAdvice
import com.zoonk.api.models.PlanChangePreview
import com.zoonk.api.models.PlanChangePreviewFeasibility
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** Main's `PlanBases`: how to study what an exam's or a goal's final work builds on. */
@Composable
internal fun PlanBases(
    page: PlanPageState,
    edits: PlanEdits,
    drafts: EditorDrafts,
) {
    val bases = page.plan.bases?.takeIf { it.items.isNotEmpty() } ?: return

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionLabel(stringResource(R.string.plan_prerequisites))
        Text(basesSummary(bases), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        FilledTonalButton(onClick = { drafts.bases = BasesDraft() }) { Text(stringResource(R.string.plan_choose_prerequisites)) }
    }

    drafts.bases?.let { draft ->
        PlanSheet(onDismiss = { drafts.bases = null }) {
            BasesChoices(page, bases, edits, draft, onDraft = { drafts.bases = it }, onDone = { drafts.bases = null })
        }
    }
}

/**
 * Main's `PlanBasesSheet`: the choices stay a draft, previewed as they change, until Save choices.
 * The app recommends a choice only when the learner asks.
 */
@Composable
internal fun ColumnScope.BasesChoices(
    page: PlanPageState,
    bases: PlanBases,
    edits: PlanEdits,
    draft: BasesDraft,
    onDraft: (BasesDraft) -> Unit,
    onDone: () -> Unit,
) {
    var advice by remember { mutableStateOf<Advice>(Advice.Idle) }
    var attempt by remember { mutableIntStateOf(0) }
    val scope = rememberCoroutineScope()
    val pending = edits.isPending(PlanPart.Bases)

    fun choiceOf(item: PlanBase) = draft.choices[item.skillId] ?: item.choice

    val changed =
        bases.items.mapNotNull { item ->
            choiceOf(item)
                .takeIf {
                    it != item.choice
                }?.let { BaseChoice(item.skillId.toString(), it.value) }
        }
    val operations = if (changed.isEmpty()) emptyList() else listOf(PlanOp.BaseChoices(changed))
    val check = rememberPreviewCheck(page, edits, operations, attempt)
    val recommended = (advice as? Advice.Answered)?.recommended
    val title = stringResource(R.string.plan_prerequisites)
    val description = stringResource(if (page.isExam) R.string.plan_prerequisites_exam else R.string.plan_prerequisites_goal)

    if (edits.sheetKept(draft.opening)) {
        LaunchedEffect(draft.opening) { onDone() }
        return
    }
    val applied = edits.sheetApplied(draft.opening)
    if (applied != null) {
        PlanChangeApplied(page, title, description, applied, R.drawable.ic_layers, onUndo = { edits.undo(applied.change) }, onDone = onDone)
        return
    }

    val open = listOpen(bases.items)
    val shared = sharedChoice(open, ::choiceOf)

    fun choose(
        items: List<PlanBase>,
        choice: PlanBase.Choice,
    ) {
        onDraft(draft.copy(choices = draft.choices + items.associate { it.skillId to it.chooseFor(choice, choiceOf(it)) }))
    }

    PlanSheetContent(
        title = title,
        description = description,
        body = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                AllBasesChoice(bases.items, shared, recommended, enabled = !pending, onChoose = { choose(bases.items, it) })
                if (shared == null) Note(stringResource(R.string.plan_bases_differ))
                if (bases.items.any { it.studied }) Note(stringResource(R.string.plan_bases_studied_stay))
                BasesAdvice(
                    advice = advice,
                    followed = changed.isEmpty() && shared != null && shared == recommended,
                    isExam = page.isExam,
                    onAsk = {
                        if (advice == Advice.Pending) return@BasesAdvice
                        advice = Advice.Pending
                        scope.launch { advice = adviceOf(edits.adviseOnBases()) }
                    },
                )
            }
            val areas = bases.items.groupBy { it.area }
            if (areas.size > 1) {
                BasesBySubject(
                    areas = areas,
                    choiceOf = ::choiceOf,
                    startOpen = sharedChoice(open) { it.choice } == null,
                    enabled = !pending,
                    onChoose = ::choose,
                )
            }
            Note(knownText(bases))
        },
        actions = {
            if (operations.isNotEmpty()) PreviewOutcome(page, check, onRetry = { attempt++ })
            Button(
                onClick = { edits.change(PlanPart.Bases, operations) { edits.answerSheet(draft.opening, it) } },
                modifier = Modifier.fillMaxWidth(),
                enabled = !pending && operations.isNotEmpty() && check is Check.Ready,
            ) {
                PendingLabel(pending, stringResource(R.string.plan_save_choices))
            }
            if (edits.sheetFailed(PlanPart.Bases, draft.opening)) SaveFailedText()
        },
    )
}

@Composable
private fun AllBasesChoice(
    items: List<PlanBase>,
    value: PlanBase.Choice?,
    recommended: PlanBase.Choice?,
    enabled: Boolean,
    onChoose: (PlanBase.Choice) -> Unit,
) {
    val locale = currentLocale()

    Column {
        SectionLabel(stringResource(R.string.plan_all_prerequisites))
        Column(Modifier.selectableGroup()) {
            openChoices(items).forEach { choice ->
                ChoiceRow(
                    label = baseChoiceName(choice),
                    description = baseChoiceDescription(choice),
                    selected = choice == value,
                    onSelect = { onChoose(choice) },
                    enabled = enabled,
                    mark = if (choice == recommended) ({ LabelChip(stringResource(R.string.plan_recommended)) }) else null,
                    trailing =
                        if (choice == PlanBase.Choice.SKIP) {
                            null
                        } else {
                            formatMinutes(minutesOf(items) { it.chooseFor(choice, it.choice) }.toInt(), locale)
                        },
                )
            }
        }
    }
}

@Composable
private fun BasesBySubject(
    areas: Map<String, List<PlanBase>>,
    choiceOf: (PlanBase) -> PlanBase.Choice,
    startOpen: Boolean,
    enabled: Boolean,
    onChoose: (List<PlanBase>, PlanBase.Choice) -> Unit,
) {
    var open by remember { mutableStateOf(startOpen) }

    DisclosureRow(
        stringResource(R.string.plan_choose_by_subject),
        expanded = open,
        onExpandedChange = { open = it },
        leading = { Icon(painterResource(R.drawable.ic_tune), contentDescription = null) },
        modifier = Modifier.bleed(LIST_ITEM_INSET),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            areas.forEach { (area, items) -> SubjectChoice(area, items, choiceOf, enabled, onChoose = { onChoose(items, it) }) }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SubjectChoice(
    area: String,
    items: List<PlanBase>,
    choiceOf: (PlanBase) -> PlanBase.Choice,
    enabled: Boolean,
    onChoose: (PlanBase.Choice) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    val value = sharedChoice(listOpen(items), choiceOf)
    val minutes = minutesOf(items, choiceOf)
    val studied = items.all { it.studied }
    val names = joinList(items.map { if (it.studied) stringResource(R.string.plan_base_studied_name, it.name) else it.name })
    val options = openChoices(items)
    val shown = if (value != null && value !in options) listOf(value) + options else options

    @Composable
    fun label(choice: PlanBase.Choice) =
        if (studied && choice == PlanBase.Choice.ESSENTIAL) stringResource(R.string.plan_base_studied) else baseChoiceName(choice)

    ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = it && enabled }) {
        OutlinedTextField(
            value = value?.let { label(it) } ?: stringResource(R.string.plan_different_choices),
            onValueChange = {},
            modifier = Modifier.fillMaxWidth().menuAnchor(ExposedDropdownMenuAnchorType.PrimaryNotEditable, enabled),
            enabled = enabled,
            readOnly = true,
            label = { Text(area) },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded) },
            supportingText = {
                Text(
                    if (minutes >
                        0
                    ) {
                        stringResource(R.string.plan_base_names_time, names, formatMinutes(minutes.toInt(), currentLocale()))
                    } else {
                        names
                    },
                )
            },
        )
        ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            shown.forEach { choice ->
                DropdownMenuItem(
                    text = { Text(label(choice)) },
                    onClick = {
                        expanded = false
                        onChoose(choice)
                    },
                    contentPadding = ExposedDropdownMenuDefaults.ItemContentPadding,
                )
            }
        }
    }
}

@Composable
private fun BasesAdvice(
    advice: Advice,
    followed: Boolean,
    isExam: Boolean,
    onAsk: () -> Unit,
) {
    val asking = advice == Advice.Pending
    val answer = remember { FocusRequester() }

    LaunchedEffect(advice) { if (advice is Advice.Answered) answer.requestFocus() }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        when (advice) {
            is Advice.Answered -> {
                val text = adviceText(advice, isExam)
                Note(
                    text = if (followed) "$text ${stringResource(R.string.plan_recommendation_followed)}" else text,
                    modifier = Modifier.focusRequester(answer).focusable(),
                )
            }

            Advice.Building -> {
                Note(stringResource(R.string.plan_still_building), live = true)
            }

            Advice.Failed -> {
                Note(stringResource(R.string.plan_recommendation_failed), live = true)
            }

            Advice.Idle, Advice.Pending -> {}
        }
        if (advice !is Advice.Answered) {
            FilledTonalButton(onClick = onAsk, modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite }) {
                PendingLabel(
                    asking,
                    stringResource(
                        when (advice) {
                            Advice.Pending -> R.string.plan_getting_recommendation
                            Advice.Building, Advice.Failed -> R.string.load_failed_try_again
                            else -> R.string.plan_get_recommendation
                        },
                    ),
                )
            }
        }
    }
}

@Composable
private fun PreviewOutcome(
    page: PlanPageState,
    check: Check,
    onRetry: () -> Unit,
) {
    Column(
        modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        when (check) {
            Check.Loading -> {
                Note(stringResource(R.string.plan_checking_changes))
            }

            Check.Failed -> {
                Note(stringResource(R.string.plan_check_failed))
                FilledTonalButton(onClick = onRetry) { Text(stringResource(R.string.load_failed_try_again)) }
            }

            is Check.Ready -> {
                val preview = check.preview
                if (preview.unchanged) {
                    Note(stringResource(R.string.plan_stays_as_it_is))
                } else {
                    PlanEffectDiff(preview.effect)
                    basesFootnote(page, preview).takeIf { it.isNotEmpty() }?.let {
                        Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
    }
}

@Composable
private fun Note(
    text: String,
    modifier: Modifier = Modifier,
    live: Boolean = false,
) {
    Text(
        text = text,
        modifier = if (live) modifier.semantics { liveRegion = LiveRegionMode.Polite } else modifier,
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
}

private sealed interface Advice {
    data object Idle : Advice

    data object Pending : Advice

    data object Building : Advice

    data object Failed : Advice

    data class Answered(
        val recommended: PlanBase.Choice,
        val daysLeft: Long?,
    ) : Advice
}

private fun adviceOf(advice: PlanBasesAdvice?): Advice {
    val recommended = advice?.recommended
    return when {
        advice == null -> Advice.Failed
        !advice.ready || recommended == null -> Advice.Building
        else -> Advice.Answered(PlanBase.Choice.valueOf(recommended.name), advice.daysLeft)
    }
}

private sealed interface Check {
    data object Loading : Check

    data object Failed : Check

    data class Ready(
        val preview: PlanChangePreview,
    ) : Check
}

private fun checkOf(preview: PlanChangePreview?): Check =
    if (preview == null || !preview.ready || (!preview.unchanged && preview.effect == null)) Check.Failed else Check.Ready(preview)

/** A moment after the choices last changed, and again when the plan does; a result counts only for the choices it checked. */
@Composable
private fun rememberPreviewCheck(
    page: PlanPageState,
    edits: PlanEdits,
    operations: List<PlanOp>,
    attempt: Int,
): Check {
    var checked by remember { mutableStateOf<Pair<List<PlanOp>, Check>?>(null) }

    LaunchedEffect(operations, page.plan, attempt) {
        checked = null
        if (operations.isEmpty()) return@LaunchedEffect
        delay(PREVIEW_DELAY_MS)
        checked = operations to checkOf(edits.preview(operations))
    }

    return checked?.takeIf { it.first == operations }?.second ?: Check.Loading
}

private const val PREVIEW_DELAY_MS = 300L

@Composable
private fun basesFootnote(
    page: PlanPageState,
    preview: PlanChangePreview,
): String {
    val added =
        preview.effect
            ?.topicsAdded
            .orEmpty()
            .flatMap { it.topics }
    val leftOut =
        preview.effect
            ?.topicsLeftOut
            .orEmpty()
            .flatMap { it.topics }

    return listOfNotNull(
        if (added.isEmpty()) {
            null
        } else {
            pluralStringResource(
                R.plurals.plan_bases_topics_come_in,
                added.size,
                added.size,
                shortList(added, ListKind.Topics),
            )
        },
        if (leftOut.isEmpty()) {
            null
        } else {
            pluralStringResource(
                R.plurals.plan_bases_topics_leave,
                leftOut.size,
                leftOut.size,
                shortList(leftOut, ListKind.Topics),
            )
        },
        preview.feasibility?.let { coverageLine(page, it) },
    ).joinToString(" ")
}

@Composable
private fun coverageLine(
    page: PlanPageState,
    feasibility: PlanChangePreviewFeasibility,
): String {
    if (feasibility.fits) return stringResource(R.string.plan_bases_everything_fits)
    val locale = currentLocale()
    val after = formatPercent(feasibility.coveredShare, locale)
    val before = formatPercent(page.plan.feasibility?.coveredShare ?: 0.0, locale)
    val exam = feasibility.measure == PlanChangePreviewFeasibility.Measure.EXAM

    return when {
        after == before -> stringResource(if (exam) R.string.plan_bases_exam_share_same else R.string.plan_bases_goal_share_same, after)
        else -> stringResource(if (exam) R.string.plan_bases_exam_share else R.string.plan_bases_goal_share, after, before)
    }
}

@Composable
private fun adviceText(
    advice: Advice.Answered,
    isExam: Boolean,
): String {
    val days = advice.daysLeft
    return when {
        advice.recommended == PlanBase.Choice.DEEP -> {
            stringResource(R.string.plan_recommend_deep)
        }

        advice.recommended == PlanBase.Choice.QUICK && days != null -> {
            pluralStringResource(
                if (isExam) R.plurals.plan_recommend_quick_exam else R.plurals.plan_recommend_quick_goal,
                days.toInt(),
                days.toInt(),
            )
        }

        else -> {
            stringResource(if (isExam) R.string.plan_recommend_essential_exam else R.string.plan_recommend_essential_goal)
        }
    }
}

@Composable
private fun knownText(bases: PlanBases): String {
    val known = bases.knownCount.toInt()
    return if (known > 0) pluralStringResource(R.plurals.plan_bases_known, known, known) else stringResource(R.string.plan_bases_show_known)
}

@Composable
private fun basesSummary(bases: PlanBases): String {
    val count = bases.items.size
    val time = formatMinutes(bases.items.sumOf { it.choice.minutesIn(it.minutes) }.toInt(), currentLocale())
    val plural =
        when (
            bases.items
                .map { it.choice }
                .toSet()
                .singleOrNull()
        ) {
            null -> R.plurals.plan_bases_mixed
            PlanBase.Choice.DEEP -> R.plurals.plan_bases_deep
            PlanBase.Choice.QUICK -> R.plurals.plan_bases_quick
            PlanBase.Choice.SKIP -> R.plurals.plan_bases_skip
            PlanBase.Choice.ESSENTIAL -> R.plurals.plan_bases_essential
        }
    return pluralStringResource(plural, count, count, time)
}

@Composable
private fun baseChoiceName(choice: PlanBase.Choice) =
    stringResource(
        when (choice) {
            PlanBase.Choice.DEEP -> R.string.plan_base_deep
            PlanBase.Choice.ESSENTIAL -> R.string.plan_base_essential
            PlanBase.Choice.QUICK -> R.string.plan_base_quick
            PlanBase.Choice.SKIP -> R.string.plan_base_skip
        },
    )

@Composable
private fun baseChoiceDescription(choice: PlanBase.Choice) =
    stringResource(
        when (choice) {
            PlanBase.Choice.DEEP -> R.string.plan_base_deep_description
            PlanBase.Choice.ESSENTIAL -> R.string.plan_base_essential_description
            PlanBase.Choice.QUICK -> R.string.plan_base_quick_description
            PlanBase.Choice.SKIP -> R.string.plan_base_skip_description
        },
    )

/** A studied prerequisite takes only the depth beyond its core. */
internal fun PlanBase.minutesFor(choice: PlanBase.Choice): Long =
    when {
        !studied -> choice.minutesIn(minutes)
        choice == PlanBase.Choice.DEEP -> (minutes.deep - minutes.essential).coerceAtLeast(0)
        else -> 0
    }

private fun PlanBase.Choice.minutesIn(minutes: PlanBaseMinutes): Long =
    when (this) {
        PlanBase.Choice.DEEP -> minutes.deep
        PlanBase.Choice.ESSENTIAL -> minutes.essential
        PlanBase.Choice.QUICK -> minutes.quick
        PlanBase.Choice.SKIP -> 0
    }

internal fun minutesOf(
    items: List<PlanBase>,
    choiceOf: (PlanBase) -> PlanBase.Choice,
): Long = items.sumOf { it.minutesFor(choiceOf(it)) }

/** A choice the prerequisite isn't open to keeps its current one. */
internal fun PlanBase.chooseFor(
    choice: PlanBase.Choice,
    current: PlanBase.Choice,
): PlanBase.Choice = if (choices.any { it.value == choice.value }) choice else current

internal fun openChoices(items: List<PlanBase>): List<PlanBase.Choice> =
    PlanBase.Choice.entries.filter { choice -> items.any { item -> item.choices.any { it.value == choice.value } } }

/** The prerequisites still to study, or all of them when every one is studied. */
internal fun listOpen(items: List<PlanBase>): List<PlanBase> = items.filterNot { it.studied }.ifEmpty { items }

internal fun sharedChoice(
    items: List<PlanBase>,
    choiceOf: (PlanBase) -> PlanBase.Choice,
): PlanBase.Choice? = items.map(choiceOf).toSet().singleOrNull()
