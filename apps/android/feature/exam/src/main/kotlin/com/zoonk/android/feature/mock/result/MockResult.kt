package com.zoonk.android.feature.mock.result

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.window.core.layout.WindowSizeClass
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.feature.ceremonies.MomentAfterCeremony
import com.zoonk.android.feature.certificates.naming
import com.zoonk.android.feature.mock.runner.MockRun
import com.zoonk.android.feature.mock.runner.MockRunStore
import com.zoonk.android.feature.mock.runner.MockRunnerViewModel
import com.zoonk.android.feature.mock.runner.StepColumn
import com.zoonk.android.feature.tutor.TutorAskButton
import com.zoonk.android.feature.tutor.TutorScope
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.CelebrationScope
import com.zoonk.android.ui.components.LocalStepHeading
import com.zoonk.android.ui.components.ModalBottomSheet
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.components.StepDots
import com.zoonk.android.ui.components.StepPagerActions
import com.zoonk.android.ui.components.TaskActionBar
import com.zoonk.android.ui.components.TextButton
import com.zoonk.android.ui.components.barButtonEnd
import com.zoonk.android.ui.components.isWideLayout
import com.zoonk.android.ui.components.rememberExpandedBottomSheetState
import com.zoonk.android.ui.components.stepHeading
import com.zoonk.android.ui.scaffold.TaskAside
import com.zoonk.android.ui.scaffold.TaskScaffold
import com.zoonk.android.ui.scaffold.pageFold
import com.zoonk.android.ui.scaffold.supportingPaneBeside
import com.zoonk.api.models.MockExam
import com.zoonk.api.models.MockExamReviewInner
import com.zoonk.api.models.MockResult
import com.zoonk.api.models.MockResultPreparation

private class ResultStep(
    val id: String,
    val beside: Boolean,
    val content: @Composable () -> Unit,
)

