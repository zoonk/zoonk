package com.zoonk.android.feature.plan

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.material3.FilterChip
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
    val pending = edits.isPending(PlanPart.Activities)
    val tapped = rememberTappedChoice<Pair<PlanSteering.SkippedActivities, Boolean>?>()
    val skipped =
        page.plan.steering.skippedActivities
            .toSet()

    Column(modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SectionLabel(stringResource(R.string.plan_what_you_practice))
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            PlanSteering.SkippedActivities.entries.forEach { activity ->
                val isOn = activity !in skipped
                val tap = tapped.shown(null)
                FilterChip(
                    selected = if (tap?.first == activity) tap.second else isOn,
                    onClick = {
                        val activities = listOf(activity.value)
                        val operation = if (isOn) PlanOp.SkipActivities(activities) else PlanOp.RestoreActivities(activities)
                        edits.change(PlanPart.Activities, listOf(operation), tapped.pick(activity to !isOn))
                    },
                    label = { Text(activityName(activity)) },
                    enabled = !pending,
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
    val pending = edits.isPending(PlanPart.Writing)
    val choice = rememberTappedChoice<WrittenPractice.Cadence>()
    val shown = choice.shown(practice.cadence)
    val cadences = WrittenPractice.Cadence.entries.filter { it != WrittenPractice.Cadence.FINAL_WEEKS || practice.finalWeeksFrom != null }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
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
                                onClick = {
                                    if (cadence != practice.cadence) {
                                        edits.change(PlanPart.Writing, listOf(PlanOp.WrittenCadence(cadence.value)), choice.pick(cadence))
                                    }
                                },
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
        if (edits.hasFailed(PlanPart.Writing)) SaveFailedText()
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

/** Main's `PlanSteering`: tapping an active choice goes back to the default. Shown once the learner has studied. */
@Composable
internal fun PlanSteering(
    page: PlanPageState,
    edits: PlanEdits,
) {
    val steering = page.plan.steering
    if (steering.lessonsStudied == 0L) return
    val pending = edits.isPending(PlanPart.Steering)
    val asked = rememberTappedChoice<PlanOp?>()
    val tap = asked.shown(null)
    val difficulty = (tap as? PlanOp.DifficultyBias)?.bias ?: steering.difficultyBias.value
    val practice = (tap as? PlanOp.PracticeBias)?.bias ?: steering.practiceBias.value
    val steers =
        listOf(
            Steer(R.string.plan_too_easy, difficulty == HARDER) { PlanOp.DifficultyBias(if (it) STANDARD else HARDER) },
            Steer(R.string.plan_too_hard, difficulty == EASIER) { PlanOp.DifficultyBias(if (it) STANDARD else EASIER) },
            Steer(R.string.plan_more_practice, practice == MORE_PRACTICE) { PlanOp.PracticeBias(if (it) BALANCED else MORE_PRACTICE) },
            Steer(R.string.plan_more_explanation, practice == MORE_EXPLANATION) {
                PlanOp.PracticeBias(if (it) BALANCED else MORE_EXPLANATION)
            },
        )

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SectionLabel(stringResource(R.string.plan_how_is_it_going))
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            steers.forEach { steer ->
                FilterChip(
                    selected = steer.active,
                    onClick = {
                        val operation = steer.operation(steer.active)
                        edits.change(PlanPart.Steering, listOf(operation), asked.pick(operation))
                    },
                    label = { Text(stringResource(steer.label)) },
                    enabled = !pending,
                )
            }
        }
        if (difficulty != STANDARD) {
            Text(
                text = difficultySentence(difficulty),
                modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        if (edits.hasFailed(PlanPart.Steering)) SaveFailedText()
    }
}

private class Steer(
    val label: Int,
    val active: Boolean,
    val operation: (active: Boolean) -> PlanOp,
)

private const val HARDER = "harder"
private const val EASIER = "easier"
private const val STANDARD = "standard"
private const val BALANCED = "balanced"
private const val MORE_PRACTICE = "morePractice"
private const val MORE_EXPLANATION = "moreExplanation"
