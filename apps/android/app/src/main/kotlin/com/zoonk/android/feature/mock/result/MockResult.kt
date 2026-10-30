package com.zoonk.android.feature.mock.result

import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.VerticalDivider
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.window.core.layout.WindowSizeClass
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.feature.ceremonies.MomentAfterCeremony
import com.zoonk.android.feature.mock.runner.COLUMN_WIDTH
import com.zoonk.android.feature.mock.runner.MockActionBar
import com.zoonk.android.feature.mock.runner.MockRun
import com.zoonk.android.feature.mock.runner.MockRunStore
import com.zoonk.android.feature.mock.runner.MockRunnerViewModel
import com.zoonk.android.feature.mock.runner.PaneFooter
import com.zoonk.android.feature.mock.runner.StepTitle
import com.zoonk.android.feature.tutor.TutorAskButton
import com.zoonk.android.feature.tutor.TutorScope
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.ui.components.CelebrationScope
import com.zoonk.android.ui.components.KindMark
import com.zoonk.android.ui.components.LearnKind
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.components.SectionLabel
import com.zoonk.android.ui.components.StepDots
import com.zoonk.android.ui.components.StepPagerActions
import com.zoonk.android.ui.scaffold.PageWithSupportingPane
import com.zoonk.android.ui.scaffold.TaskScaffold
import com.zoonk.android.ui.scaffold.detailPagePadding
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
            if (!placement && mistakes > 0) add(MockResultPart.Next)
        }
    // A result opened again was celebrated then; one just finished shows its milestone's ceremony before its steps.
    MomentAfterCeremony(app, view.ceremony?.takeUnless { viewModel.openedFinished }) { buddy ->
        var reviewOpen by rememberSaveable { mutableStateOf(false) }
        val onContinue = { navigator.continueAfter(view, route) }
        val apply = { offersViewModel.apply(offered) }
        val keep = { offersViewModel.keep(offered) }
        val hasAside = resultAsideParts(has).isNotEmpty()

        BoxWithConstraints {
            // Main's `lg`: the aside beside the steps, or a window as wide without one; the review then sits in the score step.
            val wide = if (hasAside) supportingPaneBeside(maxWidth) else maxWidth >= WindowSizeClass.WIDTH_DP_EXPANDED_LOWER_BOUND.dp
            LaunchedEffect(wide) { if (wide) reviewOpen = false }

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
                                            review = { if (wide) ReviewSection(view, app) },
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
                            listOf(ResultStep(PLAN, part.beside) { PlanStep(view.adapt, preparation, offers, apply, keep) })
                        }

                        MockResultPart.Next -> {
                            listOf(ResultStep(NEXT, part.beside) { NextStep(mistakes) })
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
            // Beside the main action on wide windows and under it on a phone, as main's `MockResultOptions`.
            val secondary =
                when {
                    placement || mistakes == 0 -> null
                    view.purpose == MockExam.Purpose.PLANNED -> stringResource(R.string.mock_result_continue_session)
                    else -> stringResource(R.string.mock_result_not_now)
                }
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
                MockActionBar {
                    StepPagerActions(
                        count = shown.size,
                        index = position,
                        onIndexChange = { to ->
                            current?.let { if (it.id !in left) left = left + it.id }
                            reachedId = shown[to].id
                        },
                        dots = false,
                    ) {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            if (wide && secondary != null) OutlinedButton(onClick = onContinue) { Text(secondary) }
                            MainAction(placement, mistakes, onMistakes = { navigator.open(AppRoute.Mistakes) }, onContinue)
                        }
                    }
                    if (current?.id == SCORE && !wide && view.review.isNotEmpty()) {
                        TextButton(onClick = { reviewOpen = true }, modifier = Modifier.fillMaxWidth()) {
                            val questions = view.review.size
                            Text(
                                if (questions == 1) {
                                    stringResource(R.string.mock_result_see_question)
                                } else {
                                    pluralStringResource(R.plurals.mock_result_see_questions, questions, questions)
                                },
                            )
                        }
                    }
                    if (position == shown.lastIndex && !wide && secondary != null) {
                        TextButton(onClick = onContinue, modifier = Modifier.fillMaxWidth()) { Text(secondary) }
                    }
                }
            }
            val step: @Composable () -> Unit = {
                current?.let {
                    CompositionLocalProvider(LocalStepHeading provides heading) {
                        StepColumn(it.id) {
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
            // Beside the aside, the actions belong to the steps' pane, as main's task footer.
            val actionsInPane = hasAside && wide

            CelebrationScope(play = !viewModel.openedFinished) {
                TaskScaffold(
                    onClose = if (placement) onContinue else navigator::closeTask,
                    title = { StepDots(shown.size, position) },
                    actions = { TutorAskButton(TutorScope.Mock(blockId), app, navigator, worded = false) },
                    bottomBar = if (actionsInPane) null else actions,
                ) { padding ->
                    if (hasAside) {
                        PageWithSupportingPane(
                            modifier = Modifier.padding(padding),
                            supportingPane = {
                                ResultAside(preparation) {
                                    if (offered.isNotEmpty()) {
                                        view.adapt?.let { adapt ->
                                            AsideSection(
                                                stringResource(R.string.mock_result_your_plan),
                                            ) { PlanChange(adapt, offers, true, apply, keep) }
                                        }
                                    }
                                    if (MockResultPart.Next in has) {
                                        AsideSection(stringResource(R.string.mock_result_now)) { MistakesRow(mistakes) }
                                    }
                                }
                            },
                        ) {
                            Column(Modifier.fillMaxSize()) {
                                Box(Modifier.weight(1f)) { step() }
                                if (actionsInPane) PaneFooter(actions)
                            }
                        }
                    } else {
                        Box(Modifier.padding(padding)) { step() }
                    }
                }
            }
        }

        if (reviewOpen) ReviewSheet(view, app, onDismiss = { reviewOpen = false })
    }
}

/** The heading a step takes TalkBack to when it opens. */
private val LocalStepHeading = staticCompositionLocalOf<FocusRequester?> { null }

/** Marks a step's heading, where TalkBack goes when the step opens; one to a step. */
@Composable
internal fun Modifier.stepHeading(): Modifier {
    val heading = LocalStepHeading.current ?: return this
    return focusRequester(heading).focusable()
}

/** Scrolls on the whole pane, margins included, with the step held to a readable column. */
@Composable
private fun StepColumn(
    id: String,
    content: @Composable () -> Unit,
) {
    key(id) {
        Box(Modifier.fillMaxSize().verticalScroll(rememberScrollState()), contentAlignment = Alignment.TopCenter) {
            Column(
                Modifier
                    .widthIn(max = COLUMN_WIDTH)
                    .fillMaxWidth()
                    .padding(detailPagePadding()),
                verticalArrangement = Arrangement.spacedBy(24.dp),
            ) { content() }
        }
    }
}

@Composable
private fun MainAction(
    placement: Boolean,
    mistakes: Int,
    onMistakes: () -> Unit,
    onContinue: () -> Unit,
) {
    when {
        placement -> Button(onClick = onContinue) { Text(stringResource(R.string.mock_result_see_plan)) }
        mistakes == 0 -> Button(onClick = onContinue) { Text(stringResource(R.string.mock_result_continue)) }
        mistakes == 1 -> Button(onClick = onMistakes) { Text(stringResource(R.string.mock_result_review_mistake)) }
        else -> Button(onClick = onMistakes) { Text(pluralStringResource(R.plurals.mock_result_review_mistakes, mistakes, mistakes)) }
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
    val label = stringResource(R.string.mock_result_after)
    Row {
        VerticalDivider()
        Column(
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(detailPagePadding())
                .semantics { paneTitle = label },
            verticalArrangement = Arrangement.spacedBy(28.dp),
        ) {
            SectionLabel(label)
            preparation?.let {
                AsideSection(stringResource(R.string.mock_result_your_preparation)) {
                    PreparationNumbers(it, MaterialTheme.typography.headlineMedium)
                    PreparationMeter(it)
                }
            }
            rest()
        }
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

@Composable
private fun NextStep(mistakes: Int) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Eyebrow(stringResource(R.string.mock_result_now))
        StepTitle(pluralStringResource(R.plurals.mock_result_mistakes_to_review, mistakes, mistakes), Modifier.stepHeading())
    }
}

@Composable
private fun MistakesRow(mistakes: Int) {
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
        KindMark(LearnKind.Mistakes)
        Text(pluralStringResource(R.plurals.mock_result_mistakes_to_review, mistakes, mistakes), style = MaterialTheme.typography.bodyLarge)
    }
}

private const val SCORE = "score"
private const val SPEAKING = "speaking"
private const val PLAN = "plan"
private const val NEXT = "next"
