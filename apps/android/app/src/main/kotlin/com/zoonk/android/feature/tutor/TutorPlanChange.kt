package com.zoonk.android.feature.tutor

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.plan.PlanEffectDiff
import com.zoonk.android.feature.plan.PlanOp
import com.zoonk.android.feature.plan.op
import com.zoonk.android.feature.plan.planChangeAppliedLine
import com.zoonk.android.feature.plan.planChangeFootnote
import com.zoonk.android.feature.plan.planChangeKeepOfficialDateLabel
import com.zoonk.android.feature.plan.planChangeOfficialDateLine
import com.zoonk.android.feature.plan.planChangeSentence
import com.zoonk.android.ui.components.LabelChip
import com.zoonk.api.models.PlanChange
import com.zoonk.api.models.PlanChangeDecisionInput.Status as Decision

/** A change to the plan the buddy offers: the learner applies or declines it here, and may undo it once applied. */
@Composable
internal fun TutorPlanChange(
    change: PlanChange,
    deciding: Boolean,
    failed: Boolean,
    onDecide: (Decision) -> Unit,
    modifier: Modifier = Modifier,
) {
    val proposed = change.status == PlanChange.Status.PROPOSED
    val oneWeek = change.operations.map { it.op }.any { it is PlanOp.LightWeek || it is PlanOp.MoveWeeklyEvent }

    OutlinedCard(modifier.widthIn(max = TUTOR_CARD_MAX_WIDTH).fillMaxWidth()) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    stringResource(R.string.tutor_plan_change_title),
                    Modifier.weight(1f).semantics { heading() },
                    style = MaterialTheme.typography.titleSmall,
                )
                if (oneWeek) LabelChip(stringResource(R.string.tutor_plan_change_one_week))
            }

            Text(planChangeSentence(change), style = MaterialTheme.typography.bodyMedium)
            if (proposed) {
                PlanEffectDiff(change.effect)
                planChangeFootnote(change.effect)?.let {
                    Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
                }
            }
            planChangeOfficialDateLine(
                change,
            )?.let { Text(it, fontWeight = FontWeight.Medium, style = MaterialTheme.typography.bodyMedium) }

            statusLine(change)?.let {
                Text(
                    it,
                    Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }

            Decisions(change, deciding, onDecide)

            if (failed) {
                Text(
                    stringResource(R.string.tutor_plan_change_failed),
                    Modifier.semantics { liveRegion = LiveRegionMode.Assertive },
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        }
    }
}

@Composable
private fun statusLine(change: PlanChange): String? =
    when (change.status) {
        PlanChange.Status.APPLIED -> planChangeAppliedLine(change.todaySession)
        PlanChange.Status.DECLINED -> stringResource(R.string.tutor_plan_change_declined)
        PlanChange.Status.UNDONE -> stringResource(R.string.plan_change_undone)
        PlanChange.Status.REPLACED -> stringResource(R.string.tutor_plan_change_replaced)
        PlanChange.Status.PROPOSED -> null
    }

/** A change that would replace the exam's official date asks whether to keep it instead. */
@Composable
private fun Decisions(
    change: PlanChange,
    deciding: Boolean,
    onDecide: (Decision) -> Unit,
) {
    val overridesOfficialDate = change.officialDate != null

    when {
        change.status == PlanChange.Status.PROPOSED -> {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (change.canApply) {
                    Button(onClick = { onDecide(Decision.APPLIED) }, enabled = !deciding, modifier = Modifier.weight(1f)) {
                        Text(
                            stringResource(
                                if (overridesOfficialDate) R.string.tutor_plan_change_use_my_date else R.string.tutor_plan_change_apply,
                            ),
                        )
                    }
                }
                OutlinedButton(
                    onClick = { onDecide(Decision.DECLINED) },
                    enabled = !deciding,
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.onSurface),
                ) {
                    Text(
                        if (overridesOfficialDate) {
                            planChangeKeepOfficialDateLabel(change.examDocument)
                        } else {
                            stringResource(R.string.tutor_plan_change_not_now)
                        },
                    )
                }
            }
        }

        change.status == PlanChange.Status.APPLIED && change.canUndo -> {
            OutlinedButton(
                onClick = { onDecide(Decision.UNDONE) },
                enabled = !deciding,
                colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.onSurface),
            ) { Text(stringResource(R.string.tutor_plan_change_undo)) }
        }
    }
}
