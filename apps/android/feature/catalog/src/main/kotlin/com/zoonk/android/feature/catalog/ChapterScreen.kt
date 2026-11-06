package com.zoonk.android.feature.catalog

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.AnalyticsEvent
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.TrackShown
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.feedback.FeedbackTarget
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.Subject
import com.zoonk.android.ui.components.SubjectGlyph
import com.zoonk.android.ui.components.colors
import com.zoonk.android.ui.format.FACT_SEPARATOR
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.factsLine
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.scaffold.pageTitle
import com.zoonk.android.ui.theme.LocalMoreContrast
import com.zoonk.android.ui.theme.ZoonkRadius
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonkType
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
    val started =
        catalog.isStarted(
            chapterState.value
                ?.tryLesson
                ?.lessonId
                ?.toString(),
        )
    val place = state.value?.let { placeOf(it, route.chapterId) }
    val shown = if (state is LoadState.Loaded && place == null) LoadState.Failed(ApiError.NotFound) else state

    val report = FeedbackTarget("chapter", FeedbackSubmissionContext.ContentKind.CHAPTER, route.chapterId.toUuidOrNull())

    if (shown is LoadState.Loaded) TrackShown(AnalyticsEvent.PublicPageViewed(route.chapterId, AnalyticsEvent.PublicPage.Chapter))
    CatalogPage(app, navigator, detail, shown, place?.chapter?.title, report, alsoShown = listOf(chapter)) { value, layout ->
        placeOf(
            value,
            route.chapterId,
        )?.let { chapterBlocks(app, navigator, value, it, chapterState.value?.tryLesson, started, layout) }.orEmpty()
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

private fun chapterBlocks(
    app: AppContainer,
    navigator: AppNavigator,
    detail: CourseDetail,
    place: ChapterPlace,
    tryLesson: CatalogTryLesson?,
    started: Boolean,
    layout: CatalogPageLayout,
): List<CatalogBlock> {
    val chapter = place.chapter
    val courseId = detail.course.id.toString()
    val hasLesson = chapter.lessons.isNotEmpty()
    val startChapterId = chapter.id.toString().takeIf { hasLesson && place.number > 1 }

    return buildList {
        add(
            CatalogBlock("hero") {
                val hero = @Composable { modifier: Modifier ->
                    Column(modifier.widthIn(max = COLUMN_WIDTH)) {
                        CourseEyebrow(navigator, detail)
                        Spacer(Modifier.size(8.dp))
                        Text(
                            chapter.title,
                            modifier = Modifier.pageTitle(),
                            style = MaterialTheme.typography.displaySmall,
                        )
                        Spacer(Modifier.size(12.dp))
                        Text(chapter.description, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.zoonkType.lead)
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
                            tryLesson,
                            started,
                            Modifier.weight(1f),
                        )
                    }
                } else {
                    hero(Modifier)
                }
            },
        )

        if (tryLesson != null && !layout.beside) {
            add(CatalogBlock("try") { TryLessonCard(app, navigator, tryLesson, started) })
        }

        if (place.total > 1) {
            add(CatalogBlock("strip", trailing = true) { ChapterStrip(navigator, detail, place) })
        }

        if (hasLesson) {
            add(
                // A chapter's way in is its lessons: on an open book they stay on the page before the fold.
                CatalogBlock("lessons") {
                    val lessons = @Composable { modifier: Modifier -> ChapterLessons(navigator, courseId, place, modifier) }

                    if (layout.beside && chapter.objectives.isNotEmpty()) {
                        Row(horizontalArrangement = Arrangement.spacedBy(64.dp)) {
                            lessons(Modifier.weight(1f))
                            ChapterObjectives(chapter.objectives, Modifier.weight(1f))
                        }
                    } else {
                        lessons(Modifier)
                    }
                },
            )
        }

        if (chapter.objectives.isNotEmpty() && !(layout.beside && hasLesson)) {
            add(CatalogBlock("objectives", trailing = true) { ChapterObjectives(chapter.objectives) })
        }

        add(
            CatalogBlock("closing", trailing = true) {
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
                        stringResource(
                            if (startChapterId !=
                                null
                            ) {
                                R.string.catalog_chapter_closing_steps
                            } else {
                                R.string.catalog_closing_steps
                            },
                        ),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodyLarge,
                    )
                    Spacer(Modifier.size(24.dp))
                    ChapterStart(app, navigator, courseId, startChapterId, hasLesson)
                }
            },
        )
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

