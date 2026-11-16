package com.zoonk.android.feature.catalog

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
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
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.value
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.MarkStatus
import com.zoonk.android.ui.components.StatusMark
import com.zoonk.android.ui.components.TextButton
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.factsLine
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.CourseChapter
import com.zoonk.api.models.CoursePlanEstimateAnyOf1
import com.zoonk.api.models.CoursePlanExample
import com.zoonk.api.models.CourseResourceLevelsInner
import com.zoonk.api.models.LearnerSummary
import com.zoonk.api.models.LearnerSummaryGoal

@Composable
internal fun CourseChapter.Level.label(): String = courseLevelName(value)

/** Main's `LibraryCourseOutline`: every chapter by level, or by exam area for a dated plan, as names and counts. */
@Composable
internal fun CourseOutline(
    navigator: AppNavigator,
    courseId: String,
    chapters: List<CourseChapter>,
    plan: CoursePlanExample?,
    lead: String?,
    openLevel: CourseChapter.Level?,
    levels: List<CourseResourceLevelsInner>,
    goal: LearnerSummaryGoal?,
    disclosures: Disclosures,
    modifier: Modifier = Modifier,
) {
    val lessonCount = chapters.sumOf { it.lessons.size }
    val hereChapter = goal?.courseChapterId?.toString()
    val hereLevel = goal?.takeIf { it.courseChapterId == null }?.courseLevel?.value
    val dated = plan?.pace?.estimate?.dated

    val facts =
        if (chapters.isEmpty()) {
            null
        } else {
            listOfNotNull(
                pluralStringResource(R.plurals.catalog_chapters, chapters.size, chapters.size),
                pluralStringResource(R.plurals.catalog_short_lessons, lessonCount, lessonCount).takeIf { lessonCount > 0 },
            ).factsLine()
        }

    Column(modifier, verticalArrangement = Arrangement.spacedBy(24.dp)) {
        Column(Modifier.widthIn(max = COLUMN_WIDTH), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            SectionTitle(stringResource(R.string.catalog_outline), facts = facts)

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
                AreaOutline(navigator, courseId, chapters, numbers, dated, hereChapter, disclosures)
            }

            else -> {
                val written = chapters.groupBy { it.level }
                val covered = levels.map { it.level.value }.toSet()

                CourseChapter.Level.entries.filter { it in written || it.value in covered }.forEach { level ->
                    val levelChapters = written[level].orEmpty()
                    val here: (@Composable () -> Unit)? = if (level.value == hereLevel) ({ HereMark() }) else null

                    if (levelChapters.isEmpty()) {
                        UnwrittenLevel(level.label(), here)
                        return@forEach
                    }

                    ChapterGroup(
                        title = level.label(),
                        titleMark = here,
                        chapters = levelChapters,
                        openByDefault = level == openLevel,
                        disclosures = disclosures,
                    ) {
                        ChapterRows(navigator, courseId, levelChapters, numbers, hereChapter, disclosures)
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
    hereChapter: String?,
    disclosures: Disclosures,
) {
    val areas = estimate.chapters.associate { it.chapterId.toString() to it.area }
    val groups = chapters.groupBy { areas[it.id.toString()] }
    val order =
        estimate.areas
            .mapNotNull { it.area }
            .distinct()
            .filter { it in groups }

    if (order.size <= 1) {
        ChapterRows(navigator, courseId, chapters, numbers, hereChapter, disclosures)
        return
    }

    order.forEachIndexed { index, area ->
        val areaChapters = groups[area].orEmpty()

        ChapterGroup(title = area, chapters = areaChapters, openByDefault = index == 0, disclosures = disclosures) {
            ChapterRows(navigator, courseId, areaChapters, numbers, hereChapter, disclosures)
        }
    }
}

/** A level or exam area: its name and chapter count, with its first chapters' names while closed. */
@Composable
private fun ChapterGroup(
    title: String,
    chapters: List<CourseChapter>,
    openByDefault: Boolean,
    disclosures: Disclosures,
    titleMark: (@Composable () -> Unit)? = null,
    content: @Composable () -> Unit,
) {
    OutlineZone(
        title = title,
        titleMark = titleMark,
        aside = pluralStringResource(R.plurals.catalog_chapters, chapters.size, chapters.size),
        closedSummary = chapters.take(CHAPTERS_NAMED).map { it.title }.factsLine(),
        openByDefault = openByDefault,
        disclosures = disclosures,
        content = content,
    )
}

/** Main's `RouteZone`: a disclosure whose closed state names what's inside; it follows [openByDefault] until tapped. */
@Composable
internal fun OutlineZone(
    title: String,
    aside: String,
    closedSummary: String?,
    openByDefault: Boolean,
    disclosures: Disclosures,
    titleMark: (@Composable () -> Unit)? = null,
    content: @Composable () -> Unit,
) {
    val key = "zone:$title"
    val open = disclosures.isOpen(key, openByDefault)
    val state = stringResource(if (open) R.string.disclosure_expanded else R.string.disclosure_collapsed)

    Column {
        HorizontalDivider()
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clickable(
                        onClickLabel = stringResource(if (open) R.string.catalog_collapse else R.string.catalog_expand),
                        role = Role.Button,
                    ) { disclosures.toggle(key, openByDefault) }
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
                    Row(
                        modifier = Modifier.padding(end = 12.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(title, style = MaterialTheme.typography.titleMedium)
                        titleMark?.invoke()
                    }
                    Text(
                        aside,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.labelMedium.withTabularFigures(),
                    )
                }
                if (closedSummary != null && !open) {
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

/** A fold that hides two chapters saves nothing, so only long lists fold after six; one hiding [hereChapter] opens. */
@Composable
private fun ChapterRows(
    navigator: AppNavigator,
    courseId: String,
    chapters: List<CourseChapter>,
    numbers: Map<String, Int>,
    hereChapter: String?,
    disclosures: Disclosures,
) {
    val key = "chapters:${chapters.firstOrNull()?.id}"
    val folds = chapters.size >= CHAPTERS_SHOWN + 3
    val hidesHere = chapters.drop(CHAPTERS_SHOWN).any { it.id.toString() == hereChapter }
    val showAll = disclosures.isOpen(key, hidesHere)
    val shown = if (folds && !showAll) chapters.take(CHAPTERS_SHOWN) else chapters

    Column {
        shown.forEach { chapter ->
            OutlineChapterRow(
                navigator,
                courseId,
                chapter,
                numbers[chapter.id.toString()] ?: 0,
                isHere = chapter.id.toString() == hereChapter,
            )
        }

        if (folds) {
            TextButton(onClick = { disclosures.toggle(key, hidesHere) }, modifier = Modifier.padding(start = 28.dp)) {
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
    isHere: Boolean,
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

            if (isHere) HereMark()

            if (chapter.lessons.isNotEmpty()) {
                Text(
                    chapter.lessons.map { it.title }.factsLine(),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        }
    }
}

/** Main's `CourseHere`: the chapter of the next lesson in the learner's plan, or its level while no chapter holds it. */
@Composable
private fun HereMark() {
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
        StatusMark(MarkStatus.Next, Modifier.size(16.dp))
        Text(
            stringResource(R.string.catalog_you_are_here),
            color = MaterialTheme.colorScheme.tertiary,
            style = MaterialTheme.typography.labelMedium,
        )
    }
}

/** A level the course covers with no chapter written yet: a still row, so the outline shows the whole course. */
@Composable
private fun UnwrittenLevel(
    title: String,
    here: (@Composable () -> Unit)?,
) {
    Column {
        HorizontalDivider()
        Column(Modifier.fillMaxWidth().padding(vertical = 14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(title, style = MaterialTheme.typography.titleMedium)
                here?.invoke()
            }
            Text(
                stringResource(R.string.catalog_level_unwritten),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodySmall,
            )
        }
    }
}

private const val CHAPTERS_NAMED = 3
private const val CHAPTERS_SHOWN = 6

/**
 * The level a course's outline opens at: the learner's plan's level in the course, the first for
 * anyone else or when the summary can't be read, and none while a session's summary is on its way,
 * so the learner's level opens without another one closing above it.
 */
internal fun outlineLevel(
    chapters: List<CourseChapter>,
    courseId: String,
    hasSession: Boolean,
    summary: LoadState<LearnerSummary>,
): CourseChapter.Level? {
    if (isSummaryOnItsWay(hasSession, summary)) return null
    val level =
        summary.value
            ?.goals
            ?.find { it.courseId?.toString() == courseId }
            ?.courseLevel
    return CourseChapter.Level.entries.find { it.value == level?.value } ?: chapters.firstOrNull()?.level
}

private fun isSummaryOnItsWay(
    hasSession: Boolean,
    summary: LoadState<LearnerSummary>,
): Boolean = hasSession && (summary == LoadState.Idle || summary == LoadState.Loading)
