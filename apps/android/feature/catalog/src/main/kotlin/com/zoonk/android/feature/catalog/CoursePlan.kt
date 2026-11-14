package com.zoonk.android.feature.catalog

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.components.color
import com.zoonk.android.ui.format.FACT_SEPARATOR
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.CourseChapter
import com.zoonk.api.models.CoursePlanEstimate
import com.zoonk.api.models.CoursePlanEstimateAnyOf
import com.zoonk.api.models.CoursePlanEstimateAnyOf1
import com.zoonk.api.models.CoursePlanExample

internal val CoursePlanEstimate.undated: CoursePlanEstimateAnyOf?
    get() = (this as? CoursePlanEstimate.CoursePlanEstimateAnyOfValue)?.value

internal val CoursePlanEstimate.dated: CoursePlanEstimateAnyOf1?
    get() = (this as? CoursePlanEstimate.CoursePlanEstimateAnyOf1Value)?.value

/**
 * Main's `CoursePlanWindow`: how long the whole course takes at the example's time a day, and its
 * first day. An exam course has no block: its date and the first screen already say how it runs.
 */
@Composable
internal fun CoursePlanSection(
    plan: CoursePlanExample,
    chapters: List<CourseChapter>,
    beside: Boolean,
    modifier: Modifier = Modifier,
) {
    val pace = plan.pace ?: return
    val undated = pace.estimate.undated ?: return
    val titles = chapters.associate { it.id.toString() to it.title }

    val headline = @Composable { UndatedHeadline(undated, pace.minutes) }
    val firstDay = undated.takeIf { it.firstDay.isNotEmpty() }?.let { @Composable { FirstDay(it, titles) } }
    val title = @Composable {
        Text(
            stringResource(R.string.catalog_example_plan),
            modifier = Modifier.semantics { heading() },
            style = MaterialTheme.typography.titleMedium,
        )
    }

    // Main puts the first day beside the headline from `@3xl`.
    if (beside && firstDay != null) {
        Column(modifier, verticalArrangement = Arrangement.spacedBy(28.dp)) {
            title()
            Row(horizontalArrangement = Arrangement.spacedBy(64.dp)) {
                Column(Modifier.weight(1f)) { headline() }
                Column(Modifier.weight(1f)) { firstDay() }
            }
        }
    } else {
        Column(modifier.widthIn(max = COLUMN_WIDTH), verticalArrangement = Arrangement.spacedBy(28.dp)) {
            title()
            headline()
            firstDay?.invoke()
        }
    }
}

/** Main's `BigQuantity`: the number large, its words around it as they are. */
@Composable
internal fun bigQuantity(
    text: String,
    quantity: String,
): AnnotatedString {
    val big = MaterialTheme.typography.displaySmall
    val start = text.indexOf(quantity)

    return buildAnnotatedString {
        if (start < 0) {
            append(text)
            return@buildAnnotatedString
        }

        append(text.substring(0, start))
        withStyle(SpanStyle(fontSize = big.fontSize, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurface)) {
            append(quantity)
        }
        append(text.substring(start + quantity.length))
    }
}

@Composable
private fun BigLine(text: AnnotatedString) {
    Text(text, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.titleMedium.withTabularFigures())
}

@Composable
private fun ResultLine(text: String) {
    Text(
        text,
        modifier = Modifier.widthIn(max = RESULT_LINE_WIDTH),
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        style = MaterialTheme.typography.bodyLarge,
    )
}

@Composable
private fun UndatedHeadline(
    estimate: CoursePlanEstimateAnyOf,
    minutes: Long,
) {
    val weeks = formatNumber(estimate.weeks.toDouble(), currentLocale())

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        BigLine(bigQuantity(pluralStringResource(R.plurals.catalog_plan_weeks, estimate.weeks.toInt(), weeks), "~$weeks"))
        ResultLine(pluralStringResource(R.plurals.catalog_plan_whole_course, minutes.toInt(), minutes.toInt()))
    }
}

/** Minutes stay exact until they're written, so the totals are the day's own time, never a sum of rounded rows. */
@Composable
private fun FirstDay(
    estimate: CoursePlanEstimateAnyOf,
    chapterTitles: Map<String, String>,
) {
    val locale = currentLocale()
    val steps =
        estimate.firstDay.mapIndexed { index, lesson ->
            DayStep(
                id = lesson.lessonId.toString(),
                title = lesson.title,
                detail = lesson.chapterId?.let { chapterTitles[it.toString()] },
                minutes = lesson.dayMinutes,
                state = if (index == 0) DayStepState.Current else DayStepState.Ahead,
            )
        }
    val folded = steps.drop(TODAY_ROWS)

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        FactsRow(
            title = stringResource(R.string.catalog_plan_today),
            facts =
                pluralStringResource(R.plurals.catalog_plan_lessons, steps.size, steps.size) + FACT_SEPARATOR +
                    formatTotalDuration(steps.sumOf { it.minutes }, locale),
        )

        DayList(steps.take(TODAY_ROWS))

        if (folded.isNotEmpty()) {
            HorizontalDivider()
            Text(
                pluralStringResource(R.plurals.catalog_plan_more_lessons, folded.size, folded.size) + FACT_SEPARATOR +
                    formatTotalDuration(folded.sumOf { it.minutes }, locale),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.labelMedium.withTabularFigures(),
            )
        }
    }
}

/** A list's title with its numbers at the end, as main's day and workload headers. */
@Composable
internal fun FactsRow(
    title: String,
    facts: String?,
    modifier: Modifier = Modifier,
) {
    FlowRow(modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, itemVerticalAlignment = Alignment.Bottom) {
        Text(title, modifier = Modifier.padding(end = 12.dp), style = MaterialTheme.typography.titleSmall)
        if (facts != null) {
            Text(
                facts,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.labelMedium.withTabularFigures(),
            )
        }
    }
}

private const val TODAY_ROWS = 3
