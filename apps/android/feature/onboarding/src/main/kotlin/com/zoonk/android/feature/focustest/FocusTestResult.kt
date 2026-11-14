package com.zoonk.android.feature.focustest

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.onboarding.setup.FinishFailed
import com.zoonk.android.feature.onboarding.setup.SetupContent
import com.zoonk.android.feature.onboarding.start.OnboardingActions
import com.zoonk.android.feature.plan.GoalDateKind
import com.zoonk.android.feature.plan.PlanEffectDiff
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.ButtonIcon
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.LocalButtonSize
import com.zoonk.android.ui.components.ModalBottomSheet
import com.zoonk.android.ui.components.SuccessEyebrow
import com.zoonk.android.ui.components.TextButton
import com.zoonk.android.ui.components.bleed
import com.zoonk.android.ui.components.labelInset
import com.zoonk.android.ui.theme.zoonkType
import com.zoonk.api.models.FocusTest
import com.zoonk.api.models.FocusTestFocus
import com.zoonk.api.models.FocusTestFocusRow
import com.zoonk.api.models.FocusTestSessionQuestions
import com.zoonk.api.models.FocusTestSubject
import com.zoonk.api.models.PlanChange
import com.zoonk.api.models.PlanChangeDecisionInput

/** What the result can do on a plan that's already the learner's: answer its proposal, change its focus, pause its questions. */
internal class PlanControls(
    val answer: ProposalAnswer?,
    val repriced: PlanChange?,
    val deciding: PlanChangeDecisionInput.Status?,
    val failed: Boolean,
    val onDecide: (PlanChange, PlanChangeDecisionInput.Status) -> Unit,
    val onChangeFocus: () -> Unit,
    val questions: SessionQuestionsModel,
)

internal fun displayName(
    name: String,
    shortName: String?,
) = shortName ?: name

/** A proposal still waiting for the learner's answer, which then is the screen's question. */
internal fun FocusTestFocus.waitingProposal(plan: PlanControls?): PlanChange? =
    (plan?.repriced ?: proposal)?.takeIf { plan != null && plan.answer == null && state == FocusTestFocus.State.PROPOSED && it.canApply }

/** The test's result: where to focus, or where the plan starts. On a plan, a proposal asks first. */
@Composable
internal fun ColumnScope.FocusTestCheckpoint(
    test: FocusTest,
    plan: PlanControls?,
    canContinue: Boolean,
    pressed: Pressed?,
    failed: Boolean,
    onDone: () -> Unit,
    onContinueTest: () -> Unit,
) {
    val checkpoint = test.checkpoint ?: return
    val focus = checkpoint.focus?.takeIf { it.rows.isNotEmpty() }
    val proposal = focus?.waitingProposal(plan)
    if (plan != null && focus != null && proposal != null) {
        FocusProposal(focus.rows, proposal, plan)
        return
    }

    val lessons = checkpoint.lessonsSkipped.toInt()
    val answer = plan?.answer
    SetupContent {
        TestHeader(
            title = stringResource(if (focus != null) R.string.focustest_result_title else R.string.focustest_starting_point_title),
            description = answer?.let { outcomeLine(it) } ?: resultLine(focus, lessons, onPlan = plan != null),
            eyebrow = { if (plan == null) SuccessEyebrow(stringResource(R.string.focustest_answers_saved)) else TestEyebrow() },
            announced = answer != null,
        )
        if (plan != null && answer != null) Undo(answer, plan)
        if (focus != null) {
            FocusRows(focus.rows)
            if (lessons > 0) Note(pluralStringResource(R.plurals.focustest_also_skips, lessons, lessons))
        }
        if (plan != null) PlanRows(test, plan, changesFocus = focus != null && focus.state != FocusTestFocus.State.IF_TIME_SHORT)
        OnboardingActions {
            FinishFailed(failed || plan?.failed == true)
            Button(
                busy = pressed == Pressed.Main,
                onClick = onDone,
                modifier = Modifier.fillMaxWidth(),
                enabled = pressed != Pressed.Other,
            ) {
                Text(stringResource(if (plan == null) R.string.focustest_continue else R.string.focustest_done))
            }
            if (plan != null && canContinue) {
                TextButton(
                    busy = pressed == Pressed.Other,
                    onClick = onContinueTest,
                    modifier = Modifier.fillMaxWidth(),
                    enabled = pressed != Pressed.Main,
                ) {
                    Text(stringResource(R.string.focustest_answer_more))
                }
            }
        }
    }
}

