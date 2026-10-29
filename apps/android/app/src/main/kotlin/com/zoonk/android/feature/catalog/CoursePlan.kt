package com.zoonk.android.feature.catalog

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
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
import com.zoonk.android.ui.components.KindMark
import com.zoonk.android.ui.components.LearnKind
import com.zoonk.android.ui.components.MeterPart
import com.zoonk.android.ui.components.MeterParts
import com.zoonk.android.ui.components.color
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.CourseChapter
import com.zoonk.api.models.CoursePlanEstimate
import com.zoonk.api.models.CoursePlanEstimateAnyOf
import com.zoonk.api.models.CoursePlanEstimateAnyOf1
import com.zoonk.api.models.CoursePlanExample
import com.zoonk.api.models.PlanNumbers
import com.zoonk.api.models.PlanNumbersCoverage
import kotlinx.datetime.toJavaLocalDate
import java.time.temporal.ChronoUnit
import kotlin.math.roundToLong

internal val CoursePlanEstimate.undated: CoursePlanEstimateAnyOf?
    get() = (this as? CoursePlanEstimate.CoursePlanEstimateAnyOfValue)?.value

internal val CoursePlanEstimate.dated: CoursePlanEstimateAnyOf1?
    get() = (this as? CoursePlanEstimate.CoursePlanEstimateAnyOf1Value)?.value

private val CoursePlanEstimate.numbers: PlanNumbers
    get() = undated?.numbers ?: dated!!.numbers

/** Main's `CoursePlanWindow`: what the example plan takes, its first day or what fills the time, and that it's an example. */
@Composable
internal fun CoursePlanSection(
    plan: CoursePlanExample,
    chapters: List<CourseChapter>,
    isExam: Boolean,
    modifier: Modifier = Modifier,
) {
    val pace = plan.pace ?: return
    val estimate = pace.estimate
    val undated = estimate.undated
    val examDate =
        plan.exam
            ?.days
            ?.firstOrNull()
            ?.let { formatDate(it.toJavaLocalDate(), currentLocale()) }
    val titles = chapters.associate { it.id.toString() to it.title }

    Column(modifier.widthIn(max = COLUMN_WIDTH), verticalArrangement = Arrangement.spacedBy(28.dp)) {
        Text(
            stringResource(R.string.catalog_example_plan),
            modifier =
                Modifier.semantics {
                    heading()
                },
            style = MaterialTheme.typography.titleLarge,
        )

        if (undated != null) {
            UndatedHeadline(undated, pace.minutes)
        } else {
            DatedHeadline(estimate.dated!!, examDate.orEmpty(), pace.minutes)
        }

        PlanWorkload(estimate.numbers, isExam)

        if (undated != null && undated.firstDay.isNotEmpty()) UndatedToday(undated, titles)

        Text(
            stringResource(R.string.catalog_plan_caption),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodySmall,
        )
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
    val locale = currentLocale()
    val weeks = formatNumber(estimate.weeks.toDouble(), locale)
    val from =
        estimate.numbers.context.fromDate
            .toJavaLocalDate()
    val end = estimate.endDate?.toJavaLocalDate()
    val endMonth = end?.takeIf { ChronoUnit.DAYS.between(from, it) > NEAR_ESTIMATE_DAYS }?.let { formatDate(it, locale, DateStyle.Month) }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        BigLine(bigQuantity(pluralStringResource(R.plurals.catalog_plan_weeks, estimate.weeks.toInt(), weeks), "~$weeks"))
        ResultLine(pluralStringResource(R.plurals.catalog_plan_whole_course, minutes.toInt(), minutes.toInt()))

        if (endMonth != null) {
            LineWithIcon(
                icon = R.drawable.ic_flag,
                text = stringResource(R.string.catalog_plan_finish_around, endMonth),
                color = MaterialTheme.colorScheme.onSurface,
                style = MaterialTheme.typography.bodyLarge,
            )
        }
    }
}

/** Minutes stay exact until they're written, so the totals are the day's own time, never a sum of rounded rows. */
@Composable
private fun UndatedToday(
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
                pluralStringResource(R.plurals.catalog_plan_lessons, steps.size, steps.size) + " · " +
                    formatTotalDuration(steps.sumOf { it.minutes }, locale),
        )

        DayList(steps.take(TODAY_ROWS))

        if (folded.isNotEmpty()) {
            HorizontalDivider()
            Text(
                pluralStringResource(R.plurals.catalog_plan_more_lessons, folded.size, folded.size) + " · " +
                    formatTotalDuration(folded.sumOf { it.minutes }, locale),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.labelMedium.withTabularFigures(),
            )
        }
    }
}

/**
 * Never only the lessons' time, which undercounts a plan that also reviews and practices. Never how
 * much fits: that share assumes a start from scratch, so onboarding says it at the visitor's level.
 */
