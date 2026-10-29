package com.zoonk.android.feature.plan

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.app.LocalSnackbarHostState
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.ui.scaffold.PageWithSupportingPane
import com.zoonk.api.models.GoalProgress
import com.zoonk.api.models.GoalUpdateInput
import com.zoonk.api.models.LearnerSummary
import com.zoonk.api.models.LearnerSummaryGoal
import com.zoonk.api.models.Plan
import com.zoonk.api.models.Syllabus
import java.time.LocalDate

/** What every part of the Plan reads: the goal, its plan and the learner's frame. */
@Immutable
data class PlanPageState(
    val goal: LearnerSummaryGoal,
    val plan: Plan,
    val summary: LearnerSummary,
) {
    val today: LocalDate = plan.today
    val isExam: Boolean get() = goal.kind == LearnerSummaryGoal.Kind.EXAM
    val isPaused: Boolean get() = goal.status == LearnerSummaryGoal.Status.PAUSED
    val mocksRequirePlus: Boolean get() = plan.access.mocksRequirePlus
    val finish: PlanFinish? = plan.finish(goal.kind)
}

/** Where the Plan's rows lead (main's `JourneyLinks`). */
class PlanLinks(
    private val navigator: AppNavigator,
    private val page: PlanPageState,
) {
    val hasExam: Boolean get() = page.isExam
    val hasMindMaps: Boolean get() = page.summary.places.mindMaps

    fun chapter(chapterId: String) =
        navigator.open(
            if (page.goal.kind ==
                LearnerSummaryGoal.Kind.LANGUAGE
            ) {
                AppRoute.LanguageUnit(chapterId)
            } else {
                AppRoute.Chapter(chapterId)
            },
        )

    fun challenge(planItemId: String) = navigator.open(AppRoute.Challenge(planItemId))

    fun exam() = navigator.open(AppRoute.Exam)

    fun mindMaps() = navigator.open(AppRoute.MindMaps)

    fun logbook() = navigator.open(AppRoute.Logbook)

    fun course(courseId: String) = navigator.open(AppRoute.CatalogCourse(courseId))

    fun buddy() = navigator.open(AppRoute.Buddy())
}

@Composable
internal fun PlanPage(
    page: PlanPageState,
    app: AppContainer,
    navigator: AppNavigator,
    viewModel: PlanViewModel,
) {
    val syllabus by app.plans.syllabus[page.goal.id].collectShown()
    val progress by app.plans.progress[page.goal.id].collectShown()
    val resumeChangesPlan =
        if (page.isPaused) {
            app.plans.resumeChangesPlan[page.goal.id]
                .collectShown()
                .value
                .value ?: false
        } else {
            false
        }
    val isSaving by viewModel.isSaving.collectAsStateWithLifecycle()

    PlanEvents(viewModel, navigator)

    PlanContent(
        page = page,
        standing = standingOf(page, progress.value, syllabus.value),
        links = PlanLinks(navigator, page),
        resumeChangesPlan = resumeChangesPlan,
        isSaving = isSaving,
        onSetStatus = viewModel::setStatus,
    )
}

/** The Plan's main column and, where there's room, its numbers and settings beside it. */
@Composable
internal fun PlanContent(
    page: PlanPageState,
    standing: Standing?,
    links: PlanLinks,
    resumeChangesPlan: Boolean,
    isSaving: Boolean,
    onSetStatus: (GoalUpdateInput.Status) -> Unit,
) {
    val numbers = @Composable { variant: NumberVariant -> standing?.let { PlanNumbers(page, it, variant, links) } }

    PageWithSupportingPane(
        supportingPane = {
            Column(
                modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(32.dp),
            ) {
                numbers(NumberVariant.Stats)
                NextOnPath(page, links)
                PlanProperties(page, links)
            }
        },
    ) { asideBeside ->
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(24.dp),
        ) {
            item(key = "header", contentType = "header") {
                PlanHeader(
                    page = page,
                    links = links,
                    resumeChangesPlan = resumeChangesPlan,
                    isSaving = isSaving,
                    onSetStatus = onSetStatus,
                )
            }
            item(key = "roadmap", contentType = "roadmap") { PlanRoadmap(page, links) }
            if (!asideBeside) {
                item(key = "numbers", contentType = "numbers") { numbers(NumberVariant.Tiles) }
            }
            item(key = "path", contentType = "path") { PathSection(page, links) }
            if (!asideBeside) {
                item(key = "next", contentType = "next") { NextOnPath(page, links) }
                item(key = "more", contentType = "more") { MoreSection(links) }
            }
        }
    }
}

@Composable
private fun PlanEvents(
    viewModel: PlanViewModel,
    navigator: AppNavigator,
) {
    val snackbars: SnackbarHostState = LocalSnackbarHostState.current
    val context = LocalContext.current

    LaunchedEffect(viewModel) {
        viewModel.events.collect { event ->
            when (event) {
                PlanEvent.Archived -> navigator.select(AppTab.Today)
                PlanEvent.GoalLimitReached -> snackbars.showSnackbar(context.getString(R.string.plan_goal_limit_reached))
                PlanEvent.SaveFailed -> snackbars.showSnackbar(context.getString(R.string.plan_save_failed))
            }
        }
    }
}

/** The number beside the pace: the exam's preparation, the goal's progress, or a language's level. */
internal sealed interface Standing {
    data class Preparation(
        val progress: GoalProgress,
    ) : Standing

    data class Progress(
        val progress: GoalProgress,
        val done: Long,
        val total: Long,
    ) : Standing
}

internal fun standingOf(
    page: PlanPageState,
    progress: GoalProgress?,
    syllabus: Syllabus?,
): Standing? {
    if (page.goal.kind == LearnerSummaryGoal.Kind.LANGUAGE) return null
    val preparation = progress?.preparation ?: return null
    if (preparation.goalId != page.goal.id) return null
    if (page.isExam) return Standing.Preparation(progress)
    val lessons = syllabus?.lessons
    return Standing.Progress(progress, lessons?.done ?: 0, lessons?.total ?: 0)
}
