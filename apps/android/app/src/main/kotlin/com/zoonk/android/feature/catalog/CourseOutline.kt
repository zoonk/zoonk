package com.zoonk.android.feature.catalog

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.CourseChapter
import com.zoonk.api.models.CoursePlanEstimateAnyOf1
import com.zoonk.api.models.CoursePlanEstimateAnyOf1AreasInner
import com.zoonk.api.models.CoursePlanEstimateAnyOf1ChaptersInner
import com.zoonk.api.models.CoursePlanExample
import kotlinx.datetime.toJavaLocalDate
import kotlin.math.roundToLong

/** Main's `OUTLINE_SEPARATOR`. */
internal const val SEPARATOR = " · "

@Composable
internal fun CourseChapter.Level.label(): String =
    stringResource(
        when (this) {
            CourseChapter.Level.OVERVIEW -> R.string.catalog_level_overview
            CourseChapter.Level.BEGINNER -> R.string.catalog_level_beginner
            CourseChapter.Level.INTERMEDIATE -> R.string.catalog_level_intermediate
            CourseChapter.Level.ADVANCED -> R.string.catalog_level_advanced
        },
    )

/** Main's `LibraryCourseOutline`: every chapter by level (or by exam area, for a dated plan), with the plan's weeks. */
@Composable
internal fun CourseOutline(
    navigator: AppNavigator,
    courseId: String,
    chapters: List<CourseChapter>,
    plan: CoursePlanExample?,
    lead: String?,
    modifier: Modifier = Modifier,
) {
    val locale = currentLocale()
    val lessonCount = chapters.sumOf { it.lessons.size }
    val totalMinutes = chapters.sumOf { chapter -> chapter.lessons.sumOf { it.estimatedMinutes } }
    val pace = plan?.pace?.takeIf { chapters.isNotEmpty() }
    val dated = pace?.estimate?.dated
    val undated = pace?.estimate?.undated
    val examDate = plan?.exam?.days?.firstOrNull()

    val facts =
        if (chapters.isEmpty()) {
            null
        } else {
            listOfNotNull(
                pluralStringResource(R.plurals.catalog_chapters, chapters.size, chapters.size),
                pluralStringResource(R.plurals.catalog_short_lessons, lessonCount, lessonCount).takeIf { lessonCount > 0 },
                formatTotalDuration(totalMinutes.toDouble(), locale).takeIf { lessonCount > 0 },
            ).joinToString(SEPARATOR)
        }

    Column(modifier, verticalArrangement = Arrangement.spacedBy(24.dp)) {
        Column(Modifier.widthIn(max = COLUMN_WIDTH), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            SectionTitle(stringResource(R.string.catalog_outline), facts = facts)

            if (pace != null) {
                val text =
                    if (dated != null && examDate != null) {
                        stringResource(
                            R.string.catalog_outline_plan_dated,
                            formatDate(examDate.toJavaLocalDate(), locale),
                            formatMinutes(pace.minutes.toInt(), locale),
                        )
                    } else {
                        pluralStringResource(R.plurals.catalog_outline_plan_undated, pace.minutes.toInt(), pace.minutes.toInt())
                    }
                Text(text, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
            }

            lead?.let { Text(it, style = MaterialTheme.typography.bodyLarge) }

            if (chapters.isEmpty()) {
                LineWithIcon(
                    R.drawable.ic_auto_awesome,
                    stringResource(R.string.catalog_outline_unwritten),
                    color = MaterialTheme.colorScheme.onSurface,
                    style = MaterialTheme.typography.bodyLarge,
                )
            }
        }

        val numbers = chapters.withIndex().associate { (index, chapter) -> chapter.id.toString() to index + 1 }

        when {
            chapters.isEmpty() -> {}

            dated != null -> {
                AreaOutline(navigator, courseId, chapters, numbers, dated)
            }

            else -> {
                val weeks = undated?.chapters.orEmpty().associate { it.chapterId.toString() to (it.week to it.endWeek) }

                chapters
                    .groupBy { it.level }
                    .entries
                    .forEachIndexed { index, (level, levelChapters) ->
                        val chapterWeeks = levelChapters.mapNotNull { weeks[it.id.toString()] }.filter { it.first != null }
                        val first = chapterWeeks.minOfOrNull { it.first!! }
                        val last = chapterWeeks.maxOfOrNull { it.second ?: it.first!! }
                        val span =
                            when {
                                first == null || last == null -> {
                                    null
                                }

                                first == last -> {
                                    stringResource(R.string.catalog_level_week, formatNumber(first.toDouble(), locale))
                                }

                                else -> {
                                    stringResource(
                                        R.string.catalog_level_weeks,
                                        formatNumber(first.toDouble(), locale),
                                        formatNumber(last.toDouble(), locale),
                                    )
                                }
                            }

                        OutlineZone(
                            title = level.label(),
                            aside =
                                listOfNotNull(
                                    pluralStringResource(R.plurals.catalog_chapters, levelChapters.size, levelChapters.size),
                                    span,
                                ).joinToString(SEPARATOR),
                            closedSummary = levelChapters.take(CHAPTERS_NAMED).joinToString(SEPARATOR) { it.title },
                            initiallyOpen = index == 0,
                        ) {
                            ChapterRows(navigator, courseId, levelChapters, numbers) { chapter ->
                                weeks[chapter.id.toString()]?.first?.let {
                                    stringResource(
                                        R.string.catalog_chapter_week,
                                        formatNumber(it.toDouble(), locale),
                                    )
                                }
                            }
                        }
                    }
            }
        }
    }
}

/** A chapter core can't place in an area yet isn't listed: "chapters in no exam area" is our data's gap, not the exam's. */
@Composable
private fun AreaOutline(
    navigator: AppNavigator,
    courseId: String,
    chapters: List<CourseChapter>,
    numbers: Map<String, Int>,
    estimate: CoursePlanEstimateAnyOf1,
) {
    val rows = estimate.chapters.associateBy { it.chapterId.toString() }
    val groups = chapters.groupBy { rows[it.id.toString()]?.area }
    val order =
        estimate.areas
            .mapNotNull { it.area }
            .distinct()
            .filter { it in groups }
    val ordered = { list: List<CourseChapter> -> list.sortedBy { rows[it.id.toString()]?.studyOrder ?: Long.MAX_VALUE } }
    val mark: @Composable (CourseChapter) -> String = { chapter -> areaChapterMark(chapter, rows[chapter.id.toString()]) }

    if (order.size <= 1) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                areaFitText(estimate.areas.firstOrNull { it.area == order.firstOrNull() }, chapters, rows),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
            ChapterRows(navigator, courseId, ordered(chapters), numbers, mark)
        }
        return
    }

    order.forEach { area ->
        val areaChapters = groups[area].orEmpty()

        OutlineZone(
            title = area,
            aside = pluralStringResource(R.plurals.catalog_chapters, areaChapters.size, areaChapters.size),
            closedSummary = areaFitText(estimate.areas.firstOrNull { it.area == area }, areaChapters, rows),
            openSummary = true,
            initiallyOpen = false,
        ) {
            ChapterRows(navigator, courseId, ordered(areaChapters), numbers, mark)
        }
    }
}

