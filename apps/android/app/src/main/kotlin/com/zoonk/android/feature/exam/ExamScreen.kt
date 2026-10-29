package com.zoonk.android.feature.exam

import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.VerticalDivider
import androidx.compose.material3.adaptive.currentWindowAdaptiveInfoV2
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.net.toUri
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.window.core.layout.WindowSizeClass
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
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
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.components.StatusMessage
import com.zoonk.android.ui.scaffold.PageScaffold
import com.zoonk.android.ui.scaffold.PageWithSupportingPane
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
            summary.value == null -> ExamLoading()
            else -> ExamNotFound(navigator)
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
    val headlineScrolledAway by remember(listState) { derivedStateOf { listState.firstVisibleItemIndex > 0 } }
    val refresh: () -> Unit = { listOf(exam, mocks).forEach { scope.launch { it.refresh() } } }
    val loaded = state.value

    ExamFrame(
        navigator = navigator,
        title = loaded?.examName?.takeIf { headlineScrolledAway },
        report =
            if (loaded != null) {
                { ReportProblemMenu(app, FeedbackTarget("exam")) }
            } else {
                null
            },
    ) {
        PullToRefreshBox(isRefreshing = isRefreshing, onRefresh = refresh, modifier = Modifier.fillMaxSize()) {
            val current = state
            when {
                loaded != null -> ExamPage(loaded, options.value, viewModel, app, navigator, listState)
                current is LoadState.Failed && current.error != ApiError.NotFound -> LoadFailedMessage(onRetry = refresh)
                current is LoadState.Failed || current is LoadState.Empty -> ExamNotFound(navigator)
                else -> ExamLoading()
            }
        }
    }
}

@Composable
private fun ExamFrame(
    navigator: AppNavigator,
    title: String?,
    report: (@Composable () -> Unit)? = null,
    content: @Composable () -> Unit,
) {
    PageScaffold(
        onBack = { navigator.back() },
        title = { title?.let { Text(it, maxLines = 1, overflow = TextOverflow.Ellipsis) } },
        actions = { report?.invoke() },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) { content() }
    }
}

@Composable
private fun ExamLoading() {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
}

/** The goal in the switcher isn't an exam (main's not-found page in the frame). */
@Composable
private fun ExamNotFound(navigator: AppNavigator) {
    StatusMessage(
        icon = R.drawable.ic_search_off,
        title = stringResource(R.string.exam_not_found_title),
        description = stringResource(R.string.exam_not_found_description),
    ) {
        Button(onClick = { navigator.showRoot(AppTab.Today) }) { Text(stringResource(R.string.exam_go_to_today)) }
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
    val aboutLabel = stringResource(R.string.exam_about)
    // Wider windows give the page more room, never wider margins: one start edge, Material's 24dp from medium up.
    val compact = !currentWindowAdaptiveInfoV2().windowSizeClass.isWidthAtLeastBreakpoint(WindowSizeClass.WIDTH_DP_MEDIUM_LOWER_BOUND)
    val padding = PaddingValues(horizontal = if (compact) 16.dp else 24.dp, vertical = 24.dp)

    PageWithSupportingPane(
        supportingPane = {
            Row {
                VerticalDivider()
                Column(
                    Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(padding)
                        .semantics { paneTitle = aboutLabel },
                    verticalArrangement = Arrangement.spacedBy(SECTION_GAP),
                ) {
                    about.forEach { AboutSection(it, exam) }
                }
            }
        },
    ) { aboutBeside ->
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopStart) {
            LazyColumn(
                state = listState,
                modifier = Modifier.widthIn(max = PAGE_WIDTH).fillMaxSize(),
                contentPadding = padding,
                verticalArrangement = Arrangement.spacedBy(SECTION_GAP),
            ) {
                item(key = "hero", contentType = "hero") { ExamHero(exam, options, viewModel, navigator, fullWidthAction = compact) }
                examSections(exam, mockOffered = options?.let(::mockEntryRoute) != null, viewModel, app, navigator)
                if (!aboutBeside) {
                    about.forEach { section ->
                        item(key = "about-$section", contentType = section) { AboutSection(section, exam) }
                    }
                }
            }
        }
    }
}

private fun LazyListScope.examSections(
    exam: ExamView,
    mockOffered: Boolean,
    viewModel: ExamViewModel,
    app: AppContainer,
    navigator: AppNavigator,
) {
    if (exam.showsMoment) {
        item(key = "moment", contentType = "moment") {
            ExamMomentCard(exam.moment, onOpen = null, titleStyle = MaterialTheme.typography.titleMedium)
        }
    }
    if (exam.takesResult) {
        item(key = "result", contentType = "result") { ExamResultSection(exam, viewModel) }
    }
    if (exam.showsMocks(mockOffered)) {
        item(key = "mocks", contentType = "mocks") { ExamMocksSection(exam, mockOffered, navigator) }
    }
    if (exam.mocksRequirePlus || exam.progress != null) {
        item(key = "progress", contentType = "progress") { ExamMockProgressSection(exam) }
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
                start = app.conversations::start,
                open = navigator::open,
                openWeb = { CustomTabsIntent.Builder().build().launchUrl(context, it.toUri()) },
                from = FROM_EXAM,
            )
        }
    } else if (speakingMock != null) {
        item(key = "speaking", contentType = "speaking") {
            SpeakingMockCard(speakingMock, exam.goalId, exam.speakingMockPaused, start = app.conversations::start, open = navigator::open)
        }
    }
}

/** Main's hero: the eyebrow, the exam, its days, the main action, and a date the notice set under them. */
@Composable
private fun ExamHero(
    exam: ExamView,
    options: MockOptions?,
    viewModel: ExamViewModel,
    navigator: AppNavigator,
    fullWidthAction: Boolean,
) {
    val facts = examFacts(exam)

    Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            ExamEyebrow(exam)
            Text(exam.examName, Modifier.semantics { heading() }, style = MaterialTheme.typography.headlineSmall)
            if (facts.isNotEmpty()) {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    facts.forEachIndexed { index, fact ->
                        Text(
                            text = if (index < facts.lastIndex) "$fact ·" else fact,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            style = MaterialTheme.typography.bodyMedium,
                        )
                    }
                }
            }
        }
        options?.let {
            MockEntryButton(
                it,
                onOpen = navigator::open,
                modifier = if (fullWidthAction) Modifier.fillMaxWidth() else Modifier,
            )
        }
        if (exam.noticeDay != null || exam.noSitting != null) NoticeDatesCard(exam, viewModel)
    }
}

private val PAGE_WIDTH = 720.dp
private const val FROM_EXAM = "exam"
private val SECTION_GAP = 40.dp
