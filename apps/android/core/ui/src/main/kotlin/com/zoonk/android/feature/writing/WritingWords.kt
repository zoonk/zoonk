package com.zoonk.android.feature.writing

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.components.TextButton
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.format.formatList
import java.time.LocalDate

/** A written task as it's named before its question is assigned: its place in the written test and its line limit. */
@Immutable
data class WritingTaskName(
    val lines: Int?,
    /** Its 1-based place in the written test. */
    val number: Int,
    val total: Int,
    /** No other task of the test has its line limit, so the limit names it. */
    val distinctLines: Boolean,
)

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
 * one leads there. [task] names the one question that waits when others don't.
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
        TextButton(onClick = onChoose) { Text(stringResource(R.string.essay_choose_on_today)) }
    }
}
