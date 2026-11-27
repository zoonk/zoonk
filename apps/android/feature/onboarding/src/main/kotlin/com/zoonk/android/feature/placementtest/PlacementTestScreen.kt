package com.zoonk.android.feature.placementtest

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.createSavedStateHandle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.Resource
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.focustest.Pressed
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.setup.PlacementDone
import com.zoonk.android.feature.onboarding.setup.PlacementQuestion
import com.zoonk.android.feature.onboarding.setup.PlacementWaiting
import com.zoonk.android.feature.onboarding.setup.SetupColumn
import com.zoonk.android.feature.onboarding.setup.SetupContent
import com.zoonk.android.feature.onboarding.setup.StepLoading
import com.zoonk.android.feature.onboarding.setup.TestProgress
import com.zoonk.android.feature.onboarding.setup.labelCase
import com.zoonk.android.feature.onboarding.setup.rememberPoll
import com.zoonk.android.feature.onboarding.setup.withPoll
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.feature.warmup.rememberReadyHold
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.ui.VisitOf
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.components.PageLoading
import com.zoonk.android.ui.scaffold.TaskScaffold
import com.zoonk.api.models.LearnerSummary
import com.zoonk.api.models.LearnerSummaryGoal
import com.zoonk.api.models.PlacementLength
import com.zoonk.api.models.Plan
import com.zoonk.api.models.PlanPhaseChaptersInner
import com.zoonk.api.models.PlanPlacementTest
import com.zoonk.api.models.PlanPlacementTestOneOf1
import kotlinx.coroutines.launch
import java.util.UUID

/**
 * `/placement-test`: a course's test of what the learner already knows, opened from its plan or a
 * lesson's offer. An exam's test is its Focus test, and a language course's starts with its level;
 * only a whole-course language test past its level walks the course's topics here.
 */
@Composable
fun PlacementTestScreen(
    route: AppRoute.PlacementTest,
    app: AppContainer,
    navigator: AppNavigator,
) {
    val summary by app.learnerSummary.summary.collectShown()
    val goal = summary.value?.goals?.firstOrNull { goal -> route.goalId?.let { goal.id.toString() == it } ?: goal.isActive }
    val elsewhere = goal?.takeIf { it.kind == LearnerSummaryGoal.Kind.EXAM }?.let { AppRoute.FocusTest(it.id.toString()) }
    TestTask(app.learnerSummary.summary, summary, goal, elsewhere, navigator) { goalId, setProgress ->
        val test = @Composable {
            val vm =
                viewModel(
                    key = "placement-test:$goalId",
                ) { PlacementTestViewModel(goalId.toString(), app.onboarding, createSavedStateHandle()) }
            VisitOf(vm.visit)
            PlacementTestFlow(goalId, goal?.displayName.orEmpty(), app.onboarding, app.plans, setProgress, navigator::closeTask, vm)
        }
        if (goal?.kind == LearnerSummaryGoal.Kind.LANGUAGE) {
            LanguageTestEntry(app.plans, goalId) { walking, _ ->
                if (walking) test() else TestRedirect(AppRoute.LevelTest(goalId.toString()), navigator)
            }
        } else {
            test()
        }
    }
}

/** The walk's last answer closes its attempt, and the walk stays so its result shows. */
@Composable
internal fun ColumnScope.LanguageTestEntry(
    plans: PlanStore,
    goalId: UUID,
    content: @Composable (walking: Boolean, row: PlanPlacementTestOneOf1?) -> Unit,
) {
    val resource = plans.plan[goalId]
    val read by resource.collectShown()
    val fresh by resource.freshState.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()
    val walked = rememberSaveable(goalId) { mutableStateOf(false) }
    val row = (read.value?.plan?.placementTest as? PlanPlacementTest.PlanPlacementTestOneOf1Value)?.value
    val walking = read.value?.let { row?.attempt != null }
    val shown = topicWalkOf(walking, fresh, walked.value)
    if (shown == true && !walked.value) SideEffect { walked.value = true }
    when {
        shown != null -> content(shown, row)
        read is LoadState.Failed -> LoadFailedMessage(onRetry = { scope.launch { resource.refresh() } })
        else -> StepLoading()
    }
}

/**
 * The level result's Keep going opens the walk and comes here while the plan cached before it says there's none, so
 * "not walking" waits for a read made since.
 */
internal fun topicWalkOf(
    walking: Boolean?,
    fresh: LoadState<Unit>,
    walked: Boolean,
): Boolean? =
    when {
        walked || walking == true -> true
        walking == null || fresh == LoadState.Idle || fresh == LoadState.Loading -> null
        else -> false
    }

/**
 * The frame both tests from the plan share: its progress in the bar, and the goal in the route or the
 * switcher. A goal whose test is another route ([elsewhere]) goes there; without one, Today.
 */
@Composable
internal fun TestTask(
    summaries: Resource<LearnerSummary>,
    summary: LoadState<LearnerSummary>,
    goal: LearnerSummaryGoal?,
    elsewhere: AppRoute?,
    navigator: AppNavigator,
    content: @Composable ColumnScope.(UUID, (Float?) -> Unit) -> Unit,
) {
    var progress by remember { mutableStateOf<Float?>(null) }
    val scope = rememberCoroutineScope()

    TaskScaffold(
        onClose = navigator::closeTask,
        title = { progress?.let { TestProgress(it) } },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding).consumeWindowInsets(padding)) {
            when {
                elsewhere != null -> {
                    TestRedirect(elsewhere, navigator)
                }

                goal != null -> {
                    SetupColumn { content(goal.id) { progress = it } }
                }

                summary is LoadState.Failed -> {
                    LoadFailedMessage(onRetry = { scope.launch { summaries.refresh() } })
                }

                summary is LoadState.Loaded || summary == LoadState.Empty -> {
                    LaunchedEffect(Unit) { navigator.showRoot(AppTab.Today) }
                    PageLoading()
                }

                else -> {
                    PageLoading()
                }
            }
        }
    }
}