/** Main's `MockResultView`. A result opened again never celebrates. */
@Composable
internal fun MockResult(
    viewModel: MockRunnerViewModel,
    run: MockRun,
    route: AppRoute.Mock,
    app: AppContainer,
    store: MockRunStore,
    navigator: AppNavigator,
) {
    val view = run.view
    val result = view.result
    val blockId = view.blockId.toString()
    val grading by viewModel.essayGrading.collectAsStateWithLifecycle()
    val offersViewModel =
        viewModel(key = "mock-offers-$blockId-${app.sessions.current?.localId}") { MockPlanOffersViewModel(store, app.sessions, blockId) }
    val offers by offersViewModel.state.collectAsStateWithLifecycle()
    val placement = view.purpose == MockExam.Purpose.PLACEMENT
    // A question with several picks answered partly right missed some, so the notebook keeps it too.
    val mistakes =
        view.review.count { it.outcome == MockExamReviewInner.Outcome.WRONG || it.outcome == MockExamReviewInner.Outcome.PARTIAL }
    val practice = view.mockId?.takeIf { mistakes > 0 && !placement }?.let { AppRoute.MistakePractice(mockId = it.toString()) }
    val essays = essaySteps(view)
    val speaking = view.speaking
    val preparation = result?.preparation?.takeIf { it.hasMoved() }
    val offered = planOffers(view.adapt)
    val movedTopics = result?.movedTopics?.takeIf { it.isNotEmpty() }
    val has =
        buildSet {
            if (result != null && (result.total > 0 || (essays.isEmpty() && speaking == null))) add(MockResultPart.Score)
            if (essays.isNotEmpty()) add(MockResultPart.Essays)
            if (speaking != null) add(MockResultPart.Speaking)
            if (preparation != null || offered.isNotEmpty() || movedTopics != null) add(MockResultPart.Plan)
        }
    val about = result?.let { mockAboutLines(view) }.orEmpty()
    // A result opened again was celebrated then; one just finished shows its milestone's ceremony before its steps.
    MomentAfterCeremony(
        app,
        view.ceremony?.takeUnless { viewModel.openedFinished },
        view.certificates
            .takeUnless { viewModel.openedFinished }
            .orEmpty()
            .map { it.naming },
        onSeePlus = { navigator.open(AppRoute.Subscription) },
    ) { buddy ->
        val review = rememberReviewPlace()
        // Above the steps, so paging away from the score and back keeps the areas the learner opened.
        var opened by rememberSaveable { mutableStateOf(emptyList<String>()) }
        val toggle = { key: String -> opened = if (key in opened) opened - key else opened + key }
        val onContinue = { navigator.continueAfter(view, route) }
        var detailsOpen by rememberSaveable { mutableStateOf(false) }

        BoxWithConstraints {
            val fold = pageFold(maxWidth)
            val asideFits = supportingPaneBeside(maxWidth, panesTouch = true)
            // An open book reads how it went before the fold, and what's next after it, with the way on.
            val nextAfterFold = MockResultPart.Score in has && fold != null && asideFits
            // Main's aside: what supports the number, then the preparation and the plan. A fold adds the page after it even without them.
            val mainAside = resultAsideParts(has).isNotEmpty()
            val hasSummary = result != null && MockResultPart.Score in has && (hasAnswerCounts(result) || hasBreakdown(result))
            val hasAside = mainAside || nextAfterFold || hasSummary
            // Main's `lg`: the aside beside the steps, or a window as wide without one; the review then sits in the score step.
            val wide =
                if (hasAside) {
                    asideFits
                } else {
                    maxWidth >=
                        WindowSizeClass.WIDTH_DP_EXPANDED_LOWER_BOUND.dp
                }

            val steps =
                resultSteps(has).flatMap { part ->
                    when (part.part) {
                        MockResultPart.Score -> {
                            listOfNotNull(
                                result?.let {
                                    ResultStep(SCORE, part.beside) {
                                        ScoreStep(
                                            view,
                                            it,
                                            dayMoment = { MockDayMoment(view, buddy) },
                                            // An open book keeps the numbers the score is made of on the page before the fold.
                                            summary =
                                                if (hasSummary &&
                                                    (!wide || nextAfterFold)
                                                ) {
                                                    ({ ResultSummary(it, opened, toggle) })
                                                } else {
                                                    null
                                                },
                                            review =
                                                if (nextAfterFold) {
                                                    null
                                                } else {
                                                    (
                                                        {
                                                            ReviewSection(
                                                                view,
                                                                app,
                                                                review,
                                                                opened,
                                                                toggle,
                                                            )
                                                        }
                                                    )
                                                },
                                        )
                                    }
                                },
                            )
                        }

                        MockResultPart.Essays -> {
                            essays.map { step ->
                                ResultStep(
                                    step.id,
                                    part.beside,
                                ) { EssayStepContent(step, grading, viewModel::gradeEssays) }
                            }
                        }

                        MockResultPart.Speaking -> {
                            listOfNotNull(
                                speaking?.let { paper ->
                                    ResultStep(SPEAKING, part.beside) {
                                        SpeakingEstimate(paper) { task ->
                                            navigator.open(AppRoute.Conversation(task.conversationId.toString(), mock = blockId))
                                        }
                                    }
                                },
                            )
                        }

                        MockResultPart.Plan -> {
                            listOf(
                                ResultStep(PLAN, part.beside) {
                                    PlanStep(view.adapt, preparation, movedTopics, offers)
                                },
                            )
                        }
                    }
                }

            var reachedId by rememberSaveable { mutableStateOf<String?>(null) }
            var left by rememberSaveable { mutableStateOf(listOf<String>()) }
            val shown = if (wide) steps.filterNot { it.beside } else steps
            val reached = steps.indexOfFirst { it.id == reachedId }.coerceAtLeast(0)
            // Where the step reached is beside, the step before it shows with the aside.
            val current = shown.lastOrNull { steps.indexOf(it) <= reached } ?: shown.firstOrNull()
            val position = shown.indexOf(current).coerceAtLeast(0)
            // Beside the main action on a wide layout and above it on a phone or a book's page, as main's `MockResultSkip`.
            val secondaryBeside = isWideLayout()
            val secondary = stringResource(R.string.mock_result_continue).takeIf { practice != null }
            // Main's `MockPlanDecline` and `MockPlanAccept`: while the plan step asks, its answers are the bar's, in place of the way on.
            val asking =
                view.adapt
                    ?.let { adapt -> offers.open(adapt)?.let { offerCopy(it, adapt) to it } }
                    ?.takeIf { current?.id == PLAN && position == shown.lastIndex }
            val heading = remember { FocusRequester() }
            var announced by rememberSaveable { mutableStateOf(current?.id) }

            // Main's `focusStepTitle`: a new step takes TalkBack to its heading, never on the first one.
            LaunchedEffect(current?.id) {
                if (current?.id != announced) {
                    announced = current?.id
                    heading.requestFocus()
                }
            }

            val actions: @Composable () -> Unit = {
                TaskActionBar {
                    // On a phone the second action takes the line above the main one and the way back.
                    if (position == shown.lastIndex && !secondaryBeside) {
                        if (asking != null) {
                            OutlinedButton(
                                onClick = { offersViewModel.decline(asking.second) },
                                modifier = Modifier.fillMaxWidth(),
                                enabled = !offers.applying,
                            ) { Text(asking.first.decline) }
                        } else if (secondary != null) {
                            OutlinedButton(onClick = onContinue, modifier = Modifier.fillMaxWidth()) { Text(secondary) }
                        }
                    }
                    StepPagerActions(
                        count = shown.size,
                        index = position,
                        onIndexChange = { to ->
                            current?.let { if (it.id !in left) left = left + it.id }
                            reachedId = shown[to].id
                        },
                    ) { main ->
                        if (asking != null) {
                            val (copy, offer) = asking
                            if (secondaryBeside) {
                                OutlinedButton(
                                    onClick = { offersViewModel.decline(offer) },
                                    enabled = !offers.applying,
                                ) { Text(copy.decline) }
                            }
                            Button(
                                busy = offers.applying,
                                onClick = { offersViewModel.accept(offer) },
                                modifier = main,
                            ) { Text(copy.accept) }
                        } else {
                            if (secondaryBeside && secondary != null) OutlinedButton(onClick = onContinue) { Text(secondary) }
                            MainAction(practice, navigator, onContinue, main)
                        }
                    }
                }
            }
            val step: @Composable () -> Unit = {
                current?.let {
                    CompositionLocalProvider(LocalStepHeading provides heading) {
                        StepColumn(step = it.id) {
                            CelebrationScope(play = it.id !in left) {
                                it.content()
                                if (MockResultPart.Score !in has && it == steps.first()) {
                                    MockDayMoment(view, buddy)
                                }
                            }
                        }
                    }
                }
            }
            CelebrationScope(play = !viewModel.openedFinished) {
                TaskScaffold(
                    onClose = if (placement) onContinue else navigator::closeTask,
                    title = { StepDots(shown.size, position) },
                    actions = {
                        if (result != null && hasDetails(view, result, about)) {
                            TextButton(onClick = { detailsOpen = true }) { Text(stringResource(R.string.mock_result_details)) }
                        }
                        Box(Modifier.barButtonEnd()) { TutorAskButton(TutorScope.Mock(blockId), app, navigator) }
                    },
                    bottomBar = actions.takeUnless { nextAfterFold },
                    aside =
                        if (hasAside) {
                            TaskAside(
                                // Its blocks name themselves once the answers lead it, so the rail's own line would repeat them.
                                title = stringResource(R.string.mock_result_after).takeIf { mainAside && (!hasSummary || nextAfterFold) },
                                footer = actions.takeIf { nextAfterFold },
                            ) {
                                ResultAside(
                                    summary =
                                        result?.takeIf { hasSummary && !nextAfterFold }?.let {
                                            {
                                                ResultSummary(
                                                    it,
                                                    opened,
                                                    toggle,
                                                )
                                            }
                                        },
                                    preparation,
                                ) {
                                    if (offered.isNotEmpty() || movedTopics != null) {
                                        AsideSection(stringResource(R.string.mock_result_your_plan)) {
                                            movedTopics?.let { MovedTopics(it) }
                                            view.adapt?.takeIf { offered.isNotEmpty() }?.let { adapt ->
                                                PlanChange(adapt, offers, true) { offer ->
                                                    InlinePlanAnswers(
                                                        adapt,
                                                        offer,
                                                        offers,
                                                        offersViewModel::accept,
                                                        offersViewModel::decline,
                                                    )
                                                }
                                            }
                                        }
                                    }
                                    if (nextAfterFold) ReviewSection(view, app, review, opened, toggle)
                                }
                            }
                        } else {
                            null
                        },
                ) { padding -> Box(Modifier.padding(padding)) { step() } }
            }

            if (detailsOpen && result != null) {
                DetailsSheet(onDismiss = { detailsOpen = false }) { ScoreDetails(view, result, about) }
            }
        }
    }
}