@Composable
private fun DatedHeadline(
    estimate: CoursePlanEstimateAnyOf1,
    date: String,
    minutes: Long,
) {
    val locale = currentLocale()
    val numbers = estimate.numbers
    val studyTime = formatTotalDuration(numbers.beforeDeadlineMinutes ?: numbers.scheduledMinutes, locale)
    val time = formatMinutes(minutes.toInt(), locale)
    val fitting = estimate.fittingLessons.toInt()
    val total = estimate.publishedContent.lessons.toInt()

    val holds =
        when {
            estimate.workload.unwrittenLessonMinutes > 0 && fitting == 0 -> {
                stringResource(R.string.catalog_plan_dated_written_later, date, time)
            }

            estimate.workload.unwrittenLessonMinutes > 0 -> {
                pluralStringResource(R.plurals.catalog_plan_dated_some_written, fitting, date, time, fitting)
            }

            estimate.areas.any { it.quickLessons > 0 } || fitting == 0 -> {
                stringResource(R.string.catalog_plan_dated_quick, date, time)
            }

            else -> {
                pluralStringResource(
                    R.plurals.catalog_plan_dated_fitting,
                    total,
                    date,
                    time,
                    formatNumber(fitting.toDouble(), locale),
                    total,
                )
            }
        }

    val coverage = numbers.coverage
    val fit =
        when {
            coverage == null -> null
            coverage.coveredShare < 1 -> stringResource(R.string.catalog_plan_not_all_fits)
            coverage.measure == PlanNumbersCoverage.Measure.GOAL -> stringResource(R.string.catalog_plan_every_topic)
            else -> stringResource(R.string.catalog_plan_every_exam_topic)
        }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        BigLine(bigQuantity(stringResource(R.string.catalog_plan_study, studyTime), studyTime))
        ResultLine(holds)
        fit?.let { ResultLine(it) }
    }
}

private data class WorkloadPart(
    val kinds: List<LearnKind>,
    val label: String,
    val minutes: Double,
    val fill: MeterPart.Fill,
)

@Composable
private fun PlanWorkload(
    numbers: PlanNumbers,
    isExam: Boolean,
) {
    val locale = currentLocale()
    val workload = numbers.workload
    val ink = MaterialTheme.colorScheme.onSurface
    val parts =
        listOf(
            WorkloadPart(
                listOf(LearnKind.Lesson),
                stringResource(R.string.catalog_workload_lessons),
                workload.lessonMinutes,
                MeterPart.Fill.Solid(ink.copy(alpha = 0.45f)),
            ),
            WorkloadPart(
                listOf(LearnKind.Lesson),
                stringResource(R.string.catalog_workload_unwritten),
                workload.unwrittenLessonMinutes,
                MeterPart.Fill.Solid(ink.copy(alpha = 0.2f)),
            ),
            WorkloadPart(
                listOf(LearnKind.Review),
                stringResource(R.string.catalog_workload_practice),
                workload.practiceMinutes,
                MeterPart.Fill.Solid(LearnKind.Review.color),
            ),
            WorkloadPart(
                if (isExam) listOf(LearnKind.Challenge, LearnKind.Mock) else listOf(LearnKind.Challenge),
                stringResource(if (isExam) R.string.catalog_workload_challenges_mocks else R.string.catalog_workload_challenges),
                workload.checkpointMinutes,
                MeterPart.Fill.Solid(LearnKind.Challenge.color),
            ),
        ).filter { it.minutes.roundToLong() > 0 }

    if (parts.isEmpty()) return

    val afterExam = (numbers.afterDeadlineMinutes ?: 0.0).roundToLong()

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        FactsRow(
            title = stringResource(R.string.catalog_workload_title),
            facts =
                if (parts.size >
                    1
                ) {
                    stringResource(R.string.catalog_workload_total, formatTotalDuration(numbers.scheduledMinutes, locale))
                } else {
                    null
                },
        )

        if (parts.size > 1) MeterParts(parts.map { MeterPart(it.fill, it.minutes.toFloat()) })

        parts.forEach { part ->
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) { part.kinds.forEach { KindMark(it) } }
                Text(part.label, modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
                Text(
                    formatTotalDuration(part.minutes, locale),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.labelMedium.withTabularFigures(),
                )
            }
        }

        val notes =
            listOfNotNull(
                stringResource(R.string.catalog_workload_reviews_note).takeIf { workload.practiceMinutes.roundToLong() > 0 },
                stringResource(R.string.catalog_workload_after_exam, formatTotalDuration(afterExam.toDouble(), locale)).takeIf {
                    afterExam >
                        0
                },
                stringResource(R.string.catalog_workload_unwritten_note).takeIf { workload.unwrittenLessonMinutes > 0 },
            )

        notes.forEach { note ->
            Text(note, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
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
private const val NEAR_ESTIMATE_DAYS = 42
