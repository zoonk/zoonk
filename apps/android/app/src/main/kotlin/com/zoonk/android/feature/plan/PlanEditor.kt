package com.zoonk.android.feature.plan

import androidx.annotation.DrawableRes
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.adaptive.currentWindowAdaptiveInfoV2
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.listSaver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.window.DialogWindowProvider
import androidx.window.core.layout.WindowSizeClass
import com.zoonk.android.R
import com.zoonk.android.ui.characters.BuddyKind
import com.zoonk.android.ui.characters.buddyName
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.models.Plan
import com.zoonk.api.models.PlanBase
import com.zoonk.api.models.PlanBasesAdvice
import com.zoonk.api.models.PlanChange
import com.zoonk.api.models.PlanChangePreview
import com.zoonk.api.models.PlanChangeResult
import com.zoonk.api.models.PlanTool
import kotlinx.datetime.toJavaLocalDate
import java.io.Serializable
import java.util.UUID

/**
 * What the editor's parts save through, what each asked for while it saves, and which failed; the
 * search for the time that covers everything, and the sheets the editor opens.
 */
@Immutable
internal data class PlanEdits(
    val pending: Set<PlanPart> = emptySet(),
    val asked: Map<PlanPart, List<PlanOp>> = emptyMap(),
    val failed: Set<PlanPart> = emptySet(),
    val latest: EditorChange? = null,
    val changes: Map<UUID, EditorChange> = emptyMap(),
    val change: (PlanPart, List<PlanOp>, (PlanChangeResult?) -> Unit) -> Unit = { _, _, _ -> },
    val undo: (PlanChange) -> Unit = {},
    val timeToCover: TimeToCoverState = TimeToCoverState.Idle,
    val findTimeToCover: (Plan, (TimeToCoverOutcome) -> Unit) -> Unit = { _, _ -> },
    val chooseFocus: () -> Unit = {},
    val studyEverything: () -> Unit = {},
    val chooseExamOption: (group: String, subject: String, (PlanChangeResult?) -> Unit) -> Unit = { _, _, _ -> },
    val chooseTools: (ToolAnswer, (PlanChangeResult?) -> Unit) -> Unit = { _, _ -> },
    val preview: suspend (List<PlanOp>) -> PlanChangePreview? = { null },
    val adviseOnBases: suspend () -> PlanBasesAdvice? = { null },
) {
    fun isPending(part: PlanPart) = part in pending

    fun hasFailed(part: PlanPart) = part in failed

    fun asked(part: PlanPart): List<PlanOp> = asked[part].orEmpty()
}

/** What the editor shows that isn't saved, kept above its sheet or panel, which turning a phone swaps. */
@Stable
internal class EditorDrafts(
    datePicking: Boolean = false,
    weekendOn: Boolean? = null,
    bases: BasesDraft? = null,
    tool: ToolDraft? = null,
) {
    var datePicking by mutableStateOf(datePicking)

    /** Null follows the plan: on while its weekend has its own time. */
    var weekendOn by mutableStateOf(weekendOn)

    /** The prerequisites' sheet while it's open. */
    var bases by mutableStateOf(bases)

    /** A tool's sheet while it's open. */
    var tool by mutableStateOf(tool)

    companion object {
        val Saver =
            listSaver<EditorDrafts, Any?>(
                save = { listOf(it.datePicking, it.weekendOn, it.bases, it.tool) },
                restore = { EditorDrafts(it[0] as Boolean, it[1] as Boolean?, it[2] as BasesDraft?, it[3] as ToolDraft?) },
            )
    }
}

/** The choices not saved yet, by skill; [saved] is the change saving them made, shown with Done and Undo. */
internal data class BasesDraft(
    val choices: Map<UUID, PlanBase.Choice> = emptyMap(),
    val saved: UUID? = null,
) : Serializable

/** [choice] and [system] start as the tool's current answer. */
internal data class ToolDraft(
    val name: String,
    val choice: PlanTool.Choice?,
    val system: PlanTool.System?,
) : Serializable

