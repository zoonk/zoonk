package com.zoonk.android.feature.plan

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.ButtonIcon
import com.zoonk.android.ui.components.SelectionChip
import com.zoonk.android.ui.components.Suggestion
import com.zoonk.android.ui.components.SuggestionAction
import com.zoonk.android.ui.components.SuggestionActions
import com.zoonk.android.ui.components.SuggestionDescription
import com.zoonk.android.ui.components.SuggestionHeader
import com.zoonk.android.ui.components.SuggestionLayout
import com.zoonk.android.ui.components.SuggestionMark
import com.zoonk.android.ui.components.SuggestionOpen
import com.zoonk.android.ui.components.SuggestionSaveError
import com.zoonk.android.ui.components.statusLink
import com.zoonk.api.models.ExamChoice

/** Main's `PlanExamChoices`: each choice's options under its group's name, saved as they're picked. */
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
    val pending = edits.isPending(PlanPart.ExamChoices)

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SectionLabel(choice.group)
        if (choice.take > 1) {
            ExamChoicePicks(choice, saving = false, enabled = !pending, onSave = { edits.chooseExamOption(choice.group, it, null) })
        } else {
            val shown =
                edits
                    .asked(PlanPart.ExamChoices)
                    .filterIsInstance<PlanOp.ExamChoice>()
                    .firstOrNull { it.group == choice.group }
                    ?.subjects ?: choice.subjects
            FlowRow(Modifier.selectableGroup(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                choice.options.forEach { option ->
                    SelectionChip(
                        text = option.shortName ?: option.name,
                        selected = option.name in shown,
                        onClick = { if (option.name !in shown) edits.chooseExamOption(choice.group, listOf(option.name), null) },
                        role = Role.RadioButton,
                        enabled = !pending,
                    )
                }
            }
        }
    }
}

/**
 * Main's `ExamChoicePicks`: the options of a choice whose candidates take several, saved together so
 * the plan isn't rebuilt on every tick. [saving] is this Save's own request; [enabled] off waits for
 * another control's. Today draws [save] as its suggestions' main answer.
 */
@Composable
fun ExamChoicePicks(
    choice: ExamChoice,
    saving: Boolean,
    onSave: (subjects: List<String>) -> Unit,
    enabled: Boolean = true,
    save: @Composable (onClick: () -> Unit, enabled: Boolean) -> Unit = { onClick, canSave ->
        Button(busy = saving, onClick = onClick, enabled = canSave) { Text(stringResource(R.string.plan_save)) }
    },
) {
    var draft by rememberSaveable(choice.subjects) { mutableStateOf(choice.subjects) }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            text = stringResource(R.string.exam_choice_pick_up_to, choice.take),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            choice.options.forEach { option ->
                val picked = option.name in draft
                SelectionChip(
                    text = option.shortName ?: option.name,
                    selected = picked,
                    onClick = { draft = choice.toggled(draft, option.name) },
                    role = Role.Checkbox,
                    enabled = enabled && !saving && (picked || !choice.isFull(draft)),
                )
            }
        }
        save({ onSave(draft) }, enabled && choice.canSave(draft))
    }
}

internal fun ExamChoice.isFull(picked: List<String>) = picked.size >= take

/** [picked] with [option] ticked or unticked, in the notice's order. */
fun ExamChoice.toggled(
    picked: List<String>,
    option: String,
): List<String> =
    when {
        option in picked -> picked - option
        isFull(picked) -> picked
        else -> options.map { it.name }.filter { it in picked || it == option }
    }

internal fun ExamChoice.canSave(draft: List<String>) = draft.isNotEmpty() && draft.toSet() != subjects.toSet()

internal fun ExamChoice.pickedNames(): List<String> = options.filter { it.name in subjects }.map { it.shortName ?: it.name }

/** Main's `PlanChoiceLines`: which options of each exam choice the plan follows, with Change; an unpicked choice is the suggestion's. */
@Composable
fun PlanChoiceLines(
    choices: List<ExamChoice>,
    onChange: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val picked = choices.filter { it.subjects.isNotEmpty() }
    if (picked.isEmpty()) return
    Column(modifier) {
        picked.forEach { choice ->
            key(choice.group) {
                val line = stringResource(R.string.plan_choice_picked, choice.group, joinList(choice.pickedNames()))
                val link = statusLink(stringResource(R.string.plan_choice_change), onChange)
                val ink = MaterialTheme.colorScheme.onSurface
                // One sentence with the change inline, as main's: "Foreign language: Inglês · Change".
                Text(
                    text =
                        buildAnnotatedString {
                            append(line)
                            append("\u00A0·\u00A0")
                            withStyle(SpanStyle(color = ink)) { append(link) }
                        },
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

/** Main's `useExamChoiceQuestion`: the question an exam choice asks, on the Plan and on Today alike. */
@Composable
fun examChoiceQuestion(choice: ExamChoice): String =
    stringResource(
        if (choice.take > 1) R.string.plan_exam_choice_question_several else R.string.plan_exam_choice_question,
        choice.group,
    )

/**
 * Main's `ExamChoiceSuggestion`, for the plan's suggestion slot: each option saves at once, or the
 * options taken together once saved. Once the [answer] shows, it says what the change did instead, with Undo.
 */
@Composable
internal fun ExamChoiceSuggestion(
    choice: ExamChoice,
    layout: SuggestionLayout,
    failed: Boolean,
    pending: Boolean,
    answer: SlotAnswer?,
    onChoose: (subjects: List<String>) -> Unit,
    modifier: Modifier = Modifier,
) {
    val title = examChoiceQuestion(choice)

    Suggestion(
        label = title,
        summary = answer?.text ?: title,
        layout = layout,
        modifier = modifier,
        mark = SuggestionMark.Symbol(R.drawable.ic_signpost),
        answered = answer != null,
        failed = answer?.failed == true,
        lineAction = if (answer != null) ({ answer.Undo() }) else ({ SuggestionOpen(stringResource(R.string.plan_choose)) }),
    ) {
        SuggestionHeader(title)
        if (answer != null) {
            answer.Result()
            return@Suggestion
        }
        SuggestionDescription(stringResource(R.string.exam_choice_left_out))
        if (choice.take > 1) {
            ExamChoicePicks(choice, saving = false, enabled = !pending, onSave = onChoose)
        } else {
            SuggestionActions {
                choice.options.forEach { option ->
                    SuggestionAction(
                        option.shortName ?: option.name,
                        onClick = { onChoose(listOf(option.name)) },
                        enabled = !pending,
                        secondary = true,
                    )
                }
            }
        }
        if (failed) SuggestionSaveError()
    }
}
