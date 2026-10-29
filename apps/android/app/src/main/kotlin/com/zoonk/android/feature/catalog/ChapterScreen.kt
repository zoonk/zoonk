package com.zoonk.android.feature.catalog

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.feedback.FeedbackTarget
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.MeterPart
import com.zoonk.android.ui.components.MeterParts
import com.zoonk.android.ui.components.Subject
import com.zoonk.android.ui.components.SubjectGlyph
import com.zoonk.android.ui.components.colors
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.CatalogTryLesson
import com.zoonk.api.models.CourseChapter
import com.zoonk.api.models.FeedbackSubmissionContext

/** A chapter as its course places it, drawn from the course's outline; only the lesson to try is the chapter's own read. */
@Composable
fun ChapterScreen(
    route: AppRoute.CatalogChapter,
    app: AppContainer,
    navigator: AppNavigator,
    catalog: CatalogStore = app.catalog,
) {
    val detail = catalog.course[route.courseId]
    val state by detail.collectShown()
    val chapter = catalog.chapter[ChapterInCourse(route.chapterId, route.courseId)]
    val chapterState by chapter.collectShown()
    val place = state.value?.let { placeOf(it, route.chapterId) }
    val shown = if (state is LoadState.Loaded && place == null) LoadState.Failed(ApiError.NotFound) else state

    val report = FeedbackTarget("chapter", FeedbackSubmissionContext.ContentKind.CHAPTER, route.chapterId.toUuidOrNull())

    CatalogPage(app, navigator, detail, shown, place?.chapter?.title, report, alsoShown = listOf(chapter)) { value, layout ->
        placeOf(value, route.chapterId)?.let { chapterContent(app, navigator, value, it, chapterState.value?.tryLesson, layout) }
    }
}

internal data class ChapterPlace(
    val chapter: CourseChapter,
    val number: Int,
    val total: Int,
)

internal fun placeOf(
    detail: CourseDetail,
    chapterId: String,
): ChapterPlace? {
    val index = detail.chapters.indexOfFirst { it.id.toString() == chapterId }
    return detail.chapters.getOrNull(index)?.let { ChapterPlace(it, index + 1, detail.chapters.size) }
}

private fun LazyListScope.chapterContent(
    app: AppContainer,
    navigator: AppNavigator,
    detail: CourseDetail,
    place: ChapterPlace,
    tryLesson: CatalogTryLesson?,
    layout: CatalogPageLayout,
) {
    val chapter = place.chapter
    val courseId = detail.course.id.toString()
    val hasLesson = chapter.lessons.isNotEmpty()
    val startChapterId = chapter.id.toString().takeIf { hasLesson && place.number > 1 }

    item(key = "hero", contentType = "hero") {
        val hero = @Composable { modifier: Modifier ->
            Column(modifier.widthIn(max = COLUMN_WIDTH)) {
                CourseEyebrow(navigator, detail)
                Spacer(Modifier.size(8.dp))
                Text(chapter.title, modifier = layout.headline.semantics { heading() }, style = MaterialTheme.typography.headlineSmall)
                Spacer(Modifier.size(16.dp))
                Text(chapter.description, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyLarge)
                Spacer(Modifier.size(16.dp))
                PlanLine(startsHere = startChapterId != null)
                Spacer(Modifier.size(24.dp))
                ChapterStart(app, navigator, courseId, startChapterId, hasLesson)
            }
        }

        if (layout.beside && tryLesson != null) {
            Row(horizontalArrangement = Arrangement.spacedBy(48.dp)) {
                hero(Modifier.weight(1f))
                TryLessonCard(
                    app,
                    navigator,
                    tryLesson.lessonId.toString(),
                    tryLesson.chapterTitle,
                    tryLesson.number,
                    tryLesson.minutes,
                    tryLesson.screen,
                    Modifier.weight(1f),
                )
            }
        } else {
            hero(Modifier)
        }
    }

    if (tryLesson != null && !layout.beside) {
        item(key = "try", contentType = "try") {
            TryLessonCard(
                app,
                navigator,
                tryLesson.lessonId.toString(),
                tryLesson.chapterTitle,
                tryLesson.number,
                tryLesson.minutes,
                tryLesson.screen,
            )
        }
    }

    if (place.total > 1) {
        item(key = "strip", contentType = "strip") { ChapterStrip(navigator, detail, place) }
    }

    if (hasLesson) {
        item(key = "lessons", contentType = "lessons") {
            val lessons = @Composable { modifier: Modifier -> ChapterLessons(navigator, courseId, place, modifier) }

            if (layout.beside && chapter.objectives.isNotEmpty()) {
                Row(horizontalArrangement = Arrangement.spacedBy(64.dp)) {
                    lessons(Modifier.weight(1f))
                    ChapterObjectives(chapter.objectives, Modifier.weight(1f))
                }
            } else {
                lessons(Modifier)
            }
        }
    }

    if (chapter.objectives.isNotEmpty() && !(layout.beside && hasLesson)) {
        item(key = "objectives", contentType = "objectives") { ChapterObjectives(chapter.objectives) }
    }

    item(key = "closing", contentType = "closing") {
        Column(Modifier.widthIn(max = COLUMN_WIDTH).padding(bottom = 24.dp)) {
            HorizontalDivider()
            Spacer(Modifier.size(48.dp))
            Text(
                stringResource(if (startChapterId != null) R.string.catalog_chapter_closing else R.string.catalog_closing_start),
                modifier = Modifier.semantics { heading() },
                style = MaterialTheme.typography.titleMedium,
            )
            Spacer(Modifier.size(8.dp))
            Text(
                stringResource(if (startChapterId != null) R.string.catalog_chapter_closing_steps else R.string.catalog_closing_steps),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyLarge,
            )
            Spacer(Modifier.size(24.dp))
            ChapterStart(app, navigator, courseId, startChapterId, hasLesson)
        }
    }
}

