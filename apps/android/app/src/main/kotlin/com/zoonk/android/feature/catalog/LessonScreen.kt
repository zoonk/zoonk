package com.zoonk.android.feature.catalog

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.Resource
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.api.models.CatalogLesson
import com.zoonk.api.models.CatalogLessonFirstScreen
import kotlinx.coroutines.launch

/** A lesson's public page: its first screen to answer, what it teaches, its chapter and the day of a plan it's in. */
@Composable
fun LessonScreen(
    route: AppRoute.CatalogLesson,
    app: AppContainer,
    navigator: AppNavigator,
    catalog: CatalogStore = app.catalog,
) {
    val detail = catalog.course[route.courseId]
    val lesson = catalog.lesson[route.lessonId]
    val state by detail.collectShown()
    val lessonState by lesson.collectShown()
    val place = state.value?.let { placeOf(it, route.chapterId) }
    val outlineLesson = place?.chapter?.lessons?.firstOrNull { it.id.toString() == route.lessonId }
    val missing = (state is LoadState.Loaded && outlineLesson == null) || (lessonState as? LoadState.Failed)?.error == ApiError.NotFound
    val shown = if (missing) LoadState.Failed(ApiError.NotFound) else state

    CatalogPage(app, navigator, detail, shown, outlineLesson?.title) { value, _ ->
        val found = placeOf(value, route.chapterId) ?: return@CatalogPage
        lessonContent(app, navigator, value, found, route.lessonId, lesson, lessonState)
    }
}

private fun LazyListScope.lessonContent(
    app: AppContainer,
    navigator: AppNavigator,
    detail: CourseDetail,
    place: ChapterPlace,
    lessonId: String,
    lesson: Resource<CatalogLesson>,
    state: LoadState<CatalogLesson>,
) {
    val outlineLesson = place.chapter.lessons.first { it.id.toString() == lessonId }
    val courseId = detail.course.id.toString()
    val page = state.value

    item(key = "lesson", contentType = "lesson") {
        Column(Modifier.widthIn(max = COLUMN_WIDTH)) {
            CourseEyebrow(navigator, detail)
            Spacer(Modifier.size(8.dp))
            Text(outlineLesson.title, modifier = Modifier.semantics { heading() }, style = MaterialTheme.typography.headlineLarge)

            page?.description?.let {
                Spacer(Modifier.size(12.dp))
                Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.titleMedium)
            }

            Spacer(Modifier.size(32.dp))

            when (state) {
                is LoadState.Loaded -> {
                    LessonFirstScreen(app, navigator, state.value)
                }

                is LoadState.Failed -> {
                    val scope = rememberCoroutineScope()
                    LoadFailedMessage(onRetry = { scope.launch { lesson.refresh() } })
                }

                else -> {
                    Box(Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
                }
            }

            Spacer(Modifier.size(48.dp))
            LessonMore(navigator, courseId, place, lessonId, page?.summaryIdeas.orEmpty())
        }
    }

    item(key = "plan-day", contentType = "plan-day") { LessonPlanDay(app, navigator, detail, place, lessonId) }
}

@Composable
private fun LessonFirstScreen(
    app: AppContainer,
    navigator: AppNavigator,
    lesson: CatalogLesson,
) {
    val lessonId = lesson.id.toString()
    val minutes = lesson.estimatedMinutes.toInt()
    val note =
        pluralStringResource(R.plurals.catalog_lesson_minutes, minutes, minutes) +
            if (isVisitor(app)) " " + stringResource(R.string.catalog_no_sign_up) else ""
    val start = @Composable {
        Button(onClick = { navigator.open(AppRoute.Lesson(lessonId)) }) { Text(stringResource(R.string.catalog_start_lesson)) }
        Spacer(Modifier.size(16.dp))
        LineWithIcon(R.drawable.ic_play_circle, note, style = MaterialTheme.typography.bodySmall)
    }

    when (val screen = lesson.firstScreen) {
        is CatalogLessonFirstScreen.ChoiceWrapper -> {
            FirstQuestion(app, navigator, lessonId, lesson.estimatedMinutes, screen.value)
        }

        is CatalogLessonFirstScreen.TextWrapper -> {
            Column {
                Text(screen.value.text, style = MaterialTheme.typography.titleLarge)
                Spacer(Modifier.size(24.dp))
                start()
            }
        }

        else -> {
            Column { start() }
        }
    }
}