/**
 * The learner's adjustments, as main's `PlanEditor`: a bottom sheet on a phone, and from a medium
 * window a side panel, so the page re-plans visibly beside it. [section] is brought into view on
 * opening.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun PlanEditor(
    page: PlanPageState,
    edits: PlanEdits,
    section: PlanSection?,
    onTellBuddy: () -> Unit,
    onDismiss: () -> Unit,
) {
    val wide = currentWindowAdaptiveInfoV2().windowSizeClass.isWidthAtLeastBreakpoint(WindowSizeClass.WIDTH_DP_MEDIUM_LOWER_BOUND)
    val drafts = rememberSaveable(saver = EditorDrafts.Saver) { EditorDrafts() }

    if (wide) {
        SidePanel(onDismiss) { PlanEditorBody(page, edits, section, onTellBuddy, onClose = onDismiss, drafts = drafts) }
    } else {
        val title = stringResource(R.string.plan_editor_title)
        ModalBottomSheet(
            onDismissRequest = onDismiss,
            modifier = Modifier.semantics { paneTitle = title },
            sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        ) {
            PlanEditorBody(page, edits, section, onTellBuddy, drafts = drafts)
        }
    }
    if (drafts.datePicking) PlanDateDialog(page, edits, layer = wide, onClose = { drafts.datePicking = false })
}

/** [onClose] is the side panel's close button; the panel shows the latest change at its top, as main's does. */
@Composable
internal fun ColumnScope.PlanEditorBody(
    page: PlanPageState,
    edits: PlanEdits,
    section: PlanSection? = null,
    onTellBuddy: () -> Unit = {},
    onClose: (() -> Unit)? = null,
    drafts: EditorDrafts = remember { EditorDrafts() },
) {
    val requesters = remember { PlanSection.entries.associateWith { BringIntoViewRequester() } }

    fun Modifier.section(section: PlanSection) = bringIntoViewRequester(requesters.getValue(section))

    LaunchedEffect(section) { section?.let { requesters.getValue(it).bringIntoView() } }

    Row(
        modifier = Modifier.padding(start = SHEET_MARGIN, end = if (onClose != null) 12.dp else SHEET_MARGIN, bottom = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = stringResource(R.string.plan_editor_title),
            modifier = Modifier.weight(1f).semantics { heading() },
            style = MaterialTheme.typography.titleLarge,
        )
        onClose?.let {
            IconButton(onClick = it) {
                Icon(painterResource(R.drawable.ic_close), contentDescription = stringResource(R.string.plan_editor_close))
            }
        }
    }
    if (onClose != null) {
        edits.latest?.let {
            LatestChange(page, it, edits.undo)
            HorizontalDivider()
        }
    }
    Column(
        modifier =
            Modifier
                .weight(1f, fill = false)
                .verticalScroll(rememberScrollState())
                .padding(start = SHEET_MARGIN, end = SHEET_MARGIN, top = 16.dp, bottom = 32.dp),
        verticalArrangement = Arrangement.spacedBy(28.dp),
    ) {
        PlanDateSection(page, edits, drafts, Modifier.section(PlanSection.Date))
        PlanScheduleSection(
            page,
            edits,
            drafts,
            modifier = Modifier.section(PlanSection.Time),
            daysModifier = Modifier.section(PlanSection.Days),
        )
        PlanExamChoices(page, edits, Modifier.section(PlanSection.Choices))
        PlanBases(page, edits, drafts)
        PlanActivities(page, edits, Modifier.section(PlanSection.Practice))
        PlanWrittenPractice(page, edits)
        PlanSteering(page, edits)
        PlanTools(page, edits, drafts)
        PlanEditRequest(page, onTellBuddy)
    }
    if (onClose == null) {
        edits.latest?.let {
            HorizontalDivider()
            LatestChange(page, it, edits.undo)
        }
    }
}

/**
 * Material's modal side sheet, which Compose doesn't offer: on the window's end edge, with main's
 * light dim so the page stays readable behind it.
 */
@Composable
private fun SidePanel(
    onDismiss: () -> Unit,
    content: @Composable ColumnScope.() -> Unit,
) {
    val title = stringResource(R.string.plan_editor_title)

    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false)) {
        (LocalView.current.parent as? DialogWindowProvider)?.window?.setDimAmount(PANEL_DIM)
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.CenterEnd) {
            Box(
                Modifier.matchParentSize().clearAndSetSemantics {}.clickable(
                    interactionSource = null,
                    indication = null,
                    onClick = onDismiss,
                ),
            )
            Surface(
                modifier =
                    Modifier
                        .fillMaxHeight()
                        .widthIn(max = PANEL_WIDTH)
                        .fillMaxWidth()
                        .semantics { paneTitle = title },
                shape = RoundedCornerShape(topStart = PANEL_CORNER, bottomStart = PANEL_CORNER),
                color = MaterialTheme.colorScheme.surfaceContainerLow,
            ) {
                Column(
                    modifier =
                        Modifier
                            .windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Vertical + WindowInsetsSides.End))
                            .padding(top = 12.dp),
                    content = content,
                )
            }
        }
    }
}