/** No bar: a share of time would read as coverage. */
@Composable
private fun areaFitText(
    area: CoursePlanEstimateAnyOf1AreasInner?,
    chapters: List<CourseChapter>,
    rows: Map<String, CoursePlanEstimateAnyOf1ChaptersInner>,
): String {
    val locale = currentLocale()
    val leftOut = chapters.count { rows[it.id.toString()]?.week == null }
    val parts = mutableListOf<String>()

    if (area != null) {
        val studied = area.plannedMinutes.roundToLong() > 0
        parts +=
            if (studied) {
                stringResource(
                    R.string.catalog_plan_study,
                    formatTotalDuration(area.plannedMinutes, locale),
                )
            } else {
                stringResource(R.string.catalog_left_out)
            }
        parts +=
            if (studied && area.fitting == 0L) {
                val quick = area.quickLessons > 0
                val unwritten = area.unwrittenMinutes.roundToLong() > 0
                when {
                    quick && unwritten -> {
                        stringResource(R.string.catalog_quick_and_written_later)
                    }

                    quick -> {
                        pluralStringResource(
                            R.plurals.catalog_quick_lesson_count,
                            area.quickLessons.toInt(),
                            area.quickLessons.toInt(),
                        )
                    }

                    else -> {
                        stringResource(R.string.catalog_written_later)
                    }
                }
            } else {
                listOfNotNull(
                    stringResource(
                        R.string.catalog_lessons_fit,
                        formatNumber(area.fitting.toDouble(), locale),
                        formatNumber(area.total.toDouble(), locale),
                    ),
                    pluralStringResource(
                        R.plurals.catalog_plus_quick_lessons,
                        area.quickLessons.toInt(),
                        area.quickLessons.toInt(),
                    ).takeIf {
                        area.quickLessons >
                            0
                    },
                ).joinToString(SEPARATOR)
            }
    }

    if (leftOut > 0 && leftOut < chapters.size) {
        parts += pluralStringResource(R.plurals.catalog_chapters_left_out, leftOut, leftOut)
    }

    return parts.joinToString(SEPARATOR)
}

