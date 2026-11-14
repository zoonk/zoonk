package com.zoonk.android.feature.exam

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.VerticalDivider
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.app.openWebPage
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.feedback.FeedbackTarget
import com.zoonk.android.feature.feedback.ReportProblemMenu
import com.zoonk.android.feature.mock.MockEntryButton
import com.zoonk.android.feature.mock.MockStore
import com.zoonk.android.feature.mock.mockEntryRoute
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.feature.plan.planGoal
import com.zoonk.android.feature.speaking.SpeakingMockCard
import com.zoonk.android.feature.speaking.SpeakingPaperSection
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.ui.components.ButtonSize
import com.zoonk.android.ui.components.Facts
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.components.NotFoundMessage
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.PageLoading
import com.zoonk.android.ui.components.TaskActions
import com.zoonk.android.ui.scaffold.DetailPage
import com.zoonk.android.ui.scaffold.PageScaffold
import com.zoonk.android.ui.scaffold.pageTitle
import com.zoonk.api.models.ExamView
import com.zoonk.api.models.MockOptions
import kotlinx.coroutines.launch
import java.util.UUID

/** Main's `/exam`: the exam of the goal in the switcher. */
@Composable
fun ExamScreen(
    app: AppContainer,
    navigator: AppNavigator,
) {
    val summary by app.learnerSummary.summary.collectShown()
    val goalId = summary.value?.planGoal?.id

    if (goalId != null) {
        key(goalId) { GoalExam(goalId, app, navigator) }
        return
    }

    val scope = rememberCoroutineScope()
    ExamFrame(navigator, title = null) {
        when {
            summary is LoadState.Failed -> LoadFailedMessage(onRetry = { scope.launch { app.learnerSummary.summary.refresh() } })
            summary.value == null -> PageLoading()
            else -> NotFoundMessage(onGoHome = { navigator.showRoot(AppTab.Today) })
        }
    }
}

@Composable
internal fun GoalExam(
    goalId: UUID,
    app: AppContainer,
    navigator: AppNavigator,
    exams: ExamStore = app.exams,
    mockStore: MockStore = app.mocks,
    plans: PlanStore = app.plans,
) {
    val exam = exams.exam[goalId]
    val mocks = mockStore.options[goalId]
    val state by exam.collectShown()
    val options by mocks.collectShown()
    val isRefreshing by exam.isRefreshing.collectAsStateWithLifecycle()
    val viewModel = viewModel(key = "exam-$goalId") { ExamViewModel(exams, plans, goalId) }
    val scope = rememberCoroutineScope()
    val listState = rememberLazyListState()
    val refresh: () -> Unit = { listOf(exam, mocks).forEach { scope.launch { it.refresh() } } }
    val loaded = state.value

    val main = loaded?.let { exam -> options.value?.takeUnless { exam.isLastDays }?.takeIf { mockEntryRoute(it) != null } }

    ExamFrame(
        navigator = navigator,
        title = loaded?.examName,
        actions = { if (loaded != null) ReportProblemMenu(app, FeedbackTarget("exam")) },
        bottomBar = main?.let { entry -> { TaskActions { main -> MockEntryButton(entry, onOpen = navigator::open, modifier = main) } } },
    ) {
        PullToRefreshBox(isRefreshing = isRefreshing, onRefresh = refresh, modifier = Modifier.fillMaxSize()) {
            val current = state
            when {
                loaded != null -> {
                    ExamPage(loaded, options.value, viewModel, app, navigator, listState)
                }

                current is LoadState.Failed && current.error != ApiError.NotFound -> {
                    LoadFailedMessage(onRetry = refresh)
                }

                current is LoadState.Failed || current is LoadState.Empty -> {
                    NotFoundMessage(
                        onGoHome = { navigator.showRoot(AppTab.Today) },
                    )
                }

                else -> {
                    PageLoading()
                }
            }
        }
    }
}

@Composable
private fun ExamFrame(
    navigator: AppNavigator,
    title: String?,
    actions: @Composable RowScope.() -> Unit = {},
    bottomBar: (@Composable ColumnScope.() -> Unit)? = null,
    content: @Composable () -> Unit,
) {
    PageScaffold(
        onBack = { navigator.back() },
        title = { title?.let { Text(it, maxLines = 1, overflow = TextOverflow.Ellipsis) } },
        actions = actions,
        bottomBar = bottomBar,
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) { content() }
    }
}

