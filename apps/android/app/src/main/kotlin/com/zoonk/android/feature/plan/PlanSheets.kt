package com.zoonk.android.feature.plan

import androidx.annotation.DrawableRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import kotlinx.datetime.toJavaLocalDate

/** A sheet the Plan opens over the editor or the page, as main's plan drawers. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun PlanSheet(
    onDismiss: () -> Unit,
    content: @Composable ColumnScope.() -> Unit,
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        content = content,
    )
}

/** A plan sheet's title and description, what it says or asks, and its actions pinned under it. */
@Composable
internal fun ColumnScope.PlanSheetContent(
    title: String,
    description: String,
    body: @Composable ColumnScope.() -> Unit,
    actions: @Composable ColumnScope.() -> Unit,
) {
    Column(Modifier.padding(horizontal = SHEET_MARGIN), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(title, modifier = Modifier.semantics { heading() }, style = MaterialTheme.typography.titleLarge)
        Text(description, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
    Column(
        modifier =
            Modifier
                .weight(1f, fill = false)
                .verticalScroll(rememberScrollState())
                .padding(start = SHEET_MARGIN, end = SHEET_MARGIN, top = 16.dp, bottom = 16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        content = body,
    )
    HorizontalDivider()
    Column(
        modifier = Modifier.fillMaxWidth().padding(start = SHEET_MARGIN, end = SHEET_MARGIN, top = 16.dp, bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
        content = actions,
    )
}

/**
 * Main's `PlanChangeApplied`: what a sheet's choice did, with Done and Undo. An undone change
 * closes the sheet, as main's does.
 */
@Composable
internal fun ColumnScope.PlanChangeApplied(
    page: PlanPageState,
    title: String,
    description: String,
    latest: EditorChange,
    @DrawableRes icon: Int,
    onUndo: () -> Unit,
    onDone: () -> Unit,
) {
    LaunchedEffect(latest.undone) { if (latest.undone) onDone() }

    PlanSheetContent(
        title = title,
        description = description,
        body = {
            PlanChangeSummary(
                change = latest.change,
                targetDate =
                    page.plan.schedule.targetDate
                        ?.toJavaLocalDate(),
                fullCourse = page.plan.schedule.fullCourse,
                icon = icon,
            )
        },
        actions = {
            Button(onClick = onDone, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.plan_sheet_done)) }
            if (latest.change.canUndo) {
                TextButton(onClick = onUndo, modifier = Modifier.fillMaxWidth(), enabled = !latest.undoing) {
                    Text(stringResource(R.string.plan_undo))
                }
            }
            if (latest.undoFailed) SaveFailedText()
        },
    )
}