/** One line under the headline: why these subjects, or what the plan already does with them. */
@Composable
private fun resultLine(
    focus: FocusTestFocus?,
    lessons: Int,
    onPlan: Boolean,
): String =
    when {
        focus == null && lessons > 0 -> pluralStringResource(R.plurals.focustest_lessons_skipped, lessons, lessons)
        focus == null -> stringResource(R.string.focustest_from_basics)
        onPlan && focus.state == FocusTestFocus.State.CURRENT -> stringResource(R.string.focustest_result_current)
        onPlan && focus.state == FocusTestFocus.State.HAND_PICKED -> stringResource(R.string.focustest_result_hand_picked)
        onPlan && focus.state == FocusTestFocus.State.DECLINED -> stringResource(R.string.focustest_result_declined)
        else -> stringResource(R.string.focustest_result_description)
    }

/** The subjects that need the most time, most needed first. */
@Composable
private fun FocusRows(rows: List<FocusTestFocusRow>) {
    Column(Modifier.bleed(LIST_ITEM_INSET)) {
        rows.forEachIndexed { index, row ->
            if (index > 0) HorizontalDivider()
            ListRow(
                headline = { Text(displayName(row.subject.name, row.subject.shortName)) },
                leading = {
                    Text(
                        "${index + 1}",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.zoonkType.data,
                    )
                },
            )
        }
    }
}

/** The test asking before it changes a plan the learner already has; the diff says what "Update my plan" does. */
@Composable
private fun ColumnScope.FocusProposal(
    rows: List<FocusTestFocusRow>,
    proposal: PlanChange,
    plan: PlanControls,
) {
    val pending = plan.deciding != null
    SetupContent {
        TestHeader(stringResource(R.string.focustest_proposal_title), stringResource(R.string.focustest_proposal_description))
        FocusRows(rows)
        PlanEffectDiff(proposal.effect, dateKind = GoalDateKind.Exam, repriced = plan.repriced != null)
        OnboardingActions {
            FinishFailed(plan.failed)
            Button(
                onClick = { plan.onDecide(proposal, PlanChangeDecisionInput.Status.APPLIED) },
                modifier = Modifier.fillMaxWidth(),
                busy = plan.deciding == PlanChangeDecisionInput.Status.APPLIED,
                enabled = !pending,
            ) {
                Text(stringResource(R.string.focustest_update_plan))
            }
            TextButton(
                onClick = { plan.onDecide(proposal, PlanChangeDecisionInput.Status.DECLINED) },
                modifier = Modifier.fillMaxWidth(),
                busy = plan.deciding == PlanChangeDecisionInput.Status.DECLINED,
                enabled = !pending,
            ) {
                Text(stringResource(R.string.focustest_not_now))
            }
        }
    }
}

/** What the learner's answer to the proposal did, in place of the result's line. */
@Composable
private fun outcomeLine(answer: ProposalAnswer): String =
    stringResource(
        when (answer.status) {
            PlanChangeDecisionInput.Status.APPLIED -> R.string.focustest_proposal_applied
            PlanChangeDecisionInput.Status.UNDONE -> R.string.focustest_proposal_undone
            else -> R.string.focustest_proposal_declined
        },
    )

@Composable
private fun Undo(
    answer: ProposalAnswer,
    plan: PlanControls,
) {
    if (answer.status != PlanChangeDecisionInput.Status.APPLIED || !answer.change.canUndo) return
    TextButton(
        onClick = { plan.onDecide(answer.change, PlanChangeDecisionInput.Status.UNDONE) },
        modifier = Modifier.bleed(LocalButtonSize.current.labelInset),
        busy = plan.deciding == PlanChangeDecisionInput.Status.UNDONE,
        leadingIcon = { ButtonIcon(R.drawable.ic_undo) },
    ) {
        Text(stringResource(R.string.focustest_undo))
    }
}

