package com.zoonk.android.feature.plan

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.VerticalDivider
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.app.LocalSnackbarHostState
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.feedback.FeedbackTarget
import com.zoonk.android.feature.feedback.ReportProblem
import com.zoonk.android.feature.feedback.rememberReportProblem
import com.zoonk.android.feature.goalcontent.PlanSyllabusSection
import com.zoonk.android.feature.goalcontent.hasSubjectPages
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.ui.scaffold.PageWithSupportingPane
import com.zoonk.api.models.FeedbackSubmissionContext
import com.zoonk.api.models.GoalProgress
import com.zoonk.api.models.GoalUpdateInput
import com.zoonk.api.models.LearnerSummary
import com.zoonk.api.models.LearnerSummaryGoal
import com.zoonk.api.models.Plan
import com.zoonk.api.models.Syllabus
import java.time.LocalDate

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

class PlanLinks(
    private val navigator: AppNavigator,
    private val page: PlanPageState,
    private val leaving: () -> Unit = {},
) {
    val hasExam: Boolean get() = page.isExam
    val hasMindMaps: Boolean get() = page.summary.places.mindMaps

    fun chapter(chapterId: String) =
        open(
            if (page.goal.kind ==
                LearnerSummaryGoal.Kind.LANGUAGE
            ) {
                AppRoute.LanguageUnit(chapterId)
            } else {
                AppRoute.Chapter(chapterId)
            },
        )

    fun challenge(planItemId: String) = open(AppRoute.Challenge(planItemId))

    fun exam() = open(AppRoute.Exam)

    fun mindMaps() = open(AppRoute.MindMaps())

    fun logbook() = open(AppRoute.Logbook)

    fun course(courseId: String) = open(AppRoute.CatalogCourse(courseId))

    fun buddy() = open(AppRoute.Buddy())

    fun subject(key: String) = open(AppRoute.Subject(key))

    /** These links run [close] before leaving, so a sheet they're in doesn't stay over the page they open. */
    fun closing(close: () -> Unit) = PlanLinks(navigator, page) { close() }

    private fun open(route: AppRoute) {
        leaving()
        navigator.open(route)
    }
}

@Composable
internal fun PlanPage(
    page: PlanPageState,
    app: AppContainer,
    navigator: AppNavigator,
    viewModel: PlanViewModel,
    focus: String?,
) {
    val syllabus by app.plans.syllabus[page.goal.id].collectShown()
    val progress by app.plans.progress[page.goal.id].collectShown()
    val isSaving by viewModel.isSaving.collectAsStateWithLifecycle()
    val pending by viewModel.pending.collectAsStateWithLifecycle()
    val asked by viewModel.asked.collectAsStateWithLifecycle()
    val failed by viewModel.failed.collectAsStateWithLifecycle()
    val latest by viewModel.latest.collectAsStateWithLifecycle()
    val changes by viewModel.changes.collectAsStateWithLifecycle()
    val timeToCover by viewModel.timeToCover.collectAsStateWithLifecycle()
    val preview by viewModel.preview.collectAsStateWithLifecycle()
    var editing by rememberSaveable { mutableStateOf(focus == ADJUST || focus == ADJUST_TIME) }
    var editingAt by rememberSaveable { mutableStateOf(if (focus == ADJUST_TIME) PlanSection.Time else null) }
    var choosingFocus by rememberSaveable { mutableStateOf(focus == CHOOSE_FOCUS) }
    var studyingEverything by rememberSaveable { mutableStateOf(focus == STUDY_EVERYTHING && fullCourse(page) != null) }
    val links = PlanLinks(navigator, page)
    val edits =
        PlanEdits(
            pending = pending,
            asked = asked,
            failed = failed,
            latest = latest,
            changes = changes,
            change = viewModel::change,
            undo = viewModel::undo,
            timeToCover = timeToCover,
            findTimeToCover = viewModel::findTimeToCover,
            chooseFocus = { choosingFocus = true },
            studyEverything = { studyingEverything = true },
            chooseExamOption = viewModel::chooseExamOption,
            chooseTools = viewModel::chooseTools,
            preview = viewModel::preview,
            adviseOnBases = viewModel::basesAdvice,
        )
    val report =
        rememberReportProblem(
            app,
            FeedbackTarget(screen = "plan", contentKind = FeedbackSubmissionContext.ContentKind.PLAN, contentId = page.plan.planId),
        )

    PlanEvents(viewModel, navigator)

    PlanContent(
        page = page,
        standing = standingOf(page, progress.value, syllabus.value),
        structure = syllabus.value?.takeIf { it.hasSubjectPages },
        links = links,
        resume =
            if (page.isPaused) {
                resumeOf(
                    app.plans.resumeChangesPlan[page.goal.id]
                        .collectShown()
                        .value,
                )
            } else {
                Resume.Plain
            },
        isSaving = isSaving,
        onSetStatus = viewModel::setStatus,
        report = report,
        onAdjust = { section ->
            viewModel.forgetLatest()
            editingAt = section
            editing = true
        },
    )

    if (editing) {
        PlanEditor(
            page = page,
            edits = edits,
            section = editingAt,
            onTellBuddy = {
                editing = false
                links.buddy()
            },
            onDismiss = { editing = false },
        )
    }

    if (choosingFocus) {
        ChooseFocusSheet(
            page = page,
            edits = edits,
            onFocusTest = {
                choosingFocus = false
                editing = false
                navigator.open(AppRoute.FocusTest())
            },
            onDismiss = { choosingFocus = false },
        )
    }

    if (studyingEverything) {
        StudyEverythingSheet(
            page = page,
            edits = edits,
            preview = preview,
            onPreview = { viewModel.requestPreview(page.plan, it) },
            onDismiss = { studyingEverything = false },
        )
    }
}

