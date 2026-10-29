package com.zoonk.android.feature.catalog

import android.icu.text.ListFormatter
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.material3.adaptive.currentWindowAdaptiveInfoV2
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.window.core.layout.WindowSizeClass
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.Resource
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.feedback.FeedbackTarget
import com.zoonk.android.feature.feedback.ReportProblemMenu
import com.zoonk.android.feature.search.SearchAction
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.components.StatusMessage
import com.zoonk.android.ui.components.Subject
import com.zoonk.android.ui.components.SubjectLabel
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.scaffold.PageScaffold
import com.zoonk.api.models.CourseResource
import com.zoonk.api.models.FeedbackSubmissionContext
import kotlinx.coroutines.launch
import kotlinx.datetime.toJavaLocalDate

@Composable
fun CourseScreen(
    route: AppRoute.CatalogCourse,
    app: AppContainer,
    navigator: AppNavigator,
    catalog: CatalogStore = app.catalog,
) {
    val detail = catalog.course[route.courseId]
    val state by detail.collectShown()
    val title = (state as? LoadState.Loaded)?.value?.course?.title
    val started =
        catalog.isStarted(
            state.value
                ?.course
                ?.tryLesson
                ?.lessonId
                ?.toString(),
        )

    val report = FeedbackTarget("course", FeedbackSubmissionContext.ContentKind.COURSE, route.courseId.toUuidOrNull())

    CatalogPage(app, navigator, detail, state, title, report) { value, layout ->
        courseContent(app, navigator, value, started, layout)
    }
}

/**
 * A catalog page's frame (main's `CatalogPageBar` and its states): its title in the top app bar,
 * pull to refresh, the loading wheel only while nothing is cached, and main's not-found page.
 */
@Composable
internal fun <T : Any> CatalogPage(
    app: AppContainer,
    navigator: AppNavigator,
    resource: Resource<T>,
    state: LoadState<T>,
    title: String?,
    report: FeedbackTarget? = null,
    alsoShown: List<Resource<*>> = emptyList(),
    content: LazyListScope.(T, CatalogPageLayout) -> Unit,
) {
    val scope = rememberCoroutineScope()
    val isRefreshing by resource.isRefreshing.collectAsStateWithLifecycle()
    val listState = rememberLazyListState()
    var listTop by remember { mutableFloatStateOf(0f) }
    var headlineBottom by remember { mutableFloatStateOf(Float.POSITIVE_INFINITY) }
    val headlineScrolledAway by remember(listState) { derivedStateOf { listState.firstVisibleItemIndex > 0 || headlineBottom < listTop } }
    val refresh: () -> Unit = { (listOf(resource) + alsoShown).forEach { scope.launch { it.refresh() } } }
    val sizeClass = currentWindowAdaptiveInfoV2().windowSizeClass
    val wide = sizeClass.isWidthAtLeastBreakpoint(WindowSizeClass.WIDTH_DP_MEDIUM_LOWER_BOUND)
    val layout =
        CatalogPageLayout(
            listState = listState,
            beside = sizeClass.isWidthAtLeastBreakpoint(WindowSizeClass.WIDTH_DP_EXPANDED_LOWER_BOUND),
            headline = Modifier.onGloballyPositioned { headlineBottom = it.boundsInWindow().bottom },
        )

    PageScaffold(
        onBack = { navigator.back() },
        title = { if (headlineScrolledAway) title?.let { Text(it, maxLines = 1, overflow = TextOverflow.Ellipsis) } },
        actions = {
            SearchAction()
            if (report != null && state is LoadState.Loaded) ReportProblemMenu(app, report)
        },
    ) { padding ->
        PullToRefreshBox(
            isRefreshing = isRefreshing,
            onRefresh = refresh,
            modifier = Modifier.fillMaxSize().padding(padding),
        ) {
            when (state) {
                LoadState.Idle, LoadState.Loading -> {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
                }

                is LoadState.Failed -> {
                    if (state.error == ApiError.NotFound) {
                        CatalogNotFound(navigator)
                    } else {
                        LoadFailedMessage(onRetry = refresh)
                    }
                }

                LoadState.Empty -> {
                    CatalogNotFound(navigator)
                }

                is LoadState.Loaded -> {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
                        LazyColumn(
                            state = listState,
                            modifier =
                                Modifier.widthIn(max = PAGE_WIDTH).fillMaxSize().onGloballyPositioned {
                                    listTop =
                                        it.boundsInWindow().top
                                },
                            contentPadding = PaddingValues(horizontal = if (wide) 24.dp else 16.dp, vertical = 16.dp),
                            verticalArrangement = Arrangement.spacedBy(56.dp),
                        ) {
                            content(state.value, layout)
                        }
                    }
                }
            }
        }
    }
}