/** The learner's choices about the result on their plan. The pause shows while sessions still have questions to ask. */
@Composable
private fun PlanRows(
    test: FocusTest,
    plan: PlanControls,
    changesFocus: Boolean,
) {
    var subjects by rememberSaveable { mutableStateOf(false) }
    val questions = plan.questions.shown(test)

    Column {
        Column(Modifier.bleed(LIST_ITEM_INSET)) {
            if (changesFocus) {
                ListRow(headline = { Text(stringResource(R.string.focustest_change_focus)) }, onClick = plan.onChangeFocus)
                HorizontalDivider()
            }
            ListRow(headline = { Text(stringResource(R.string.focustest_see_all_subjects)) }, onClick = { subjects = true })
            if (questions != FocusTestSessionQuestions.OFF) {
                val on = questions != FocusTestSessionQuestions.PAUSED
                HorizontalDivider()
                ListRow(
                    headline = { Text(stringResource(R.string.focustest_session_questions)) },
                    modifier =
                        Modifier.toggleable(
                            value = on,
                            enabled = !plan.questions.saving,
                            role = Role.Switch,
                            onValueChange = { plan.questions.set(test, it) },
                        ),
                    supporting = { Text(stringResource(R.string.focustest_session_questions_when)) },
                    trailing = { Switch(checked = on, onCheckedChange = null, enabled = !plan.questions.saving) },
                )
            }
        }
        FinishFailed(plan.questions.failed(test))
    }

    if (subjects) {
        FocusTestSheet(stringResource(R.string.focustest_subjects), onDismiss = { subjects = false }) { SubjectsList(test.subjects) }
    }
}

/** "How it works": what a learner may want to know before starting, for whoever asks. */
@Composable
internal fun HowItWorks(suggestsFocus: Boolean) {
    var open by rememberSaveable { mutableStateOf(false) }
    val title = stringResource(R.string.focustest_how_it_works)
    TextButton(onClick = { open = true }, modifier = Modifier.bleed(LocalButtonSize.current.labelInset)) { Text(title) }
    if (open) FocusTestSheet(title, onDismiss = { open = false }) { HowItWorksRows(suggestsFocus) }
}

@Composable
internal fun HowItWorksRows(suggestsFocus: Boolean) {
    val rows =
        listOfNotNull(
            R.string.focustest_how_weight_title to R.string.focustest_how_weight,
            R.string.focustest_how_grade_title to R.string.focustest_how_grade,
            R.string.focustest_how_stop_title to R.string.focustest_how_stop,
            (R.string.focustest_how_subjects_title to R.string.focustest_how_subjects).takeIf { suggestsFocus },
            R.string.focustest_how_sessions_title to R.string.focustest_how_sessions,
        )
    Column(Modifier.bleed(LIST_ITEM_INSET)) {
        rows.forEachIndexed { index, (title, line) ->
            if (index > 0) HorizontalDivider()
            ListRow(headline = { Text(stringResource(title)) }, supporting = { Text(stringResource(line)) })
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FocusTestSheet(
    title: String,
    onDismiss: () -> Unit,
    content: @Composable ColumnScope.() -> Unit,
) {
    ModalBottomSheet(onDismissRequest = onDismiss, modifier = Modifier.semantics { paneTitle = title }) {
        Text(
            title,
            Modifier.padding(horizontal = SHEET_MARGIN).semantics { heading() },
            style = MaterialTheme.typography.titleLarge,
        )
        Column(
            Modifier.verticalScroll(rememberScrollState()).padding(start = SHEET_MARGIN, end = SHEET_MARGIN, top = 8.dp, bottom = 24.dp),
            content = content,
        )
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

/** Every subject, in the notice's order, with what the test found on it so far. */
@Composable
internal fun SubjectsList(subjects: List<FocusTestSubject>) {
    Column(Modifier.bleed(LIST_ITEM_INSET)) {
        subjects.forEachIndexed { index, subject ->
            if (index > 0) HorizontalDivider()
            ListRow(
                headline = { Text(displayName(subject.name, subject.shortName)) },
                meta = { Text(subjectState(subject), color = MaterialTheme.colorScheme.onSurfaceVariant) },
            )
        }
    }
}

private val SHEET_MARGIN = 24.dp
