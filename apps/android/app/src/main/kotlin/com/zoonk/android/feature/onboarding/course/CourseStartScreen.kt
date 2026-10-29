package com.zoonk.android.feature.onboarding.course

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.createSavedStateHandle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.SessionState
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.catalog.CatalogNotFound
import com.zoonk.android.feature.catalog.CatalogStore
import com.zoonk.android.feature.catalog.CourseDetail
import com.zoonk.android.feature.catalog.goalOnCourse
import com.zoonk.android.feature.onboarding.GoalError
import com.zoonk.android.feature.onboarding.GoalLimitReason
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.goalStartLimit
import com.zoonk.android.feature.onboarding.setup.LevelChoiceList
import com.zoonk.android.feature.onboarding.setup.SetupColumn
import com.zoonk.android.feature.onboarding.setup.StepHeading
import com.zoonk.android.feature.onboarding.start.GoalFooter
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.scaffold.PageScaffold
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.CourseChapter
import kotlinx.coroutines.launch

@Composable
fun CourseStartScreen(
    route: AppRoute.CourseStart,
    app: AppContainer,
    navigator: AppNavigator,
) {
    val session by app.sessions.state.collectAsStateWithLifecycle()
    val summary by app.learnerSummary.summary.collectShown()
    CourseStartScreen(
        route = route,
        catalog = app.catalog,
        store = app.onboarding,
        signedIn = session is SessionState.SignedIn,
        existingGoalId =
            summary.value
                ?.goalOnCourse(route.courseId)
                ?.id
                ?.toString(),
        navigator = navigator,
    )
}

/** Opening it creates nothing: only Build my plan starts the course, and a course a goal already follows opens that goal. */
@Composable
internal fun CourseStartScreen(
    route: AppRoute.CourseStart,
    catalog: CatalogStore,
    store: OnboardingStore,
    signedIn: Boolean,
    existingGoalId: String?,
    navigator: AppNavigator,
) {
    val vm = viewModel { CourseStartViewModel(store, createSavedStateHandle()) }
    val resource = catalog.course[route.courseId]
    val state by resource.collectShown()
    val allowance by store.allowance.collectShown()
    val scope = rememberCoroutineScope()
    val openGoal = { goalId: String, inSetup: Boolean ->
        navigator.closeSection()
        if (inSetup) navigator.open(AppRoute.GoalSetup(goalId)) else navigator.showRoot(AppTab.Today)
    }
    val started = vm.started
    // A start that just made the goal leads there itself, though the summary may name it first.
    if (started != null) {
        LaunchedEffect(started) { openGoal(started.goalId, started.inSetup) }
    } else if (existingGoalId != null && !vm.isStarting) {
        LaunchedEffect(existingGoalId) { openGoal(existingGoalId, store.inSetup(existingGoalId)) }
    }

    PageScaffold(
        onBack = navigator::back,
        actions = {
            if (!signedIn) TextButton(onClick = { navigator.open(AppRoute.Login) }) { Text(stringResource(R.string.gate_log_in)) }
        },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding).consumeWindowInsets(padding)) {
            when (val shown = state) {
                is LoadState.Loaded -> {
                    if (existingGoalId == null) {
                        CourseStartForm(shown.value, route, vm, allowance.value?.goalStartLimit(), signedIn, navigator)
                    } else {
                        Loading()
                    }
                }

                is LoadState.Failed -> {
                    if (shown.error == ApiError.NotFound) {
                        CatalogNotFound(navigator)
                    } else {
                        LoadFailedMessage(onRetry = { scope.launch { resource.refresh() } })
                    }
                }

                LoadState.Empty -> {
                    CatalogNotFound(navigator)
                }

                LoadState.Idle, LoadState.Loading -> {
                    Loading()
                }
            }
        }
    }
}

@Composable
private fun Loading() {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
}