/**
 * The exam, its mocks and how they went, with what to know about the exam (its format and how it's
 * scored) beside them where there's room, else after them, as main's aside.
 */
@Composable
private fun ExamPage(
    exam: ExamView,
    options: MockOptions?,
    viewModel: ExamViewModel,
    app: AppContainer,
    navigator: AppNavigator,
    listState: LazyListState,
) {
    val about = aboutSections(exam)

    DetailPage(
        aside = { about.forEach { AboutSection(it, exam) } },
        asideLabel = stringResource(R.string.exam_about),
        listState = listState,
    ) { aboutBeside ->
        item(key = "hero", contentType = "hero") {
            ExamHero(exam)
        }
        examSections(exam, options, viewModel, app, navigator)
        if (!aboutBeside) {
            about.forEach { section ->
                item(key = "about-$section", contentType = section) { AboutSection(section, exam) }
            }
        }
    }
}

private fun LazyListScope.examSections(
    exam: ExamView,
    options: MockOptions?,
    viewModel: ExamViewModel,
    app: AppContainer,
    navigator: AppNavigator,
) {
    if (exam.noticeDay != null || exam.noSitting != null) {
        item(key = "notice-day", contentType = "notice-day") { NoticeDatesCard(exam, viewModel) }
    }
    if (exam.showsMoment) {
        item(key = "moment", contentType = "moment") {
            ExamMomentCard(exam.moment, onOpen = null, titleStyle = MaterialTheme.typography.titleMedium)
        }
    }
    if (exam.takesResult) {
        item(key = "result", contentType = "result") { ExamResultSection(exam, viewModel) }
    }
    // The day before, on the day and after it, the exam leads the page and a mock exam is one small button.
    val entry: (@Composable () -> Unit)? =
        options?.takeIf { exam.isLastDays && it.options.isNotEmpty() }?.let {
            {
                OutlinedButton(onClick = { navigator.open(AppRoute.MockChooser) }, size = ButtonSize.Small) {
                    Text(stringResource(R.string.mock_take))
                }
            }
        }
    if (exam.showsMocks(entry != null)) {
        item(key = "mocks", contentType = "mocks") { ExamMocksSection(exam, entry, navigator) }
    }
    exam.progress?.let { progress ->
        item(key = "progress", contentType = "progress") { ExamMockProgressSection(progress, exam.scoring.method) }
    }
    val paper = exam.speaking
    val speakingMock = exam.speakingMock
    if (paper != null) {
        item(key = "speaking", contentType = "speaking") {
            val context = LocalContext.current
            SpeakingPaperSection(
                paper = paper,
                goalId = exam.goalId,
                openTask = null,
                start = app.conversations,
                open = navigator::open,
                openWeb = { openWebPage(context, it) },
                onRefused = { app.exams.speakingRefused(exam.goalId) },
                from = FROM_EXAM,
            )
        }
    } else if (speakingMock != null) {
        item(key = "speaking", contentType = "speaking") {
            SpeakingMockCard(
                speakingMock,
                exam.goalId,
                exam.speakingMockPaused,
                start = app.conversations,
                open = navigator::open,
                from = FROM_EXAM,
            )
        }
    }
}

/** Main's hero: the exam, then its days and how many are left. Its main action is in the bottom bar. */
@Composable
private fun ExamHero(exam: ExamView) {
    val facts = examFacts(exam) + listOfNotNull(daysLeft(exam))

    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(exam.examName, Modifier.pageTitle(), style = MaterialTheme.typography.headlineMedium)
        if (facts.isNotEmpty()) Facts(facts)
        ExamDateTag(exam)
    }
}

/** The day before, on the day and after it, a mock exam isn't the page's main action. */
private val ExamView.isLastDays: Boolean
    get() = stage == ExamView.Stage.DAY_BEFORE || stage == ExamView.Stage.EXAM_DAY || stage == ExamView.Stage.AFTER_EXAM

private const val FROM_EXAM = "exam"
