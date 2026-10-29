package com.zoonk.android.feature.plan

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.adaptive.currentWindowAdaptiveInfoV2
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.window.DialogWindowProvider
import androidx.window.core.layout.WindowSizeClass
import com.zoonk.android.R
import com.zoonk.android.ui.characters.BuddyKind
import com.zoonk.android.ui.characters.buddyName
import com.zoonk.api.models.PlanChange
import com.zoonk.api.models.PlanChangeResult
import kotlinx.datetime.toJavaLocalDate

/** What the editor's parts save through, and which of them are waiting or failed. */
@Immutable
internal data class PlanEdits(
    val pending: Set<PlanPart> = emptySet(),
    val failed: Set<PlanPart> = emptySet(),
    val latest: EditorChange? = null,
    val change: (PlanPart, List<PlanOp>, (PlanChangeResult?) -> Unit) -> Unit = { _, _, _ -> },
    val undo: (PlanChange) -> Unit = {},
) {
    fun isPending(part: PlanPart) = part in pending

    fun hasFailed(part: PlanPart) = part in failed
}

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

    if (wide) {
        SidePanel(onDismiss) { PlanEditorBody(page, edits, section, onTellBuddy, onClose = onDismiss) }
    } else {
        ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
            PlanEditorBody(page, edits, section, onTellBuddy)
        }
    }
}

/** [onClose] is the side panel's close button; the panel shows the latest change at its top, as main's does. */
@Composable
internal fun ColumnScope.PlanEditorBody(
    page: PlanPageState,
    edits: PlanEdits,
    section: PlanSection? = null,
    onTellBuddy: () -> Unit = {},
    onClose: (() -> Unit)? = null,
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
        PlanDateSection(page, edits, Modifier.section(PlanSection.Date))
        PlanScheduleSection(page, edits, modifier = Modifier.section(PlanSection.Time), daysModifier = Modifier.section(PlanSection.Days))
        PlanActivities(page, edits, Modifier.section(PlanSection.Practice))
        PlanWrittenPractice(page, edits)
        PlanSteering(page, edits)
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
            OutlinedButton(onClick = { onUndo(latest.change) }, enabled = !latest.undoing) { Text(stringResource(R.string.plan_undo)) }
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

/**
 * Main's `useTappedChoice`: the learner's tap shows at once while its change saves, then the saved
 * choice; a pick never shows again over a later change.
 */
@Stable
internal class TappedChoice<T> {
    private var tapped by mutableStateOf<Tap<T>?>(null)

    fun shown(saved: T): T = tapped.let { if (it != null) it.value else saved }

    /** Pass what it returns as the change's answer: only this pick goes. */
    fun pick(value: T): (PlanChangeResult?) -> Unit {
        val next = Tap(value)
        tapped = next
        return { if (tapped === next) tapped = null }
    }

    private class Tap<T>(
        val value: T,
    )
}

@Composable
internal fun <T> rememberTappedChoice() = remember { TappedChoice<T>() }
