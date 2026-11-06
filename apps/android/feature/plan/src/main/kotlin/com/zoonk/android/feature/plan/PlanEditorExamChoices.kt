package com.zoonk.android.feature.plan

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.components.BusyButton
import com.zoonk.android.ui.components.Suggestion
import com.zoonk.android.ui.components.SuggestionAction
import com.zoonk.android.ui.components.SuggestionActions
import com.zoonk.android.ui.components.SuggestionDescription
import com.zoonk.android.ui.components.SuggestionHeader
import com.zoonk.android.ui.components.SuggestionLayout
import com.zoonk.android.ui.components.SuggestionMark
import com.zoonk.android.ui.components.SuggestionOpen
import com.zoonk.android.ui.components.SuggestionSaveError
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.api.models.ExamChoice

/** Main's `PlanExamChoices`: until the learner picks the options of a choice, the plan and mocks leave it out. */
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
            ExamChoicePicks(choice, saving = false, enabled = !pending, onSave = { edits.chooseExamOption(choice.group, it) {} })
        } else {
            val shown =
                edits
                    .asked(PlanPart.ExamChoices)
                    .filterIsInstance<PlanOp.ExamChoice>()
                    .firstOrNull { it.group == choice.group }
                    ?.subjects ?: choice.subjects
            FlowRow(Modifier.selectableGroup(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                choice.options.forEach { option ->
                    PlanChip(
                        text = option.shortName ?: option.name,
                        selected = option.name in shown,
                        onClick = { if (option.name !in shown) edits.chooseExamOption(choice.group, listOf(option.name)) {} },
                        role = Role.RadioButton,
                        enabled = !pending,
                    )
                }
            }
        }
        if (choice.subjects.isEmpty()) {
            Text(
                text = examChoiceLeftOut(choice),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

/**
 * Main's `ExamChoicePicks`: the options of a choice whose candidates take several, saved together so
 * the plan isn't rebuilt on every tick. [saving] is this Save's own request; [enabled] off waits for
 * another control's.
 */
@Composable
fun ExamChoicePicks(
    choice: ExamChoice,
    saving: Boolean,
    onSave: (subjects: List<String>) -> Unit,
    enabled: Boolean = true,
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
                PlanChip(
                    text = option.shortName ?: option.name,
                    selected = picked,
                    onClick = { draft = choice.toggled(draft, option.name) },
                    role = Role.Checkbox,
                    enabled = enabled && !saving && (picked || !choice.isFull(draft)),
                )
            }
        }
        BusyButton(saving, { onSave(draft) }, enabled = enabled && choice.canSave(draft)) { Text(stringResource(R.string.plan_save)) }
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

/** Main's `PlanChoiceLines`: which options of each exam choice the plan follows, or what it leaves out until they're picked. */
@Composable
fun PlanChoiceLines(
    choices: List<ExamChoice>,
    onChange: () -> Unit,
    modifier: Modifier = Modifier,
) {
    if (choices.isEmpty()) return
    Column(modifier) {
        choices.forEach { choice ->
            key(choice.group) {
                val picked = choice.pickedNames()
                Text(
                    text =
                        if (picked.isEmpty()) {
                            examChoiceLeftOut(choice)
                        } else {
                            stringResource(R.string.plan_choice_following, joinList(picked))
                        },
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                TextButton(onClick = onChange) {
                    Text(stringResource(if (picked.isEmpty()) R.string.plan_choose else R.string.plan_choice_change))
                }
            }
        }
    }
}

/** Main's `useChoiceLeftOutLine`: what the plan and mocks leave out until the learner picks an option. */
@Composable
fun examChoiceLeftOut(choice: ExamChoice): String {
    val leftOut = choice.leftOut
    val locale = currentLocale()
    val number = { value: Long -> formatNumber(value.toDouble(), locale) }
    val points = leftOut.points
    val examPoints = leftOut.examPoints
    val questions = leftOut.questions
    val examQuestions = leftOut.examQuestions

    return when {
        points != null && examPoints != null -> {
            stringResource(R.string.plan_exam_choice_left_out_points, leftOut.name, number(points), number(examPoints))
        }

        questions != null && examQuestions != null -> {
            stringResource(R.string.plan_exam_choice_left_out_questions_of, leftOut.name, number(questions), number(examQuestions))
        }

        questions != null -> {
            pluralStringResource(R.plurals.plan_exam_choice_left_out_questions, questions.toInt(), leftOut.name, number(questions))
        }

        else -> {
            stringResource(R.string.plan_exam_choice_left_out, leftOut.name)
        }
    }
}

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
    val title =
        stringResource(
            if (choice.take >
                1
            ) {
                R.string.plan_exam_choice_question_several
            } else {
                R.string.plan_exam_choice_question
            },
            choice.group,
        )

    Suggestion(
        label = title,
        summary = answer?.summary() ?: title,
        layout = layout,
        modifier = modifier,
        mark = SuggestionMark.Symbol(R.drawable.ic_signpost),
        answered = answer != null,
        lineAction = if (answer != null) ({ answer.Undo() }) else ({ SuggestionOpen(stringResource(R.string.plan_choose)) }),
    ) {
        SuggestionHeader(title)
        if (answer != null) {
            answer.Result()
            return@Suggestion
        }
        SuggestionDescription(examChoiceLeftOut(choice))
        if (choice.take > 1) {
            ExamChoicePicks(choice, pending, onSave = onChoose)
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