/** "Left out" only when the plan holds no work of it. */
@Composable
private fun areaChapterMark(
    chapter: CourseChapter,
    row: CoursePlanEstimateAnyOf1ChaptersInner?,
): String {
    val locale = currentLocale()
    val week = row?.week ?: return stringResource(R.string.catalog_left_out)
    val span = stringResource(R.string.catalog_chapter_week, formatNumber(week.toDouble(), locale))
    val kinds = row.workKinds.map { it.value }
    val detail =
        when {
            row.lessonsInPlan == 0L && "quick" in kinds && "unwritten" in kinds -> {
                stringResource(R.string.catalog_quick_and_written_later)
            }

            row.lessonsInPlan == 0L && "quick" in kinds -> {
                stringResource(R.string.catalog_quick_lessons)
            }

            row.lessonsInPlan == 0L && "unwritten" in kinds -> {
                stringResource(R.string.catalog_written_later)
            }

            row.lessonsInPlan == 0L -> {
                null
            }

            row.lessonsInPlan < chapter.lessons.size -> {
                stringResource(
                    R.string.catalog_lessons_in_plan,
                    formatNumber(row.lessonsInPlan.toDouble(), locale),
                    formatNumber(chapter.lessons.size.toDouble(), locale),
                )
            }

            else -> {
                null
            }
        }

    return listOfNotNull(span, detail).joinToString(SEPARATOR)
}

/** Main's `RouteZone`: a disclosure whose closed state names what's inside. */
@Composable
internal fun OutlineZone(
    title: String,
    aside: String,
    closedSummary: String?,
    initiallyOpen: Boolean,
    openSummary: Boolean = false,
    content: @Composable () -> Unit,
) {
    var open by rememberSaveable(title) { mutableStateOf(initiallyOpen) }
    val state = stringResource(if (open) R.string.catalog_expanded else R.string.catalog_collapsed)

    Column {
        HorizontalDivider()
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clickable(
                        onClickLabel = stringResource(if (open) R.string.catalog_collapse else R.string.catalog_expand),
                        role = Role.Button,
                    ) { open = !open }
                    .semantics { stateDescription = state }
                    .padding(vertical = 14.dp),
            verticalAlignment = Alignment.Top,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                FlowRow(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    itemVerticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        title,
                        modifier = Modifier.padding(end = 12.dp),
                        style = MaterialTheme.typography.titleMedium,
                    )
                    Text(
                        aside,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.labelMedium.withTabularFigures(),
                    )
                }
                if (closedSummary != null && (!open || openSummary)) {
                    Text(closedSummary, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
                }
            }
            Icon(
                painterResource(R.drawable.ic_expand_more),
                contentDescription = null,
                modifier = if (open) Modifier.rotate(180f) else Modifier,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        if (open) content()
    }
}

/** A fold that hides two chapters saves nothing, so only long lists fold after six. */
@Composable
private fun ChapterRows(
    navigator: AppNavigator,
    courseId: String,
    chapters: List<CourseChapter>,
    numbers: Map<String, Int>,
    mark: @Composable (CourseChapter) -> String?,
) {
    var showAll by rememberSaveable(chapters.firstOrNull()?.id?.toString()) { mutableStateOf(false) }
    val folds = chapters.size >= CHAPTERS_SHOWN + 3
    val shown = if (folds && !showAll) chapters.take(CHAPTERS_SHOWN) else chapters

    Column {
        shown.forEach { chapter ->
            OutlineChapterRow(navigator, courseId, chapter, numbers[chapter.id.toString()] ?: 0, mark(chapter))
        }

        if (folds) {
            TextButton(onClick = { showAll = !showAll }, modifier = Modifier.padding(start = 28.dp)) {
                Text(
                    if (showAll) {
                        stringResource(R.string.catalog_show_fewer_chapters)
                    } else {
                        pluralStringResource(
                            R.plurals.catalog_show_more_chapters,
                            chapters.size - CHAPTERS_SHOWN,
                            chapters.size - CHAPTERS_SHOWN,
                        )
                    },
                )
            }
        }
    }
}

@Composable
private fun OutlineChapterRow(
    navigator: AppNavigator,
    courseId: String,
    chapter: CourseChapter,
    number: Int,
    mark: String?,
) {
    val locale = currentLocale()
    val chapterId = chapter.id.toString()

    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable { navigator.open(AppRoute.CatalogChapter(chapterId, courseId)) }
                .padding(vertical = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(
            formatNumber(number.toDouble(), locale),
            modifier = Modifier.widthIn(min = 20.dp),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.labelMedium.withTabularFigures(),
        )

        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                chapter.title,
                modifier = Modifier.semantics { heading() },
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
            )

            mark?.let {
                Text(
                    it,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.labelMedium.withTabularFigures(),
                )
            }

            if (chapter.lessons.isNotEmpty()) {
                Text(
                    chapter.lessons.joinToString(SEPARATOR) { it.title },
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        }
    }
}

private const val CHAPTERS_NAMED = 3
private const val CHAPTERS_SHOWN = 6