@Composable
private fun ChapterObjectives(
    objectives: List<String>,
    modifier: Modifier = Modifier,
) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(16.dp)) {
        SectionTitle(stringResource(R.string.catalog_what_you_learn))
        CheckLines(objectives)
    }
}

/** A chapter without lessons yet starts the plan that writes them, so its note says so instead of the visitor's. */
@Composable
private fun ChapterStart(
    app: AppContainer,
    navigator: AppNavigator,
    courseId: String,
    startChapterId: String?,
    hasLesson: Boolean,
) {
    StartActions(
        app = app,
        navigator = navigator,
        courseId = courseId,
        chapterId = startChapterId,
        note = if (hasLesson) null else stringResource(R.string.catalog_chapter_writes_lessons),
    )
}

/** The subject's glyph and the course's name, which opens the course. */
@Composable
internal fun CourseEyebrow(
    navigator: AppNavigator,
    detail: CourseDetail,
) {
    val subject =
        Subject.of(
            detail.course.categories
                .firstOrNull()
                ?.value,
        )

    Row(
        modifier =
            Modifier
                .minimumInteractiveComponentSize()
                .clickable(onClickLabel = stringResource(R.string.catalog_open_course)) {
                    navigator.open(AppRoute.CatalogCourse(detail.course.id.toString()))
                },
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        SubjectGlyph(subject)
        Text(detail.course.title, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
    }
}

/** Main's `ChapterStrip`: where the chapter sits among the course's levels, and the chapters after it. */
@Composable
private fun ChapterStrip(
    navigator: AppNavigator,
    detail: CourseDetail,
    place: ChapterPlace,
) {
    val locale = currentLocale()
    val chapterId = place.chapter.id.toString()
    val levels = detail.chapters.groupBy { it.level }
    val position =
        stringResource(
            R.string.catalog_chapter_position,
            formatNumber(place.number.toDouble(), locale),
            formatNumber(place.total.toDouble(), locale),
        )
    val label = position + SEPARATOR + place.chapter.level.label()
    val stretch = detail.chapters.drop(place.number - 1).take(NEXT_CHAPTERS + 1)
    val ink = MaterialTheme.colorScheme.onSurface

    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        SectionTitle(stringResource(R.string.catalog_chapter_strip))

        MeterParts(
            parts =
                levels.map { (level, chapters) ->
                    MeterPart(
                        if (level ==
                            place.chapter.level
                        ) {
                            MeterPart.Fill.Solid(ink)
                        } else {
                            MeterPart.Fill.Track
                        },
                        chapters.size.toFloat(),
                    )
                },
        )
        Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelMedium.withTabularFigures())

        Column {
            stretch.forEachIndexed { offset, chapter ->
                val isHere = chapter.id.toString() == chapterId

                Column(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .then(
                                if (isHere) {
                                    Modifier.semantics { selected = true }
                                } else {
                                    Modifier.clickable {
                                        navigator.open(
                                            AppRoute.CatalogChapter(chapter.id.toString(), detail.course.id.toString()),
                                        )
                                    }
                                },
                            ).padding(vertical = 14.dp),
                ) {
                    if (offset < 2) {
                        Text(
                            stringResource(if (isHere) R.string.catalog_this_chapter else R.string.catalog_after_this_chapter),
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            style = MaterialTheme.typography.labelMedium,
                        )
                    }
                    Text(
                        chapter.title,
                        style = MaterialTheme.typography.bodyLarge,
                        fontWeight = if (isHere) FontWeight.SemiBold else FontWeight.Normal,
                    )
                }
            }
        }
    }
}