/** What the lesson teaches and its chapter's lessons, each behind its own disclosure. */
@Composable
private fun LessonMore(
    navigator: AppNavigator,
    courseId: String,
    place: ChapterPlace,
    lessonId: String,
    ideas: List<String>,
) {
    val locale = currentLocale()
    val chapter = place.chapter
    val minutes = chapter.lessons.sumOf { it.estimatedMinutes }

    Column {
        if (ideas.isNotEmpty()) {
            OutlineZone(
                title = stringResource(R.string.catalog_what_you_learn),
                aside = pluralStringResource(R.plurals.catalog_ideas, ideas.size, ideas.size),
                closedSummary = null,
                initiallyOpen = false,
            ) {
                Column(Modifier.padding(bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    ideas.forEach { idea ->
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            Box(
                                Modifier
                                    .padding(top = 10.dp)
                                    .size(6.dp)
                                    .background(MaterialTheme.colorScheme.onSurfaceVariant, CircleShape),
                            )
                            Text(idea, style = MaterialTheme.typography.bodyLarge)
                        }
                    }
                }
            }
        }

        OutlineZone(
            title = stringResource(R.string.catalog_chapter_heading, formatNumber(place.number.toDouble(), locale), chapter.title),
            aside =
                pluralStringResource(R.plurals.catalog_plan_lessons, chapter.lessons.size, chapter.lessons.size) + SEPARATOR +
                    formatTotalDuration(minutes.toDouble(), locale),
            closedSummary = null,
            initiallyOpen = false,
        ) {
            Column(Modifier.padding(bottom = 16.dp)) {
                ChapterLessons(navigator, courseId, place, currentLessonId = lessonId, title = chapter.title)
                TextButton(onClick = { navigator.open(AppRoute.CatalogChapter(chapter.id.toString(), courseId)) }) {
                    Text(stringResource(R.string.catalog_go_to_chapter))
                    Spacer(Modifier.size(8.dp))
                    Icon(painterResource(R.drawable.ic_arrow_forward), contentDescription = null, Modifier.size(18.dp))
                }
            }
        }

        HorizontalDivider()
    }
}

/** Main's `LessonPlanDay`: the lesson among its neighbors as a day of a plan would hold them. */
@Composable
private fun LessonPlanDay(
    app: AppContainer,
    navigator: AppNavigator,
    detail: CourseDetail,
    place: ChapterPlace,
    lessonId: String,
) {
    val locale = currentLocale()
    val lessons = place.chapter.lessons
    val index = lessons.indexOfFirst { it.id.toString() == lessonId }
    val start = (index - 1).coerceAtMost(lessons.size - DAY_LESSONS).coerceAtLeast(0)
    val steps =
        lessons.drop(start).take(DAY_LESSONS).mapIndexed { offset, lesson ->
            val position = start + offset
            DayStep(
                id = lesson.id.toString(),
                title = lesson.title,
                detail = place.chapter.title,
                minutes = lesson.estimatedMinutes.toDouble(),
                state =
                    when {
                        position < index -> DayStepState.Done
                        position == index -> DayStepState.Current
                        else -> DayStepState.Ahead
                    },
            )
        }

    Column(Modifier.widthIn(max = COLUMN_WIDTH).padding(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        Text(
            stringResource(R.string.catalog_lesson_part_of, detail.course.title),
            modifier = Modifier.semantics { heading() },
            style = MaterialTheme.typography.titleLarge,
        )

        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            FactsRow(
                title = stringResource(R.string.catalog_example_plan),
                facts =
                    pluralStringResource(R.plurals.catalog_plan_lessons, steps.size, steps.size) + SEPARATOR +
                        formatTotalDuration(steps.sumOf { it.minutes }, locale),
            )
            DayList(steps)
            Text(
                stringResource(R.string.catalog_plan_caption),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodySmall,
            )
        }

        StartActions(
            app = app,
            navigator = navigator,
            courseId = detail.course.id.toString(),
            chapterId =
                place.chapter.id
                    .toString()
                    .takeIf { place.number > 1 },
            secondary = true,
        )
    }
}

private const val DAY_LESSONS = 3