/** Main's `ChapterStrip`: where the chapter sits among the course's levels, and the chapters after it on the course's route. */
@Composable
private fun ChapterStrip(
    navigator: AppNavigator,
    detail: CourseDetail,
    place: ChapterPlace,
) {
    val locale = currentLocale()
    val chapterId = place.chapter.id.toString()
    val position =
        stringResource(
            R.string.catalog_chapter_position,
            formatNumber(place.number.toDouble(), locale),
            formatNumber(place.total.toDouble(), locale),
        )
    val label = position + FACT_SEPARATOR + place.chapter.level.label()
    val stretch = detail.chapters.drop(place.number - 1).take(NEXT_CHAPTERS + 1)
    val subject =
        Subject
            .of(
                detail.course.categories
                    .firstOrNull()
                    ?.value,
            ).colors.color
    val route = if (LocalMoreContrast.current) subject else subject.copy(alpha = ROUTE_LINE_ALPHA)

    Column(verticalArrangement = Arrangement.spacedBy(24.dp)) {
        SectionTitle(stringResource(R.string.catalog_chapter_strip))

        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            CourseMap(
                detail.chapters
                    .groupBy { it.level }
                    .values
                    .toList(),
                chapterId,
                route,
            )
            Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
        }

        Column {
            stretch.forEachIndexed { offset, chapter ->
                RouteStop(
                    title = chapter.title,
                    note =
                        when (offset) {
                            0 -> stringResource(R.string.catalog_this_chapter)
                            1 -> stringResource(R.string.catalog_after_this_chapter)
                            else -> null
                        },
                    here = offset == 0,
                    last = offset == stretch.lastIndex,
                    line = route,
                    stop = subject,
                    onOpen =
                        if (offset == 0) {
                            null
                        } else {
                            { navigator.open(AppRoute.CatalogChapter(chapter.id.toString(), detail.course.id.toString())) }
                        },
                )
            }
        }
    }
}

/** Main's `CourseMap`: each level a band as long as its chapters, the route through them, and a ring on this chapter. */
@Composable
private fun CourseMap(
    levels: List<List<CourseChapter>>,
    chapterId: String,
    line: Color,
) {
    val band = MaterialTheme.colorScheme.surfaceContainerHigh
    val ink = MaterialTheme.colorScheme.onSurface

    Row(Modifier.fillMaxWidth().clearAndSetSemantics {}, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        levels.forEach { chapters ->
            val here = chapters.indexOfFirst { it.id.toString() == chapterId }
            Box(
                Modifier
                    .weight(chapters.size.toFloat())
                    .height(28.dp)
                    .background(band, RoundedCornerShape(ZoonkRadius.md))
                    .drawBehind {
                        val thickness = ROUTE_WIDTH.toPx()
                        drawRect(line, Offset(0f, (size.height - thickness) / 2), Size(size.width, thickness))
                        if (here >= 0) {
                            val inset = 4.dp.toPx()
                            val slot = (size.width - inset * 2) / chapters.size
                            val start = inset + slot * (here + 0.5f)
                            val x = if (layoutDirection == LayoutDirection.Rtl) size.width - start else start
                            val ring = 3.dp.toPx()
                            val radius = 7.dp.toPx()
                            drawCircle(band, radius, Offset(x, size.height / 2))
                            drawCircle(ink, radius - ring / 2, Offset(x, size.height / 2), style = Stroke(ring))
                        }
                    },
            )
        }
    }
}

/**
 * Main's chapter on the route: a station on the line beside its title, this chapter's a ring in
 * ink, the line fading out after the [last] one. [onOpen] opens a chapter after this one.
 */
@Composable
private fun RouteStop(
    title: String,
    note: String?,
    here: Boolean,
    last: Boolean,
    line: Color,
    stop: Color,
    onOpen: (() -> Unit)?,
) {
    val ink = MaterialTheme.colorScheme.onSurface
    val ground = MaterialTheme.colorScheme.surface

    Column(
        Modifier
            .fillMaxWidth()
            .then(if (onOpen == null) Modifier.semantics { selected = true } else Modifier.clickable(onClick = onOpen))
            .drawBehind {
                val x = ROUTE_X.toPx()
                val top = ROUTE_X.toPx()
                val width = ROUTE_WIDTH.toPx()
                val left = if (layoutDirection == LayoutDirection.Rtl) size.width - x - width / 2 else x - width / 2
                val brush =
                    if (last) {
                        Brush.verticalGradient(
                            listOf(line, Color.Transparent),
                            startY = top,
                            endY = size.height,
                        )
                    } else {
                        SolidColor(line)
                    }
                drawRect(brush, Offset(left, top), Size(width, size.height - top))
                val center = Offset(left + width / 2, top)
                val ring = (if (here) 3.dp else 2.5.dp).toPx()
                val radius = (if (here) 8.dp else 7.dp).toPx()
                drawCircle(ground, radius, center)
                drawCircle(if (here) ink else stop, radius - ring / 2, center, style = Stroke(ring))
            }.padding(start = ROUTE_INSET, bottom = if (last) 0.dp else 20.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        note?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall) }
        Text(
            title,
            style = MaterialTheme.typography.titleMedium.copy(fontSize = 15.sp, lineHeight = 21.sp),
            fontWeight = if (here) FontWeight.SemiBold else FontWeight.Medium,
        )
    }
}

/** Main's route: `--route-x`, `--route-inset` and its line's width. */
private val ROUTE_X = 8.dp
private val ROUTE_INSET = 28.dp
private val ROUTE_WIDTH = 4.dp

/** Main's `--route-line`: the subject's color at 35%, whole with more contrast. */
private const val ROUTE_LINE_ALPHA = 0.35f

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
    ).factsLine()
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