/** Main's `ChapterLessons`: the chapter's lessons under their facts ("Chapter 2 of 9 · 4 short lessons · 30 min"). */
@Composable
internal fun ChapterLessons(
    navigator: AppNavigator,
    courseId: String,
    place: ChapterPlace,
    modifier: Modifier = Modifier,
) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SectionTitle(stringResource(R.string.catalog_lessons), facts = chapterFacts(place))
        ChapterLessonRows(navigator, courseId, place, currentLessonId = null)
    }
}

@Composable
internal fun chapterFacts(place: ChapterPlace): String {
    val locale = currentLocale()
    val lessons = place.chapter.lessons

    return listOf(
        stringResource(
            R.string.catalog_chapter_position,
            formatNumber(place.number.toDouble(), locale),
            formatNumber(place.total.toDouble(), locale),
        ),
        pluralStringResource(R.plurals.catalog_short_lessons, lessons.size, lessons.size),
        formatTotalDuration(lessons.sumOf { it.estimatedMinutes }.toDouble(), locale),
    ).joinToString(SEPARATOR)
}

/** Main's `ChapterLessonRows`: each lesson opens its page; [currentLessonId]'s is on its tint. */
@Composable
internal fun ChapterLessonRows(
    navigator: AppNavigator,
    courseId: String,
    place: ChapterPlace,
    currentLessonId: String?,
) {
    val locale = currentLocale()
    val chapter = place.chapter

    Column(Modifier.widthIn(max = COLUMN_WIDTH)) {
        chapter.lessons.forEachIndexed { index, lesson ->
            val lessonId = lesson.id.toString()
            val isCurrent = lessonId == currentLessonId

            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .background(
                            if (isCurrent) MaterialTheme.colorScheme.surfaceContainerHigh else MaterialTheme.colorScheme.surface,
                            MaterialTheme.shapes.small,
                        ).then(
                            if (isCurrent) {
                                Modifier.semantics { selected = true }
                            } else {
                                Modifier.clickable { navigator.open(AppRoute.CatalogLesson(lessonId, chapter.id.toString(), courseId)) }
                            },
                        ).padding(horizontal = 8.dp, vertical = 14.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text(
                    formatNumber((index + 1).toDouble(), locale),
                    modifier = Modifier.widthIn(min = 16.dp),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.labelMedium.withTabularFigures(),
                )
                Text(
                    lesson.title,
                    modifier = Modifier.weight(1f),
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium,
                )
                Text(
                    formatMinutes(lesson.estimatedMinutes.toInt(), locale),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.labelMedium.withTabularFigures(),
                )
            }
        }
    }
}

private const val NEXT_CHAPTERS = 3