private const val PANEL_DIM = 0.2f
private val PANEL_WIDTH = 400.dp
private val PANEL_CORNER = 16.dp

@Composable
private fun LatestChange(
    page: PlanPageState,
    latest: EditorChange,
    onUndo: (PlanChange) -> Unit,
) {
    Column(
        modifier = Modifier.padding(start = SHEET_MARGIN, end = SHEET_MARGIN, top = 16.dp, bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (latest.undone) {
            Text(
                text = stringResource(R.string.plan_change_undone),
                modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.Medium,
            )
            return@Column
        }
        PlanChangeSummary(
            change = latest.change,
            targetDate =
                page.plan.schedule.targetDate
                    ?.toJavaLocalDate(),
            fullCourse = page.plan.schedule.fullCourse,
            icon = R.drawable.ic_tune,
        )
        if (latest.change.canUndo) {
            TextButton(onClick = { onUndo(latest.change) }, enabled = !latest.undoing) { Text(stringResource(R.string.plan_undo)) }
        }
        if (latest.undoFailed) SaveFailedText()
    }
}

@Composable
private fun PlanEditRequest(
    page: PlanPageState,
    onTellBuddy: () -> Unit,
) {
    val buddy = page.summary.buddy

    PathRow(onClick = onTellBuddy, end = { Chevron() }) {
        Icon(painterResource(R.drawable.ic_chat_bubble), contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = stringResource(R.string.plan_tell_buddy, buddyName(BuddyKind.of(buddy.kind.value), buddy.name)),
                style = MaterialTheme.typography.bodyLarge,
            )
            Text(
                text = stringResource(R.string.plan_tell_buddy_description),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

/**
 * A choice in the editor, picked as an answer is: a check and an ink line on the picked tint. [role]
 * says what a tap does for TalkBack when it isn't a checkbox's.
 */
@Composable
internal fun PlanChip(
    text: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    role: Role? = null,
    @DrawableRes trailing: Int? = null,
    description: String? = null,
) {
    val colors = MaterialTheme.colorScheme

    FilterChip(
        selected = selected,
        onClick = onClick,
        label = {
            if (description == null) {
                Text(text)
            } else {
                Column(Modifier.padding(vertical = 6.dp)) {
                    Text(text)
                    Text(description, style = MaterialTheme.typography.labelSmall)
                }
            }
        },
        modifier = if (role != null) modifier.semantics { this.role = role } else modifier,
        leadingIcon =
            if (selected) {
                { Icon(painterResource(R.drawable.ic_check), contentDescription = null, Modifier.size(FilterChipDefaults.IconSize)) }
            } else {
                null
            },
        trailingIcon =
            trailing?.let {
                {
                    Icon(
                        painterResource(it),
                        contentDescription = null,
                        Modifier.size(FilterChipDefaults.IconSize),
                    )
                }
            },
        colors =
            FilterChipDefaults.filterChipColors(
                selectedContainerColor = MaterialTheme.zoonk.selectedTint,
                selectedLabelColor = colors.onSurface,
                selectedLeadingIconColor = colors.onSurface,
            ),
        border =
            FilterChipDefaults.filterChipBorder(
                enabled = true,
                selected = selected,
                borderColor = colors.outline,
                selectedBorderColor = colors.primary,
                selectedBorderWidth = 2.dp,
            ),
    )
}

@Composable
internal fun SaveFailedText(modifier: Modifier = Modifier) {
    Text(
        text = stringResource(R.string.plan_save_failed),
        modifier = modifier.semantics { liveRegion = LiveRegionMode.Assertive },
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.error,
    )
}

@Composable
internal fun SectionLabel(
    text: String,
    modifier: Modifier = Modifier,
) {
    Text(text = text, modifier = modifier.semantics { heading() }, style = MaterialTheme.typography.titleSmall)
}

@Composable
internal fun ChoiceRow(
    label: String,
    description: String,
    selected: Boolean,
    onSelect: () -> Unit,
    mark: (@Composable () -> Unit)? = null,
    trailing: String? = null,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 56.dp)
                .selectable(selected = selected, role = Role.RadioButton, onClick = onSelect)
                .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        RadioButton(selected = selected, onClick = null)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(label, style = MaterialTheme.typography.bodyLarge)
                mark?.invoke()
            }
            Text(description, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        trailing?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) }
    }
}
