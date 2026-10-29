package com.zoonk.android.feature.plan

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.key
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.components.Suggestion
import com.zoonk.android.ui.components.SuggestionAction
import com.zoonk.android.ui.components.SuggestionActions
import com.zoonk.android.ui.components.SuggestionDescription
import com.zoonk.android.ui.components.SuggestionHeader
import com.zoonk.android.ui.components.SuggestionLayout
import com.zoonk.android.ui.components.SuggestionMark
import com.zoonk.android.ui.components.SuggestionOpen
import com.zoonk.android.ui.components.SuggestionResult
import com.zoonk.android.ui.components.SuggestionSaveError
import com.zoonk.api.models.ExamChoice

/** Main's `PlanExamChoices`: until the learner picks an option of a choice, the plan leaves it out. */
@Composable
internal fun PlanExamChoices(
    page: PlanPageState,
    edits: PlanEdits,
    modifier: Modifier = Modifier,
) {
    val choices = page.plan.examChoices
    if (choices.isEmpty()) return
    Column(modifier, verticalArrangement = Arrangement.spacedBy(28.dp)) {
        choices.forEach { choice -> key(choice.group) { ExamChoiceOptions(choice, edits) } }
        if (edits.hasFailed(PlanPart.ExamChoices)) SaveFailedText()
    }
}

@Composable
private fun ExamChoiceOptions(
    choice: ExamChoice,
    edits: PlanEdits,
) {
    val shown =
        edits
            .asked(PlanPart.ExamChoices)
            .filterIsInstance<PlanOp.ExamChoice>()
            .firstOrNull { it.group == choice.group }
            ?.subject ?: choice.subject

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SectionLabel(choice.group)
        FlowRow(Modifier.selectableGroup(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            choice.options.forEach { option ->
                PlanChip(
                    text = option.shortName ?: option.name,
                    selected = option.name == shown,
                    onClick = { if (option.name != shown) edits.chooseExamOption(choice.group, option.name) {} },
                    role = Role.RadioButton,
                )
            }
        }
        if (choice.subject == null) {
            Text(
                text = stringResource(R.string.plan_exam_choice_left_out, choice.group),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

/**
 * Main's `ExamChoiceSuggestion`, for the plan's suggestion slot: each option saves at once. Once
 * [answer] (what the change did) is known it shows instead, with [undo].
 */
@Composable
internal fun ExamChoiceSuggestion(
    choice: ExamChoice,
    layout: SuggestionLayout,
    failed: Boolean,
    answer: String?,
    onChoose: (subject: String) -> Unit,
    modifier: Modifier = Modifier,
    undoFailed: Boolean = false,
    undo: @Composable () -> Unit = {},
) {
    val title = stringResource(R.string.plan_exam_choice_question, choice.group)

    Suggestion(
        label = title,
        summary = if (undoFailed) stringResource(R.string.suggestion_save_failed) else answer ?: title,
        layout = layout,
        modifier = modifier,
        mark = SuggestionMark.Symbol(R.drawable.ic_signpost),
        answered = answer != null,
        lineAction = if (answer != null) undo else ({ SuggestionOpen(stringResource(R.string.plan_choose)) }),
    ) {
        SuggestionHeader(title)
        if (answer != null) {
            SuggestionResult(answer)
            SuggestionActions(undo)
            if (undoFailed) SuggestionSaveError()
            return@Suggestion
        }
        SuggestionDescription(stringResource(R.string.plan_exam_choice_until_you_pick, choice.group))
        SuggestionActions {
            choice.options.forEach { option ->
                SuggestionAction(option.shortName ?: option.name, onClick = { onChoose(option.name) }, secondary = true)
            }
        }
        if (failed) SuggestionSaveError()
    }
}
