package com.zoonk.android.feature.essay

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.VerticalDivider
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.questions.ItemText
import com.zoonk.android.feature.writing.formatPoints
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.ModalBottomSheet
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.components.bleed
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.factsLine
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.scaffold.pageTitle
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.WritingPacing
import com.zoonk.api.models.WritingPromptOutput

/** "Writing drill" or "Written answer": the bar's title on every screen of a written task. */
@Composable
internal fun writingLabel(writing: WritingPromptOutput): String =
    stringResource(if (writing.unit == WritingPromptOutput.Unit.DRILL) R.string.essay_writing_drill else R.string.essay_written_answer)

/** "Up to 30 lines · 30 points · about 1 hr 10 min": the official clock reads as is, any other is an estimate. */
@Composable
internal fun writingFacts(
    writing: WritingPromptOutput,
    pacing: WritingPacing?,
): String {
    val locale = currentLocale()
    val lines = writing.lines?.toInt()
    val time = pacing?.let { formatMinutes(it.minutes.toInt(), locale) }
    return factsLine(
        lines?.let { pluralStringResource(R.plurals.essay_up_to_lines, it, it) },
        writing.points?.let { stringResource(R.string.essay_points, formatPoints(it, locale)) },
        time?.let { if (pacing.source == WritingPacing.Source.OFFICIAL) it else stringResource(R.string.essay_about_time, it) },
    )
}

/** The question screen: its topic, limits, support text, what to write and the criteria one row away. */
@Composable
internal fun WritingQuestionPage(
    writing: WritingPromptOutput,
    pacing: WritingPacing?,
    context: String?,
    question: String,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(writing.title, Modifier.pageTitle(), style = MaterialTheme.typography.headlineSmall)
        Text(
            writingFacts(writing, pacing),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.labelMedium.withTabularFigures(),
        )
    }
    WritingQuestionBody(context, question)
    CriteriaRow(writing)
}

/** The support text and what to write: the question's body, on its screen and beside the answer. */
@Composable
internal fun WritingQuestionBody(
    context: String?,
    question: String,
) {
    context?.let {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            SectionHeader(stringResource(R.string.essay_support_text))
            Row(Modifier.height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                VerticalDivider(Modifier.fillMaxHeight(), thickness = 2.dp)
                ItemText(it, Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
            }
        }
    }
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SectionHeader(stringResource(R.string.essay_what_to_write))
        ItemText(question, style = MaterialTheme.typography.bodyLarge)
    }
}

/** The criteria under the question where it's read beside the answer: no sheet over a sheet. */
@Composable
internal fun WritingCriteriaSection(writing: WritingPromptOutput) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SectionHeader(stringResource(R.string.essay_grading_criteria))
        WritingCriteriaList(writing)
    }
}

@Composable
private fun criteriaDetail(writing: WritingPromptOutput): String {
    val points = writing.points
    return if (points != null && writing.criteria.any { it.points != null }) {
        stringResource(R.string.essay_points_split, formatPoints(points, currentLocale()))
    } else {
        stringResource(R.string.essay_judged_on)
    }
}

/** How the question's points are split, one row away from it. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CriteriaRow(writing: WritingPromptOutput) {
    var open by rememberSaveable { mutableStateOf(false) }
    val detail = criteriaDetail(writing)

    // The row reaches past the page's margin, so its words line up with the text above it.
    Column(Modifier.bleed(LIST_ITEM_INSET)) {
        HorizontalDivider(Modifier.padding(horizontal = LIST_ITEM_INSET))
        ListRow(
            headline = { Text(stringResource(R.string.essay_grading_criteria)) },
            onClick = { open = true },
            supporting = { Text(detail) },
        )
        HorizontalDivider(Modifier.padding(horizontal = LIST_ITEM_INSET))
    }

    if (open) {
        ModalBottomSheet(onDismissRequest = { open = false }, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
            SheetColumn {
                Text(
                    stringResource(R.string.essay_grading_criteria),
                    Modifier.semantics { heading() },
                    style = MaterialTheme.typography.titleLarge,
                )
                Text(detail, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
                WritingCriteriaList(writing)
            }
        }
    }
}

/** A sheet's scrolling body, inset as the app's other sheets are. */
@Composable
internal fun SheetColumn(content: @Composable ColumnScope.() -> Unit) {
    Column(
        Modifier
            .navigationBarsPadding()
            .verticalScroll(rememberScrollState())
            .padding(start = 24.dp, end = 24.dp, bottom = 32.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        content = content,
    )
}

@Composable
private fun WritingCriteriaList(writing: WritingPromptOutput) {
    val locale = currentLocale()

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Column {
            writing.criteria.forEachIndexed { index, criterion ->
                if (index > 0) HorizontalDivider()
                Row(
                    Modifier.fillMaxWidth().padding(vertical = 12.dp).semantics(mergeDescendants = true) {},
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(criterion.name, Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
                    criterion.points?.let {
                        Text(formatPoints(it, locale), style = MaterialTheme.typography.labelMedium.withTabularFigures())
                    }
                }
            }
        }
        Text(
            stringResource(
                if (writing.keySource ==
                    WritingPromptOutput.KeySource.NOTICE
                ) {
                    R.string.essay_from_notice
                } else {
                    R.string.essay_from_notice_practice_key
                },
            ),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodySmall,
        )
    }
}
