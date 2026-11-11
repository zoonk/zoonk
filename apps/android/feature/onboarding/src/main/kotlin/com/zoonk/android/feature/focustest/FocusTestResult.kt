package com.zoonk.android.feature.focustest

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.onboarding.setup.FinishFailed
import com.zoonk.android.feature.plan.PlanEffectDiff
import com.zoonk.android.feature.plan.planChangeProposalEffect
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.ButtonIcon
import com.zoonk.android.ui.components.ButtonSize
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.LocalButtonSize
import com.zoonk.android.ui.components.ModalBottomSheet
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.components.TextButton
import com.zoonk.android.ui.components.bleed
import com.zoonk.android.ui.components.leadingIconInset
import com.zoonk.android.ui.components.textInset
import com.zoonk.android.ui.format.joinSentences
import com.zoonk.api.models.FocusTest
import com.zoonk.api.models.FocusTestFocus
import com.zoonk.api.models.FocusTestFocusRow
import com.zoonk.api.models.FocusTestSessionQuestions
import com.zoonk.api.models.FocusTestSubject
import com.zoonk.api.models.PlanChange
import com.zoonk.api.models.PlanChangeDecisionInput

/** What a checkpoint on a plan the learner already has can do about its focus. */
internal class ProposalControls(
    val answer: ProposalAnswer?,
    val deciding: PlanChangeDecisionInput.Status?,
    val failed: Boolean,
    val onDecide: (PlanChange, PlanChangeDecisionInput.Status) -> Unit,
    val onChangeFocus: () -> Unit,
)

/** A proposal the learner can still apply, whose "Update my plan" is then the screen's one filled button. */
internal fun ProposalControls?.waitsOn(test: FocusTest): Boolean =
    this != null &&
        answer == null &&
        test.checkpoint
            ?.focus
            ?.takeIf { it.state == FocusTestFocus.State.PROPOSED }
            ?.proposal
            ?.canApply == true

internal fun displayName(
    name: String,
    shortName: String?,
) = shortName ?: name

/** "Your starting plan" without its title and actions: where the plan starts, its suggested focus and every subject. */
@Composable
internal fun FocusTestResult(
    test: FocusTest,
    plan: ProposalControls?,
) {
    val checkpoint = test.checkpoint ?: return
    val lessons = checkpoint.lessonsSkipped.toInt()

    Section(stringResource(R.string.focustest_where_you_start)) {
        Text(
            if (lessons > 0) {
                pluralStringResource(R.plurals.focustest_lessons_skipped, lessons, lessons)
            } else {
                stringResource(R.string.focustest_from_basics)
            },
            style = MaterialTheme.typography.bodyMedium,
        )
    }

    checkpoint.focus?.takeIf { it.rows.isNotEmpty() }?.let { SuggestedFocus(it, plan) }

    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        SubjectsButton(test.subjects, answered = true)
        if (test.sessionQuestions == FocusTestSessionQuestions.ON) {
            Text(
                stringResource(R.string.focustest_session_questions_on),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
    }
}

@Composable
private fun Section(
    title: String,
    content: @Composable () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionHeader(title)
        content()
    }
}

@Composable
private fun focusIntro(state: FocusTestFocus.State): String =
    stringResource(
        when (state) {
            FocusTestFocus.State.IF_TIME_SHORT -> R.string.focustest_focus_if_short
            FocusTestFocus.State.PROPOSED -> R.string.focustest_focus_proposed
            FocusTestFocus.State.CURRENT -> R.string.focustest_focus_current
            FocusTestFocus.State.ALREADY_FITS -> R.string.focustest_focus_already_fits
            FocusTestFocus.State.HAND_PICKED -> R.string.focustest_focus_hand_picked
        },
    )