/** [practice] is the run of this mock's mistakes, there when it missed some; otherwise the way on. */
@Composable
private fun MainAction(
    practice: AppRoute.MistakePractice?,
    navigator: AppNavigator,
    onContinue: () -> Unit,
    modifier: Modifier = Modifier,
) {
    if (practice == null) {
        Button(onClick = onContinue, modifier) { Text(stringResource(R.string.mock_result_continue)) }
    } else {
        Button(onClick = { navigator.open(practice) }, modifier) {
            Text(stringResource(R.string.mistakes_practice))
        }
    }
}

/**
 * Main's `continueHref`: onboarding's plan after a placement mock, the session it was played in,
 * else Today.
 */
private fun AppNavigator.continueAfter(
    view: MockExam,
    route: AppRoute.Mock,
) {
    val goalId = view.goalId
    when {
        view.purpose == MockExam.Purpose.PLACEMENT && goalId != null -> {
            closeTask()
            open(AppRoute.GoalSetup(goalId.toString()))
        }

        route.sessionId != null -> {
            closeTask()
            if (currentRoute !is AppRoute.Session) open(AppRoute.Session())
        }

        else -> {
            showRoot(AppTab.Today)
        }
    }
}

/** Main's `MockResultSummary`: how the answers went, then each subject or topic. */
@Composable
private fun ResultSummary(
    result: MockResult,
    opened: List<String>,
    onToggle: (String) -> Unit,
) {
    if (hasAnswerCounts(result)) {
        ResultSection(stringResource(R.string.mock_result_answers)) { AnswerMeter(result) }
    }
    if (hasBreakdown(result)) Breakdown(result, opened, onToggle)
}

