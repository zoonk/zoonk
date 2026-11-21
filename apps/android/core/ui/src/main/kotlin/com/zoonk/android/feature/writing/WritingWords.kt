package com.zoonk.android.feature.writing

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.components.ButtonSize
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.format.formatList
import java.time.LocalDate

/**
 * A writing task by the name a learner knows it: a drill as its own short exercise, a whole answer
 * by its line limit when no other question shares it ("Write the 30-line question"), else by its
 * place ("Write question 2"). Without a task's name, its [lines] name it when known, else [fallback]
 * (the block's own title) stands.
 */
@Composable
fun writingTaskTitle(
    drill: Boolean,
    task: WritingTaskName?,
    fallback: String?,
    lines: Int? = null,
): String {
    val limit = task?.lines
    return when {
        drill -> stringResource(R.string.essay_short_exercise)
        task != null && task.distinctLines && limit != null -> stringResource(R.string.essay_write_lines_question, limit)
        task != null && task.total > 1 -> stringResource(R.string.essay_write_question_number, task.number)
        task != null -> stringResource(R.string.essay_write_the_question)
        lines != null -> stringResource(R.string.essay_write_lines_question, lines)
        else -> fallback ?: stringResource(R.string.essay_writing_practice)
    }
}

/**
 * A task named where it labels something rather than asks for it, such as its points on the written
 * test's page: "The 30-line question", "Question 2", or [fallback], the notice's name, without its place.
 */
@Composable
fun writingTaskName(
    task: WritingTaskName?,
    fallback: String,
): String {
    val lines = task?.lines
    return when {
        task != null && task.distinctLines && lines != null -> stringResource(R.string.essay_lines_question, lines)
        task != null && task.total > 1 -> stringResource(R.string.essay_question_number, task.number)
        task != null -> stringResource(R.string.essay_the_question)
        else -> fallback
    }
}

/**
 * The one line a row shows when the day's grading is used up, under the row it limits: "Back
 * tomorrow: no more grading today", or the day it returns when that's later.
 */
@Composable
fun gradingReturnsLine(
    returnsOn: LocalDate?,
    today: LocalDate = LocalDate.now(),
): String =
    if (returnsOn == null || !returnsOn.isAfter(today.plusDays(1))) {
        stringResource(R.string.essay_back_tomorrow)
    } else {
        stringResource(R.string.essay_back_on, formatDate(returnsOn, currentLocale(), today = today))
    }

/** A written task that waits for an exam choice says which, on the row it limits. */
@Composable
fun choiceLine(choiceGroups: List<String>): String =
    stringResource(R.string.essay_depends_on_choice, formatList(choiceGroups, currentLocale()))

/**
 * Today asks the exam's open choices ("which one will you take?"), so a written task waiting for
 * one leads there, beside what can still be written. [task] names the one question that waits when
 * others don't. When nothing can be written before the choice, "Choose on Today" is the main action.
 */
@Composable
fun ChooseOnToday(
    choiceGroups: List<String>,
    onChoose: () -> Unit,
    modifier: Modifier = Modifier,
    task: String? = null,
) {
    val groups = formatList(choiceGroups, currentLocale())
    FlowRow(
        modifier.semantics { liveRegion = LiveRegionMode.Polite },
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        itemVerticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            if (task != null) {
                stringResource(R.string.essay_task_depends_on_choice, task, groups)
            } else {
                stringResource(R.string.essay_depends_on_choice, groups)
            },
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
        OutlinedButton(onClick = onChoose, size = ButtonSize.Small) { Text(stringResource(R.string.essay_choose_on_today)) }
    }
}