/** Main's `?focus=` arrivals, as Today's and the tutor's links open the Plan. */
private const val ADJUST = "adjust"
private const val ADJUST_TIME = "time"
private const val CHOOSE_FOCUS = "choose"
private const val STUDY_EVERYTHING = "everything"

/** Whether resuming asks first, which waits for the preview of what resuming changes; a failed preview asks. */
internal enum class Resume { Plain, Confirm, Pending }

private fun resumeOf(state: LoadState<Boolean>): Resume =
    when (state) {
        is LoadState.Loaded -> if (state.value) Resume.Confirm else Resume.Plain
        is LoadState.Failed -> Resume.Confirm
        LoadState.Empty -> Resume.Plain
        LoadState.Idle, LoadState.Loading -> Resume.Pending
    }

@Composable
internal fun PlanContent(
    page: PlanPageState,
    standing: Standing?,
    structure: Syllabus?,
    links: PlanLinks,
    resume: Resume,
    isSaving: Boolean,
    onSetStatus: (GoalUpdateInput.Status) -> Unit,
    report: ReportProblem? = null,
    onAdjust: ((PlanSection?) -> Unit)? = null,
) {
    val adjust = onAdjust?.let { { it(null) } }
    val numbers = @Composable { variant: NumberVariant -> PlanNumbers(page, standing, variant, links, onAdjust = adjust) }

    var pathOpen by rememberSaveable { mutableStateOf(false) }
    val list = rememberLazyListState()
    val main =
        @Composable { asideBeside: Boolean ->
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                state = list,
                contentPadding = PaddingValues(start = PAGE_MARGIN, end = PAGE_MARGIN, top = 8.dp, bottom = 32.dp),
                verticalArrangement = Arrangement.spacedBy(24.dp),
            ) {
                item(key = "header", contentType = "header") {
                    PlanHeader(
                        page = page,
                        links = links,
                        resume = resume,
                        isSaving = isSaving,
                        onSetStatus = onSetStatus,
                        report = report,
                        onAdjust = adjust,
                    )
                }
                item(key = "roadmap", contentType = "roadmap") {
                    PlanRoadmap(page, links, onOpenPath = if (structure != null) ({ pathOpen = true }) else null)
                }
                if (!asideBeside) {
                    item(key = "numbers", contentType = "numbers") { numbers(NumberVariant.Tiles) }
                }
                if (structure != null) {
                    item(key = "structure", contentType = "structure") { PlanSyllabusSection(structure, onOpenSubject = links::subject) }
                } else {
                    item(key = "path", contentType = "path") { PathSection(page, links) }
                }
                if (!asideBeside) {
                    item(key = "next", contentType = "next") { NextAndMore(page, links) }
                }
            }
        }

    // The aside goes beside the page only when the page itself has the room, as on a subject's page.
    BoxWithConstraints {
        if (maxWidth < ASIDE_PAGE_WIDTH) {
            main(false)
        } else {
            PageWithSupportingPane(
                supportingPane = {
                    Row {
                        VerticalDivider()
                        Column(
                            modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(PAGE_MARGIN),
                            verticalArrangement = Arrangement.spacedBy(32.dp),
                        ) {
                            numbers(NumberVariant.Stats)
                            NextOnPath(page, links)
                            PlanProperties(page, links, onOpen = onAdjust)
                        }
                    }
                },
                mainPane = main,
            )
        }
    }

    if (pathOpen) PathSheet(page, links.closing { pathOpen = false }, onDismiss = { pathOpen = false })
}

/** Main's phases sheet: with subjects on the page, the compact roadmap opens the path here. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PathSheet(
    page: PlanPageState,
    links: PlanLinks,
    onDismiss: () -> Unit,
) {
    val title = stringResource(R.string.plan_your_path)
    ModalBottomSheet(onDismissRequest = onDismiss, modifier = Modifier.semantics { paneTitle = title }) {
        PathSection(
            page,
            links,
            Modifier.verticalScroll(rememberScrollState()).padding(start = SHEET_MARGIN, end = SHEET_MARGIN, bottom = 32.dp),
        )
    }
}

private val ASIDE_PAGE_WIDTH = 840.dp

internal val PAGE_MARGIN = 16.dp

@Composable
private fun NextAndMore(
    page: PlanPageState,
    links: PlanLinks,
) {
    BoxWithConstraints {
        if (maxWidth >= SIDE_BY_SIDE_WIDTH) {
            Row(horizontalArrangement = Arrangement.spacedBy(40.dp)) {
                NextOnPath(page, links, Modifier.weight(1f))
                MoreSection(links, Modifier.weight(1f))
            }
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(24.dp)) {
                NextOnPath(page, links)
                MoreSection(links)
            }
        }
    }
}

private val SIDE_BY_SIDE_WIDTH = 600.dp

@Composable
private fun PlanEvents(
    viewModel: PlanViewModel,
    navigator: AppNavigator,
) {
    val snackbars: SnackbarHostState = LocalSnackbarHostState.current
    val limitReached = stringResource(R.string.plan_goal_limit_reached)
    val saveFailed = stringResource(R.string.plan_save_failed)

    LaunchedEffect(viewModel) {
        viewModel.events.collect { event ->
            when (event) {
                PlanEvent.Archived -> navigator.select(AppTab.Today)
                PlanEvent.GoalLimitReached -> snackbars.showSnackbar(limitReached)
                PlanEvent.SaveFailed -> snackbars.showSnackbar(saveFailed)
            }
        }
    }
}

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