@Composable
private fun CourseStartForm(
    detail: CourseDetail,
    route: AppRoute.CourseStart,
    vm: CourseStartViewModel,
    upFront: GoalLimitReason?,
    signedIn: Boolean,
    navigator: AppNavigator,
) {
    val course = detail.course
    val chapter = detail.chapters.find { it.id.toString() == route.chapterId && it.lessonCount > 0 }
    val planned = chapter?.let { detail.chapters.drop(detail.chapters.indexOf(it)) } ?: detail.chapters
    val limit = (vm.failure as? CourseStartFailure.Limit)?.reason ?: upFront.takeIf { vm.failure == null }
    val blocked = limit != null && (limit.needsAccount || limit == GoalLimitReason.OneActiveGoal)
    val minutes = route.dailyMinutes?.takeIf { it in MIN_DAILY_MINUTES..MAX_DAILY_MINUTES }
    val start = { vm.start(course.id.toString(), chapter?.id?.toString(), minutes) }
    val remedy = { to: AppRoute ->
        vm.clearFailure()
        navigator.open(to)
    }

    SetupColumn {
        when {
            chapter != null -> {
                StepHeading(chapter.title, stringResource(R.string.onboarding_course_chapter_description), subject = course.title)
            }

            blocked -> {
                StepHeading(course.title, stringResource(R.string.onboarding_course_follows))
            }

            else -> {
                StepHeading(
                    stringResource(R.string.onboarding_level_title),
                    stringResource(R.string.onboarding_level_description),
                    subject = course.title,
                )
            }
        }

        if (!blocked) {
            minutes?.let {
                Text(
                    pluralStringResource(R.plurals.onboarding_course_daily_minutes, it, it),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
            if (chapter != null) PlanPreview(planned) else LevelChoiceList(vm.level, onChange = vm::pick)
        }

        GoalFooter(
            error = limit?.let(GoalError::Limit),
            onCreateAccount = { remedy(AppRoute.Login) },
            onOpenPlan = { remedy(AppRoute.Plan()) },
            onSeePlus = { remedy(AppRoute.Subscription) },
        ) {
            if (vm.failure == CourseStartFailure.Failed) {
                Text(
                    stringResource(R.string.onboarding_course_failed),
                    modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
            if (!blocked) {
                Button(
                    onClick = start,
                    enabled = !vm.isStarting && (chapter != null || vm.level != null),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    if (vm.isStarting) {
                        CircularProgressIndicator(
                            Modifier.size(ButtonDefaults.IconSize),
                            color = LocalContentColor.current,
                            strokeWidth = 2.dp,
                        )
                        Spacer(Modifier.size(ButtonDefaults.IconSpacing))
                    }
                    Text(stringResource(R.string.onboarding_course_build))
                }
                if (!signedIn) {
                    Text(
                        stringResource(R.string.onboarding_course_start_free),
                        modifier = Modifier.fillMaxWidth(),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center,
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
            }
        }
    }
}

/** The chapters a chapter's start plans, the first few by name. */
@Composable
private fun PlanPreview(chapters: List<CourseChapter>) {
    val lessons = chapters.sumOf { it.lessonCount }.toInt()
    val more = chapters.size - PREVIEW_CHAPTERS
    val muted = MaterialTheme.colorScheme.onSurfaceVariant

    Column {
        Text(
            pluralStringResource(R.plurals.onboarding_course_chapters, chapters.size, chapters.size) + " · " +
                pluralStringResource(R.plurals.onboarding_course_lessons, lessons, lessons),
            modifier = Modifier.semantics { heading() },
            color = muted,
            style = MaterialTheme.typography.labelMedium.withTabularFigures(),
        )
        chapters.take(PREVIEW_CHAPTERS).forEachIndexed { index, chapter ->
            if (index > 0) HorizontalDivider()
            Row(Modifier.padding(vertical = 10.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    "${index + 1}",
                    modifier = Modifier.width(16.dp).alignByBaseline(),
                    color = muted,
                    style = MaterialTheme.typography.labelMedium.withTabularFigures(),
                )
                Text(
                    chapter.title,
                    modifier = Modifier.alignByBaseline(),
                    fontWeight = FontWeight.Medium,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        }
        if (more > 0) {
            Text(
                pluralStringResource(R.plurals.onboarding_course_more_chapters, more, more),
                modifier = Modifier.padding(start = 28.dp),
                color = muted,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
    }
}

private const val PREVIEW_CHAPTERS = 4
private const val MIN_DAILY_MINUTES = 5
private const val MAX_DAILY_MINUTES = 1440