@Composable
internal fun TestRedirect(
    route: AppRoute,
    navigator: AppNavigator,
) {
    LaunchedEffect(route) {
        navigator.closeTask()
        navigator.open(route)
    }
    PageLoading()
}

@Composable
internal fun ColumnScope.PlacementTestFlow(
    goalId: UUID,
    subject: String,
    store: OnboardingStore,
    plans: PlanStore,
    onProgress: (Float?) -> Unit,
    onLeave: () -> Unit,
    vm: PlacementTestViewModel,
    onboarding: PlacementSetupEnd? = null,
) {
    val resource = store.placements[goalId.toString()]
    val placement by resource.collectShown()
    val plan by plans.plan[goalId].collectShown()
    val phase = if (onboarding == null) vm.phase(placement) else vm.setupPhase(placement)
    val scope = rememberCoroutineScope()
    val waiting = phase == PlacementTestPhase.Waiting
    val run = remember { GenerationRun() }
    val poll = rememberPoll(active = waiting) { vm.check() }
    val hold = rememberReadyHold(ready = !waiting)
    val shown = if (hold.over) phase else PlacementTestPhase.Waiting
    val question = shown as? PlacementTestPhase.Question
    LaunchedEffect(question?.progress) { onProgress(question?.progress?.toFloat()) }

    when (shown) {
        PlacementTestPhase.Loading -> {
            StepLoading()
        }

        PlacementTestPhase.LoadFailed -> {
            SetupContent { LoadFailedMessage(onRetry = { scope.launch { resource.refresh() } }) }
        }

        PlacementTestPhase.Choose -> {
            LengthChoice(
                wholeCourseMinutes =
                    plan.value
                        ?.plan
                        ?.placementTest
                        ?.estimatedMinutes ?: 0,
                pressed = vm.pressed,
                failed = vm.failed,
                onStart = vm::start,
            )
        }

        PlacementTestPhase.Waiting -> {
            PlacementWaiting(
                existingPlan = onboarding == null,
                run = run.withPoll(poll.stopped),
                onRetry = if (poll.stopped) poll::restart else null,
                hold = hold,
                pending = onboarding != null && vm.busy,
                failed = onboarding != null && vm.failed,
                onSkip = {
                    if (onboarding == null) onLeave() else placement.value?.attempt?.let(vm::finishPart)
                },
                skipLabel =
                    stringResource(
                        if (onboarding == null) R.string.placementtest_not_now else R.string.onboarding_placement_stop,
                    ),
            )
        }

        is PlacementTestPhase.Question -> {
            SetupContent {
                key(shown.item.itemId) {
                    PlacementQuestion(
                        item = shown.item,
                        subject = subject.labelCase(),
                        position =
                            if (shown.attempt.length == PlacementLength.WHOLE_COURSE) {
                                stringResource(R.string.placementtest_part, shown.attempt.part.toInt())
                            } else {
                                stringResource(R.string.onboarding_placement_question_number, shown.answered + 1)
                            },
                        labels = shown.labels,
                        pending = vm.answering,
                        saveFailures = vm.saveFailures,
                        onAnswer = { answer, durationMs -> vm.answer(shown, answer, durationMs) },
                        onStop = { vm.stop(shown) },
                        canStop = shown.answered > 0,
                    )
                }
            }
        }

        is PlacementTestPhase.PartOver -> {
            PlacementDone(pending = vm.busy, failed = vm.failed, onContinue = { vm.finishPart(shown.attempt) })
        }

        is PlacementTestPhase.Between -> {
            BetweenParts(
                lessonsSkipped = shown.lessonsSkipped,
                minutesLeft = shown.attempt.estimatedMinutes.toInt(),
                heldUntilTomorrow = shown.heldUntilTomorrow,
                pressed = if (onboarding?.saving == true) Pressed.Main else vm.pressed,
                failed = vm.failed,
                onFinishForToday = onLeave,
                onKeepGoing = {
                    if (onboarding == null) vm.start(shown.attempt.length) else onboarding.continueWith(shown.attempt.id)
                },
                undo = rememberPlacementUndo(plans, goalId, shown.changeId),
                inSetup = onboarding != null,
            )
        }

        is PlacementTestPhase.Result -> {
            PlacementResult(
                shown.lessonsSkipped,
                plan.value?.plan?.nextTopic(),
                heldUntilTomorrow = shown.heldUntilTomorrow,
                onDone = { if (onboarding == null) onLeave() else onboarding.continueWith(checkNotNull(shown.attemptId)) },
                undo = rememberPlacementUndo(plans, goalId, shown.changeId),
                inSetup = onboarding != null,
                saving = onboarding?.saving == true,
            )
        }
    }
}

/** The first topic still to study, where the plan goes on after a test; null when none is left. */
internal fun Plan.nextTopic(): String? =
    phases
        .flatMap { it.chapters }
        .firstOrNull { it.state != PlanPhaseChaptersInner.State.DONE && !it.testedOut }
        ?.title
        ?.takeIf { it.isNotBlank() }

internal val PlanPlacementTest.estimatedMinutes: Int
    get() =
        when (this) {
            is PlanPlacementTest.PlanPlacementTestOneOf2Value -> 0
            is PlanPlacementTest.PlanPlacementTestOneOfValue -> value.estimatedMinutes.toInt()
            is PlanPlacementTest.PlanPlacementTestOneOf1Value -> value.estimatedMinutes.toInt()
        }