/** The row's title already names the subject, so no reason says it again. */
@Composable
private fun reasonText(reason: FocusTestFocusRow.Reason): String =
    stringResource(
        when (reason) {
            FocusTestFocusRow.Reason.ANSWERS -> R.string.focustest_reason_answers
            FocusTestFocusRow.Reason.MINIMUM_SCORE -> R.string.focustest_reason_minimum_score
            FocusTestFocusRow.Reason.NOT_CHECKED -> R.string.focustest_reason_not_checked
            FocusTestFocusRow.Reason.NOT_ASKED -> R.string.focustest_reason_not_asked
            FocusTestFocusRow.Reason.WEIGHT -> R.string.focustest_reason_weight
        },
    )

@Composable
private fun SuggestedFocus(
    focus: FocusTestFocus,
    plan: ProposalControls?,
) {
    val importance = stringResource(R.string.focustest_focus_importance).takeIf { focus.basis == FocusTestFocus.Basis.IMPORTANCE }
    val proposal = focus.proposal?.takeIf { focus.state == FocusTestFocus.State.PROPOSED }
    val changesFocus = focus.state == FocusTestFocus.State.CURRENT || focus.state == FocusTestFocus.State.HAND_PICKED

    Section(stringResource(R.string.focustest_suggested_focus)) {
        Text(
            listOfNotNull(focusIntro(focus.state), importance).joinSentences(),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
        Column(Modifier.bleed(LIST_ITEM_INSET)) {
            focus.rows.forEachIndexed { index, row ->
                if (index > 0) HorizontalDivider()
                ListRow(
                    headline = { Text(displayName(row.subject.name, row.subject.shortName)) },
                    supporting = { Text(reasonText(row.reason)) },
                )
            }
        }
        if (plan != null && proposal != null) Proposal(proposal, plan)
        if (plan != null && changesFocus) {
            TextButton(
                onClick = plan.onChangeFocus,
                modifier = Modifier.offset(x = -LocalButtonSize.current.leadingIconInset),
                leadingIcon = { ButtonIcon(R.drawable.ic_my_location) },
            ) {
                Text(stringResource(R.string.focustest_change_focus))
            }
        }
    }
}

/** The test's suggestion for a plan that's already the learner's: their call, with what it changes. */
@Composable
private fun Proposal(
    proposal: PlanChange,
    plan: ProposalControls,
) {
    val answer = plan.answer?.takeIf { it.change.id == proposal.id }
    val pending = plan.deciding != null

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (answer?.status != PlanChangeDecisionInput.Status.APPLIED) {
            planChangeProposalEffect(proposal.effect, besideDiff = true)?.let {
                Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
            }
            PlanEffectDiff(proposal.effect)
        }

        if (answer == null) {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (proposal.canApply) {
                    Button(
                        onClick = { plan.onDecide(proposal, PlanChangeDecisionInput.Status.APPLIED) },
                        busy = plan.deciding == PlanChangeDecisionInput.Status.APPLIED,
                        enabled = !pending,
                        focusableWhenDisabled = pending,
                        size = ButtonSize.Small,
                    ) {
                        Text(stringResource(R.string.focustest_update_plan))
                    }
                }
                OutlinedButton(
                    onClick = { plan.onDecide(proposal, PlanChangeDecisionInput.Status.DECLINED) },
                    busy = plan.deciding == PlanChangeDecisionInput.Status.DECLINED,
                    enabled = !pending,
                    focusableWhenDisabled = pending,
                    size = ButtonSize.Small,
                ) {
                    Text(stringResource(R.string.focustest_not_now))
                }
            }
        } else {
            ProposalOutcome(answer, plan)
        }

        FinishFailed(plan.failed)
    }
}

