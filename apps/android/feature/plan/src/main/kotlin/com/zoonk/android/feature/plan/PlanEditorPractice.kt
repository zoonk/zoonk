package com.zoonk.android.feature.plan

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.components.SelectionChip
import com.zoonk.api.models.LearnerSummaryGoal
import com.zoonk.api.models.PlanSteering
import com.zoonk.api.models.WrittenPractice

@Composable
internal fun PlanActivities(
    page: PlanPageState,
    edits: PlanEdits,
    modifier: Modifier = Modifier,
) {
    if (page.goal.kind != LearnerSummaryGoal.Kind.LANGUAGE) return
    val asked = edits.asked(PlanPart.Activities)
    val skipped =
        page.plan.steering.skippedActivities
            .toSet()

    Column(modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SectionLabel(stringResource(R.string.plan_what_you_practice))
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            PlanSteering.SkippedActivities.entries.forEach { activity ->
                val isOn = activity !in skipped
                SelectionChip(
                    text = activityName(activity),
                    selected = askedOn(asked, activity.value) ?: isOn,
                    onClick = {
                        val activities = listOf(activity.value)
                        val operation = if (isOn) PlanOp.SkipActivities(activities) else PlanOp.RestoreActivities(activities)
                        edits.change(PlanPart.Activities, listOf(operation)) {}
                    },
                )
            }
        }
        if (edits.hasFailed(PlanPart.Activities)) SaveFailedText()
    }
}

@Composable
internal fun PlanWrittenPractice(
    page: PlanPageState,
    edits: PlanEdits,
) {
    val practice = page.plan.writtenPractice ?: return
    val asked = edits.asked(PlanPart.Writing).filterIsInstance<PlanOp.WrittenCadence>().firstOrNull()

    WrittenCadenceChoice(
        practice = practice,
        asked = WrittenPractice.Cadence.entries.firstOrNull { it.value == asked?.cadence },
        pending = edits.isPending(PlanPart.Writing),
        failed = edits.hasFailed(PlanPart.Writing),
        onChange = { edits.change(PlanPart.Writing, listOf(PlanOp.WrittenCadence(it.value))) {} },
    )
}

/** Main's choice of when to practice the written tests, on the Plan and on a written test's page; [asked] shows while it saves. */
@Composable
internal fun WrittenCadenceChoice(
    practice: WrittenPractice,
    asked: WrittenPractice.Cadence?,
    pending: Boolean,
    failed: Boolean,
    onChange: (WrittenPractice.Cadence) -> Unit,
    modifier: Modifier = Modifier,
) {
    val shown = asked ?: practice.cadence
    val cadences = WrittenPractice.Cadence.entries.filter { it != WrittenPractice.Cadence.FINAL_WEEKS || practice.finalWeeksFrom != null }

    Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionLabel(stringResource(R.string.plan_when_to_practice, joinList(practice.parts)))
        Column(Modifier.selectableGroup()) {
            cadences.forEach { cadence ->
                Row(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .heightIn(min = 48.dp)
                            .selectable(
                                selected = cadence == shown,
                                enabled = !pending,
                                role = Role.RadioButton,
                                onClick = { if (cadence != practice.cadence) onChange(cadence) },
                            ),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    RadioButton(selected = cadence == shown, onClick = null, enabled = !pending)
                    Text(cadenceLabel(cadence), style = MaterialTheme.typography.bodyLarge)
                }
            }
        }
        Text(
            text = cadenceEffect(shown),
            modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        if (failed) SaveFailedText()
    }
}

@Composable
private fun cadenceLabel(cadence: WrittenPractice.Cadence) =
    stringResource(
        when (cadence) {
            WrittenPractice.Cadence.WEEKLY -> R.string.plan_cadence_weekly
            WrittenPractice.Cadence.BIWEEKLY -> R.string.plan_cadence_biweekly
            WrittenPractice.Cadence.FINAL_WEEKS -> R.string.plan_cadence_final_weeks
        },
    )

@Composable
private fun cadenceEffect(cadence: WrittenPractice.Cadence) =
    stringResource(
        when (cadence) {
            WrittenPractice.Cadence.WEEKLY -> R.string.plan_cadence_weekly_effect
            WrittenPractice.Cadence.BIWEEKLY -> R.string.plan_cadence_biweekly_effect
            WrittenPractice.Cadence.FINAL_WEEKS -> R.string.plan_cadence_final_weeks_effect
        },
    )

/** Whether a change saving turns [activity] on or off; null while none asks about it. */
private fun askedOn(
    asked: List<PlanOp>,
    activity: String,
): Boolean? =
    asked.firstNotNullOfOrNull {
        when {
            it is PlanOp.SkipActivities && activity in it.activities -> false
            it is PlanOp.RestoreActivities && activity in it.activities -> true
            else -> null
        }
    }
