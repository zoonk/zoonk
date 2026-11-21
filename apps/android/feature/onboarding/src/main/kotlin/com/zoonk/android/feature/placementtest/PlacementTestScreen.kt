package com.zoonk.android.feature.placementtest

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.Resource
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.setup.PlacementDone
import com.zoonk.android.feature.onboarding.setup.PlacementQuestion
import com.zoonk.android.feature.onboarding.setup.PlacementWaiting
import com.zoonk.android.feature.onboarding.setup.SetupColumn
import com.zoonk.android.feature.onboarding.setup.SetupContent
import com.zoonk.android.feature.onboarding.setup.StepLoading
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
import com.zoonk.android.ui.components.Meter
import com.zoonk.android.ui.components.PageLoading
import com.zoonk.android.ui.format.factsLine
import com.zoonk.android.ui.scaffold.TaskScaffold
import com.zoonk.api.models.LearnerSummary
import com.zoonk.api.models.LearnerSummaryGoal
import com.zoonk.api.models.PlacementLength
import com.zoonk.api.models.Plan
import com.zoonk.api.models.PlanPhaseChaptersInner
import com.zoonk.api.models.PlanPlacementTest
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
    val walk = if (goal?.kind == LearnerSummaryGoal.Kind.LANGUAGE) topicWalk(app.plans, goal.id) else null
    val elsewhere =
        when (goal?.kind) {
            LearnerSummaryGoal.Kind.EXAM -> AppRoute.FocusTest(goal.id.toString())
            LearnerSummaryGoal.Kind.LANGUAGE -> AppRoute.LevelTest(goal.id.toString()).takeIf { walk == false }
            else -> null
        }
    val deciding = goal?.kind == LearnerSummaryGoal.Kind.LANGUAGE && walk == null
    TestTask(app.learnerSummary.summary, summary, goal, elsewhere, navigator, deciding) { goalId, setProgress ->
        PlacementTestFlow(goalId.toString(), goal?.displayName.orEmpty(), app.onboarding, app.plans, setProgress, navigator::closeTask)
    }
}

/** Whether a language plan's test is past its level check, walking the course's topics; null until the plan is read. */
@Composable
private fun topicWalk(
    plans: PlanStore,
    goalId: UUID,
): Boolean? {
    val read by plans.plan[goalId].collectShown()
    val plan = read.value?.plan ?: return null
    return (plan.placementTest as? PlanPlacementTest.PlanPlacementTestOneOf1Value)?.value?.attempt != null
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
    deciding: Boolean,
    content: @Composable ColumnScope.(UUID, (Float?) -> Unit) -> Unit,
) {
    var progress by remember { mutableStateOf<Float?>(null) }
    val scope = rememberCoroutineScope()

    TaskScaffold(
        onClose = navigator::closeTask,
        title = {
            progress?.let {
                Meter(
                    share = it,
                    modifier = Modifier.width(METER_WIDTH),
                    color = MaterialTheme.colorScheme.primary,
                    contentDescription = stringResource(R.string.onboarding_placement_progress),
                )
            }
        },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding).consumeWindowInsets(padding)) {
            when {
                deciding -> {
                    PageLoading()
                }

                elsewhere != null -> {
                    LaunchedEffect(elsewhere) {
                        navigator.closeTask()
                        navigator.open(elsewhere)
                    }
                    PageLoading()
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
private fun ColumnScope.PlacementTestFlow(
    goalId: String,
    subject: String,
    store: OnboardingStore,
    plans: PlanStore,
    onProgress: (Float?) -> Unit,
    onLeave: () -> Unit,
) {
    val vm = viewModel(key = "placement-test:$goalId") { PlacementTestViewModel(goalId, store) }
    VisitOf(vm.visit)
    val resource = store.placements[goalId]
    val placement by resource.collectShown()
    val plan by plans.plan[UUID.fromString(goalId)].collectShown()
    val phase = vm.phase(placement)
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
                run = run.withPoll(poll.stopped),
                onRetry = if (poll.stopped) poll::restart else null,
                hold = hold,
                pending = false,
                failed = false,
                onSkip = onLeave,
                skipLabel = stringResource(R.string.placementtest_not_now),
            )
        }

        is PlacementTestPhase.Question -> {
            SetupContent {
                key(shown.item.itemId) {
                    PlacementQuestion(
                        item = shown.item,
                        eyebrow =
                            factsLine(
                                subject.labelCase(),
                                if (shown.attempt.length == PlacementLength.WHOLE_COURSE) {
                                    stringResource(R.string.placementtest_part, shown.attempt.part.toInt())
                                } else {
                                    stringResource(R.string.onboarding_placement_question_number, shown.answered + 1)
                                },
                            ),
                        labels = shown.labels,
                        pending = vm.answering,
                        saveFailures = vm.saveFailures,
                        onAnswer = { answer, durationMs -> vm.answer(shown, answer, durationMs) },
                        onStop = { vm.stop(shown) },
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
                pressed = vm.pressed,
                failed = vm.failed,
                onFinishForToday = onLeave,
                onKeepGoing = { vm.start(shown.attempt.length) },
            )
        }

        is PlacementTestPhase.Result -> {
            PlacementResult(shown.length, shown.lessonsSkipped, plan.value?.plan?.nextTopic(), onDone = onLeave)
        }
    }
}

/** The first topic still to study, where the plan goes on after a test; null when none is left. */
internal fun Plan.nextTopic(): String? =
    phases.flatMap { it.chapters }.firstOrNull { it.state != PlanPhaseChaptersInner.State.DONE && !it.testedOut }?.title

private val PlanPlacementTest.estimatedMinutes: Int
    get() =
        when (this) {
            is PlanPlacementTest.PlanPlacementTestOneOfValue -> value.estimatedMinutes.toInt()
            is PlanPlacementTest.PlanPlacementTestOneOf1Value -> value.estimatedMinutes.toInt()
        }

private val METER_WIDTH = 96.dp