@Composable
private fun ProposalOutcome(
    answer: ProposalAnswer,
    plan: ProposalControls,
) {
    val said = Modifier.semantics { liveRegion = LiveRegionMode.Polite }
    when (answer.status) {
        PlanChangeDecisionInput.Status.APPLIED -> {
            FlowRow(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalArrangement = Arrangement.spacedBy(8.dp),
                itemVerticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    stringResource(R.string.focustest_proposal_applied),
                    said.padding(end = 12.dp),
                    style = MaterialTheme.typography.bodyMedium,
                )
                if (answer.change.canUndo) {
                    OutlinedButton(
                        onClick = { plan.onDecide(answer.change, PlanChangeDecisionInput.Status.UNDONE) },
                        busy = plan.deciding == PlanChangeDecisionInput.Status.UNDONE,
                        size = ButtonSize.Small,
                        leadingIcon = { ButtonIcon(R.drawable.ic_undo) },
                    ) {
                        Text(stringResource(R.string.focustest_undo))
                    }
                }
            }
        }

        PlanChangeDecisionInput.Status.UNDONE -> {
            Text(stringResource(R.string.focustest_proposal_undone), said, style = MaterialTheme.typography.bodyMedium)
        }

        else -> {
            Text(stringResource(R.string.focustest_proposal_declined), said, style = MaterialTheme.typography.bodyMedium)
        }
    }
}

@Composable
private fun subjectState(subject: FocusTestSubject): String =
    when (subject.state) {
        FocusTestSubject.State.ANSWERED -> {
            val chosen = (subject.asked - subject.dontKnow).toInt()
            if (chosen == 0) {
                stringResource(R.string.focustest_not_known_yet)
            } else {
                pluralStringResource(R.plurals.focustest_subject_right, subject.right.toInt(), subject.right.toInt(), chosen)
            }
        }

        FocusTestSubject.State.NOT_ASKED -> {
            stringResource(R.string.focustest_not_asked_yet)
        }

        FocusTestSubject.State.NOT_CHECKED -> {
            stringResource(
                when (subject.part) {
                    FocusTestSubject.Part.WRITTEN -> R.string.focustest_written_not_checked
                    FocusTestSubject.Part.LISTENING -> R.string.focustest_listening_not_checked
                    FocusTestSubject.Part.SPEAKING -> R.string.focustest_speaking_not_checked
                    FocusTestSubject.Part.PRACTICAL, null -> R.string.focustest_practical_not_checked
                },
            )
        }
    }

/**
 * Every subject, in the notice's order, in plain words. Before the first answer every quick subject
 * would read "Not asked yet", so only what the test can't check is said.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun SubjectsButton(
    subjects: List<FocusTestSubject>,
    answered: Boolean,
) {
    var open by rememberSaveable { mutableStateOf(false) }
    TextButton(onClick = { open = true }, modifier = Modifier.bleed(LocalButtonSize.current.textInset)) {
        Text(stringResource(if (answered) R.string.focustest_view_all_subjects else R.string.focustest_view_subjects))
    }
    if (!open) return

    val title = stringResource(R.string.focustest_subjects)
    ModalBottomSheet(onDismissRequest = { open = false }, modifier = Modifier.semantics { paneTitle = title }) {
        Text(
            title,
            Modifier.padding(horizontal = SHEET_MARGIN).semantics { heading() },
            style = MaterialTheme.typography.titleLarge,
        )
        Column(
            Modifier.verticalScroll(rememberScrollState()).padding(start = SHEET_MARGIN, end = SHEET_MARGIN, top = 8.dp, bottom = 24.dp),
        ) {
            Column(Modifier.bleed(LIST_ITEM_INSET)) {
                subjects.forEachIndexed { index, subject ->
                    if (index > 0) HorizontalDivider()
                    ListRow(
                        headline = { Text(displayName(subject.name, subject.shortName)) },
                        meta =
                            if (answered || subject.state == FocusTestSubject.State.NOT_CHECKED) {
                                { Text(subjectState(subject), color = MaterialTheme.colorScheme.onSurfaceVariant) }
                            } else {
                                null
                            },
                    )
                }
            }
        }
    }
}

private val SHEET_MARGIN = 24.dp