/** [beside] when the window is wide enough for main's paired first screen (the page beside the lesson to try). */
internal data class CatalogPageLayout(
    val listState: LazyListState,
    val beside: Boolean,
    /** Goes on the page's headline, so the top app bar takes the title once the headline scrolls under it. */
    val headline: Modifier,
)

/** A course, chapter or lesson that no longer exists is a not-found page inside the frame, as on main. */
@Composable
internal fun CatalogNotFound(navigator: AppNavigator) {
    StatusMessage(
        icon = R.drawable.ic_search_off,
        title = stringResource(R.string.catalog_not_found_title),
        description = stringResource(R.string.catalog_not_found_description),
    ) {
        Button(onClick = { navigator.open(AppRoute.Catalog()) }) { Text(stringResource(R.string.catalog_title)) }
    }
}

private fun LazyListScope.courseContent(
    app: AppContainer,
    navigator: AppNavigator,
    detail: CourseDetail,
    started: Boolean,
    layout: CatalogPageLayout,
) {
    val course = detail.course
    val plan = course.examplePlan
    val tryLesson = course.tryLesson
    val courseId = course.id.toString()
    val promise = course.landingPage?.valueProposition?.takeIf { it.isNotBlank() } ?: course.description
    val pace = plan?.pace?.minutes

    val beside = layout.beside

    item(key = "hero", contentType = "hero") {
        val scope = rememberCoroutineScope()
        val hero = @Composable { modifier: Modifier ->
            CourseHero(
                app = app,
                navigator = navigator,
                course = course,
                promise = promise,
                pace = pace,
                onTryLesson = tryLesson?.takeUnless { beside }?.let { { scope.launch { layout.listState.animateScrollToItem(1) } } },
                headlineModifier = layout.headline,
                modifier = modifier,
            )
        }

        if (beside && tryLesson != null) {
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
    }

    if (tryLesson != null && !beside) {
        item(key = "try", contentType = "try") {
            TryLessonCard(
                app,
                navigator,
                tryLesson,
                started,
            )
        }
    }

    if (plan?.pace != null) {
        item(
            key = "plan",
            contentType = "plan",
        ) { CoursePlanSection(plan, detail.chapters, course.format == CourseResource.Format.EXAM, beside) }
    }

    val audience = course.landingPage?.audience.orEmpty()
    val outcomes = course.landingPage?.outcomes.orEmpty()

    if (audience.isNotEmpty() || outcomes.isNotEmpty()) {
        item(key = "fit", contentType = "fit") { CourseFit(audience, outcomes) }
    }

    item(key = "outline", contentType = "outline") {
        CourseOutline(navigator, courseId, detail.chapters, plan, lead = course.description.takeIf { it != promise })
    }

    item(key = "closing", contentType = "closing") { CourseClosing(app, navigator, courseId, pace) }
}

@Composable
private fun CourseHero(
    app: AppContainer,
    navigator: AppNavigator,
    course: CourseResource,
    promise: String?,
    pace: Long?,
    onTryLesson: (() -> Unit)?,
    modifier: Modifier = Modifier,
    headlineModifier: Modifier = Modifier,
) {
    val locale = currentLocale()
    val language = catalogLanguage(locale)
    val edition =
        course.editions.firstOrNull { it.language.substringBefore('-') == language }?.takeIf {
            course.language.substringBefore('-') !=
                language
        }
    val subject = Subject.of(course.categories.firstOrNull()?.value)
    val exam = course.examplePlan?.exam

    Column(modifier.widthIn(max = COLUMN_WIDTH)) {
        if (edition != null) {
            OutlinedCard(
                modifier = Modifier.fillMaxWidth().padding(bottom = 24.dp),
                onClick = { navigator.open(AppRoute.CatalogCourse(edition.id.toString())) },
            ) {
                Row(
                    Modifier.padding(16.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        painterResource(R.drawable.ic_translate),
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Text(
                        stringResource(R.string.catalog_edition_notice),
                        modifier = Modifier.weight(1f),
                        style = MaterialTheme.typography.bodyMedium,
                    )
                    Icon(painterResource(R.drawable.ic_arrow_forward), contentDescription = null)
                }
            }
        }

        CourseMark(app, course.imageUrl, course.languageFlag, course.targetLanguage)
        Spacer(Modifier.size(20.dp))

        if (subject.label != null || exam != null) {
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
                itemVerticalAlignment = Alignment.CenterVertically,
            ) {
                SubjectLabel(subject)
                if (exam != null) {
                    val dates = ListFormatter.getInstance(locale).format(exam.days.map { formatDate(it.toJavaLocalDate(), locale) })
                    val days = exam.daysLeft.toInt()
                    val text =
                        when {
                            days == 0 && exam.estimated -> stringResource(R.string.catalog_exam_around_today, dates)
                            days == 0 -> stringResource(R.string.catalog_exam_on_today, dates)
                            exam.estimated -> pluralStringResource(R.plurals.catalog_exam_around, days, dates, days)
                            else -> pluralStringResource(R.plurals.catalog_exam_on, days, dates, days)
                        }
                    Text(text, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelLarge)
                }
            }
            Spacer(Modifier.size(12.dp))
        }

        Text(course.title, modifier = headlineModifier.semantics { heading() }, style = MaterialTheme.typography.headlineSmall)

        if (!promise.isNullOrBlank()) {
            Spacer(Modifier.size(16.dp))
            Text(promise, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyLarge)
        }

        Spacer(Modifier.size(16.dp))
        PlanLine(startsHere = false)
        Spacer(Modifier.size(24.dp))
        StartActions(app, navigator, course.id.toString(), dailyMinutes = pace, onTryLesson = onTryLesson)
    }
}

/** The details step writes only a few short lines, so they all show. */
@Composable
private fun CourseFit(
    audience: List<String>,
    outcomes: List<String>,
) {
    val wide = currentWindowAdaptiveInfoV2().windowSizeClass.isWidthAtLeastBreakpoint(WindowSizeClass.WIDTH_DP_EXPANDED_LOWER_BOUND)
    val audienceSection = @Composable { modifier: Modifier ->
        Column(modifier, verticalArrangement = Arrangement.spacedBy(16.dp)) {
            SectionTitle(stringResource(R.string.catalog_audience))
            Column(Modifier.widthIn(max = COLUMN_WIDTH)) {
                audience.forEachIndexed { index, line ->
                    if (index > 0) HorizontalDivider()
                    Text(line, modifier = Modifier.padding(vertical = 12.dp), style = MaterialTheme.typography.bodyLarge)
                }
            }
        }
    }
    val outcomesSection = @Composable { modifier: Modifier ->
        Column(modifier, verticalArrangement = Arrangement.spacedBy(16.dp)) {
            SectionTitle(stringResource(R.string.catalog_outcomes))
            CheckLines(outcomes)
        }
    }

    when {
        audience.isEmpty() -> {
            outcomesSection(Modifier)
        }

        outcomes.isEmpty() -> {
            audienceSection(Modifier)
        }

        wide -> {
            Row(horizontalArrangement = Arrangement.spacedBy(64.dp)) {
                audienceSection(Modifier.weight(1f))
                outcomesSection(Modifier.weight(1f))
            }
        }

        else -> {
            Column(verticalArrangement = Arrangement.spacedBy(32.dp)) {
                audienceSection(Modifier)
                outcomesSection(Modifier)
            }
        }
    }
}

@Composable
private fun CourseClosing(
    app: AppContainer,
    navigator: AppNavigator,
    courseId: String,
    pace: Long?,
) {
    val follows = followsCourse(app, courseId)

    Column(Modifier.widthIn(max = COLUMN_WIDTH).padding(bottom = 24.dp)) {
        Text(
            stringResource(if (follows) R.string.catalog_closing_follows else R.string.catalog_closing_start),
            modifier = Modifier.semantics { heading() },
            style = MaterialTheme.typography.titleMedium,
        )

        if (!follows) {
            Spacer(Modifier.size(8.dp))
            Text(
                stringResource(R.string.catalog_closing_steps),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyLarge,
            )
        }

        Spacer(Modifier.size(24.dp))
        StartActions(app, navigator, courseId, dailyMinutes = pace)
    }
}

/** Main's page column (`max-w-5xl`): the outline and plan read in one column however wide the window. */
private val PAGE_WIDTH = 1040.dp
