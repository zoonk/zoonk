package com.zoonk.android.feature.catalog

import android.icu.text.ListFormatter
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
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
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
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.AnalyticsEvent
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.SessionState
import com.zoonk.android.data.TrackShown
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.feedback.FeedbackTarget
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.Subject
import com.zoonk.android.ui.components.SubjectLabel
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
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

    if (state is LoadState.Loaded) TrackShown(AnalyticsEvent.PublicPageViewed(route.courseId, AnalyticsEvent.PublicPage.Course))
    CatalogPage(app, navigator, detail, state, title, report) { value, layout -> courseBlocks(app, navigator, value, started, layout) }
}

private fun courseBlocks(
    app: AppContainer,
    navigator: AppNavigator,
    detail: CourseDetail,
    started: Boolean,
    layout: CatalogPageLayout,
): List<CatalogBlock> {
    val course = detail.course
    val plan = course.examplePlan
    val tryLesson = course.tryLesson
    val courseId = course.id.toString()
    val promise = course.landingPage?.valueProposition?.takeIf { it.isNotBlank() } ?: course.description
    val pace = plan?.pace?.minutes
    val audience = course.landingPage?.audience.orEmpty()
    val outcomes = course.landingPage?.outcomes.orEmpty()
    val beside = layout.beside

    return buildList {
        add(
            CatalogBlock("hero") {
                val scope = rememberCoroutineScope()
                val hero = @Composable { modifier: Modifier ->
                    CourseHero(
                        app = app,
                        navigator = navigator,
                        course = course,
                        promise = promise,
                        pace = pace,
                        onTryLesson =
                            tryLesson?.takeUnless { beside }?.let {
                                {
                                    scope.launch {
                                        layout.listState.animateScrollToItem(
                                            1,
                                        )
                                    }
                                }
                            },
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
            },
        )

        if (tryLesson != null && !beside) {
            add(CatalogBlock("try") { TryLessonCard(app, navigator, tryLesson, started) })
        }

        if (plan?.pace != null) {
            add(CatalogBlock("plan") { CoursePlanSection(plan, detail.chapters, course.format == CourseResource.Format.EXAM, beside) })
        }

        if (audience.isNotEmpty() || outcomes.isNotEmpty()) {
            add(CatalogBlock("fit", trailing = true) { CourseFit(audience, outcomes, beside) })
        }

        add(
            CatalogBlock("outline", trailing = true) {
                val session by app.sessions.state.collectAsStateWithLifecycle()
                val summary by app.learnerSummary.summary.collectShown()
                val hasSession = session is SessionState.SignedIn || session == SessionState.Restoring
                CourseOutline(
                    navigator,
                    courseId,
                    detail.chapters,
                    plan,
                    lead = course.description.takeIf { it != promise },
                    openLevel = outlineLevel(detail.chapters, courseId, hasSession, summary),
                    levels = course.levels,
                    goal = summary.value?.goalOnCourse(courseId),
                    examples = showsExamples(courseId, hasSession, summary),
                    disclosures = layout.disclosures,
                )
            },
        )

        add(CatalogBlock("closing", trailing = true) { CourseClosing(app, navigator, courseId, pace) })
    }
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
    beside: Boolean,
) {
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

        beside -> {
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
