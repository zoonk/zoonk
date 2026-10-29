package com.zoonk.android.feature.plan

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.components.KindDot
import com.zoonk.android.ui.components.LearnKind
import com.zoonk.android.ui.components.ListRowChevron
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.models.Plan
import com.zoonk.api.models.PlanAreasInner
import com.zoonk.api.models.PlanChangeResult
import java.util.UUID

/** An area the learner can put depth on, with the options the exam counts inside it. */
internal data class FocusChoice(
    val area: PlanAreasInner,
    val parts: List<String>,
)

/** Main's `listFocusChoices`: a skipped area isn't offered, and an option counted inside another area goes with it. */
internal fun focusChoices(areas: List<PlanAreasInner>): List<FocusChoice> {
    val kept = areas.filterNot { it.skipped }
    return kept.filter { it.partOf == null }.map { area -> FocusChoice(area, kept.filter { it.partOf == area.name }.map { it.name }) }
}

internal fun canChooseFocus(plan: Plan): Boolean = planCoverage(plan) != null && focusChoices(plan.areas).size > 1

/** Main's `ChooseFocusHost` sheet: the focus test first, or the subjects picked by hand. */
@Composable
internal fun ChooseFocusSheet(
    page: PlanPageState,
    edits: PlanEdits,
    onFocusTest: () -> Unit,
    onDismiss: () -> Unit,
) {
    PlanSheet(onDismiss) { ChooseFocusBody(page, edits, onFocusTest, onDone = onDismiss) }
}

@Composable
internal fun ColumnScope.ChooseFocusBody(
    page: PlanPageState,
    edits: PlanEdits,
    onFocusTest: () -> Unit,
    onDone: () -> Unit,
) {
    val title = stringResource(R.string.plan_where_to_focus)
    val description = stringResource(R.string.plan_where_to_focus_description)
    var appliedId by rememberSaveable { mutableStateOf<String?>(null) }
    val applied = appliedId?.let { edits.changes[UUID.fromString(it)] }

    if (applied != null) {
        PlanChangeApplied(
            page,
            title,
            description,
            applied,
            R.drawable.ic_my_location,
            onUndo = { edits.undo(applied.change) },
            onDone = onDone,
        )
        return
    }

    val areas = focusChoices(page.plan.areas)
    val current = areas.filter { it.area.focused }.map { it.area.name }
    var chosen by rememberSaveable { mutableStateOf(current) }
    var unchanged by rememberSaveable { mutableStateOf<PlanChangeResult.Reason?>(null) }
    val pending = edits.isPending(PlanPart.Focus)

    fun save() {
        edits.change(PlanPart.Focus, listOf(PlanOp.FocusAreas(chosen))) { result ->
            val change = result?.change
            when {
                // A plan not built yet keeps the focus for when it is: there's no change to show.
                result?.status == PlanChangeResult.Status.APPLIED && change == null -> onDone()

                result?.status == PlanChangeResult.Status.APPLIED && change != null -> appliedId = change.id.toString()

                result?.status == PlanChangeResult.Status.UNCHANGED -> unchanged = result.reason
            }
        }
    }

    PlanSheetContent(
        title = title,
        description = description,
        body = {
            unchanged?.let { FocusUnchanged(it, joinList(chosen)) }
            FocusTestLink(onFocusTest)
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = stringResource(R.string.plan_choose_focus_yourself),
                    modifier = Modifier.semantics { heading() },
                    style = MaterialTheme.typography.titleSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                areas.forEach { choice ->
                    val name = choice.area.name
                    AreaChoice(
                        choice = choice,
                        checked = name in chosen,
                        onCheckedChange = { checked ->
                            if (pending) return@AreaChoice
                            unchanged = null
                            chosen = if (checked) chosen + name else chosen - name
                        },
                    )
                }
            }
        },
        actions = {
            Button(
                onClick = ::save,
                modifier = Modifier.fillMaxWidth(),
                enabled = chosen.isNotEmpty() && chosen.toSet() != current.toSet() && unchanged == null,
            ) {
                Text(stringResource(if (pending) R.string.plan_saving else R.string.plan_focus_on_these))
            }
            if (edits.hasFailed(PlanPart.Focus)) SaveFailedText()
        },
    )
}

@Composable
private fun FocusUnchanged(
    reason: PlanChangeResult.Reason?,
    areas: String,
) {
    Surface(color = MaterialTheme.colorScheme.surfaceContainerHighest, shape = MaterialTheme.shapes.medium) {
        Text(
            text =
                if (reason == PlanChangeResult.Reason.ALREADY_IN) {
                    stringResource(R.string.plan_focus_already_in, areas)
                } else {
                    stringResource(R.string.plan_focus_cant_move, areas)
                },
            modifier = Modifier.padding(16.dp).semantics { liveRegion = LiveRegionMode.Polite },
            style = MaterialTheme.typography.bodyMedium,
        )
    }
}

@Composable
private fun FocusTestLink(onOpen: () -> Unit) {
    OutlinedCard(onClick = onOpen, modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.heightIn(min = 56.dp).padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            KindDot(LearnKind.Challenge)
            Column(Modifier.weight(1f)) {
                Text(
                    stringResource(R.string.plan_take_short_test),
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Medium,
                )
                Text(
                    stringResource(R.string.plan_test_chooses_for_you),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            ListRowChevron()
        }
    }
}

@Composable
private fun AreaChoice(
    choice: FocusChoice,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
) {
    val colors = MaterialTheme.colorScheme

    Surface(
        checked = checked,
        onCheckedChange = onCheckedChange,
        modifier = Modifier.fillMaxWidth().semantics { role = Role.Checkbox },
        shape = MaterialTheme.shapes.medium,
        color = if (checked) MaterialTheme.zoonk.selectedTint else Color.Transparent,
        border = if (checked) BorderStroke(2.dp, colors.primary) else BorderStroke(1.dp, colors.outline),
    ) {
        Row(
            modifier = Modifier.heightIn(min = 56.dp).padding(start = 16.dp, end = 4.dp, top = 8.dp, bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(choice.area.name, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium)
                if (choice.parts.isNotEmpty()) {
                    Text(
                        stringResource(R.string.plan_focus_includes, joinList(choice.parts)),
                        style = MaterialTheme.typography.bodyMedium,
                        color = colors.onSurfaceVariant,
                    )
                }
                choice.area.focusPart?.takeIf { checked }?.let {
                    Text(
                        stringResource(R.string.plan_focus_only, it),
                        style = MaterialTheme.typography.bodyMedium,
                        color = colors.onSurfaceVariant,
                    )
                }
            }
            Checkbox(checked = checked, onCheckedChange = null)
        }
    }
}
