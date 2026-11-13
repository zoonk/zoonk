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
import androidx.compose.material3.rememberModalBottomSheetState
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
import com.zoonk.android.ui.components.ButtonIcon
import com.zoonk.android.ui.components.ButtonSize
import com.zoonk.android.ui.components.CelebrationScope
import com.zoonk.android.ui.components.LocalStepHeading
import com.zoonk.android.ui.components.ModalBottomSheet
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.components.StepDots
import com.zoonk.android.ui.components.StepPagerActions
import com.zoonk.android.ui.components.TaskActionBar
import com.zoonk.android.ui.components.isWideLayout
import com.zoonk.android.ui.components.stepHeading
import com.zoonk.android.ui.scaffold.TaskAside
import com.zoonk.android.ui.scaffold.TaskScaffold
import com.zoonk.android.ui.scaffold.pageFold
import com.zoonk.android.ui.scaffold.supportingPaneBeside
import com.zoonk.api.models.MockExam
import com.zoonk.api.models.MockExamReviewInner
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
    val mistakes = view.review.count { it.outcome != MockExamReviewInner.Outcome.BLANK }
    val essays = essaySteps(view)
    val speaking = view.speaking
    val preparation = result?.preparation?.takeIf { it.hasMoved() }
    val offered = planOffers(view.adapt)
    val has =
        buildSet {
            if (result != null && (result.total > 0 || (essays.isEmpty() && speaking == null))) add(MockResultPart.Score)
            if (essays.isNotEmpty()) add(MockResultPart.Essays)
            if (speaking != null) add(MockResultPart.Speaking)
            if (preparation != null || offered.isNotEmpty()) add(MockResultPart.Plan)
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
            // Main's aside, under its title: the preparation and the plan. A fold adds the page after it even without them.
            val mainAside = resultAsideParts(has).isNotEmpty()
            val hasAside = mainAside || nextAfterFold
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
                                        val inline = wide || nextAfterFold
                                        ScoreStep(
                                            view,
                                            it,
                                            dayMoment = { MockDayMoment(view, buddy) },
                                            breakdown = { if (hasBreakdown(it)) Breakdown(it, opened, toggle) },
                                            details =
                                                if (hasDetails(view, it, about)) {
                                                    {
                                                        OutlinedButton(onClick = { detailsOpen = true }, size = ButtonSize.Small) {
                                                            Text(stringResource(R.string.mock_result_details))
                                                        }
                                                    }
                                                } else {
                                                    null
                                                },
                                            answers =
                                                if (!inline && view.review.isNotEmpty()) {
                                                    {
                                                        OutlinedButton(onClick = review::openSheet, size = ButtonSize.Small) {
                                                            Text(stringResource(R.string.mock_result_see_answers))
                                                        }
                                                    }
                                                } else {
                                                    null
                                                },
                                            review = if (wide && !nextAfterFold) ({ ReviewSection(view, app, review) }) else null,
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
                                ) { EssayStepContent(step, view.essayRubric, grading, viewModel::gradeEssays) }
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
                                    PlanStep(view.adapt, preparation, offers, offersViewModel::accept, offersViewModel::decline)
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
            val secondary = stringResource(R.string.mock_result_not_now).takeUnless { placement || mistakes == 0 }
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
                    StepPagerActions(
                        count = shown.size,
                        index = position,
                        onIndexChange = { to ->
                            current?.let { if (it.id !in left) left = left + it.id }
                            reachedId = shown[to].id
                        },
                    ) { main ->
                        if (secondaryBeside && secondary != null) OutlinedButton(onClick = onContinue) { Text(secondary) }
                        MainAction(placement, mistakes, onMistakes = { navigator.open(AppRoute.Mistakes) }, onContinue, main)
                    }
                    if (position == shown.lastIndex && !secondaryBeside && secondary != null) {
                        OutlinedButton(onClick = onContinue, modifier = Modifier.fillMaxWidth()) { Text(secondary) }
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
                    actions = { TutorAskButton(TutorScope.Mock(blockId), app, navigator, worded = false) },
                    bottomBar = actions.takeUnless { nextAfterFold },
                    aside =
                        if (hasAside) {
                            TaskAside(
                                title = stringResource(R.string.mock_result_after).takeIf { mainAside },
                                footer = actions.takeIf { nextAfterFold },
                            ) {
                                ResultAside(preparation) {
                                    if (offered.isNotEmpty()) {
                                        view.adapt?.let { adapt ->
                                            AsideSection(stringResource(R.string.mock_result_your_plan)) {
                                                PlanChange(adapt, offers, true, offersViewModel::accept, offersViewModel::decline)
                                            }
                                        }
                                    }
                                    if (nextAfterFold) ReviewSection(view, app, review)
                                }
                            }
                        } else {
                            null
                        },
                ) { padding -> Box(Modifier.padding(padding)) { step() } }
            }

            if (review.open && !wide) ReviewSheet(view, app, review)
            if (detailsOpen && result != null) {
                DetailsSheet(onDismiss = { detailsOpen = false }) { ScoreDetails(view, result, about) }
            }
        }
    }
}

@Composable
private fun MainAction(
    placement: Boolean,
    mistakes: Int,
    onMistakes: () -> Unit,
    onContinue: () -> Unit,
    modifier: Modifier = Modifier,
) {
    if (placement || mistakes == 0) {
        Button(onClick = onContinue, modifier) { Text(stringResource(R.string.mock_result_continue)) }
    } else {
        Button(onClick = onMistakes, modifier, leadingIcon = { ButtonIcon(R.drawable.ic_play_arrow) }) {
            Text(stringResource(R.string.mock_result_review_mistakes))
        }
    }
}

/**
 * Main's `continueHref`: onboarding's plan after a placement mock, the session it was played in,
 * else Today. Practice brings mistakes back only from tomorrow, so they're reviewed in the notebook.
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

@Composable
private fun ResultAside(
    preparation: MockResultPreparation?,
    rest: @Composable ColumnScope.() -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(28.dp)) {
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
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Column(Modifier.padding(horizontal = 24.dp).navigationBarsPadding(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text(stringResource(R.string.mock_result_details), Modifier.semantics { heading() }, style = MaterialTheme.typography.titleLarge)
            Column(Modifier.weight(1f, fill = false).verticalScroll(rememberScrollState()).padding(bottom = 16.dp)) { content() }
        }
    }
}

private const val SCORE = "score"
private const val SPEAKING = "speaking"
private const val PLAN = "plan"