@Composable
private fun ResultAside(
    summary: (@Composable () -> Unit)?,
    preparation: MockResultPreparation?,
    rest: @Composable ColumnScope.() -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(28.dp)) {
        summary?.invoke()
        preparation?.let {
            AsideSection(stringResource(R.string.mock_result_your_preparation)) {
                PreparationReadout(it, MaterialTheme.typography.headlineMedium)
                PreparationMeter(it)
            }
        }
        rest()
    }
}

@Composable
private fun AsideSection(
    title: String,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionHeader(title)
        content()
    }
}

/** Main's `DetailsDrawer`: the result's numbers and caveats, in a sheet over the step. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DetailsSheet(
    onDismiss: () -> Unit,
    content: @Composable () -> Unit,
) {
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberExpandedBottomSheetState()) {
        Column(Modifier.padding(horizontal = 24.dp).navigationBarsPadding(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text(
                stringResource(R.string.mock_result_details),
                Modifier.semantics { heading() },
                style = MaterialTheme.typography.titleLarge,
            )
            Column(Modifier.weight(1f, fill = false).verticalScroll(rememberScrollState()).padding(bottom = 16.dp)) { content() }
        }
    }
}

private const val SCORE = "score"
private const val SPEAKING = "speaking"
private const val PLAN = "plan"
