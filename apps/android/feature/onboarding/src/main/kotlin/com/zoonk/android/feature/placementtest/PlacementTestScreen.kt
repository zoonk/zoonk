package com.zoonk.android.feature.placementtest

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.lifecycle.createSavedStateHandle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.AnalyticsEvent
import com.zoonk.android.data.GenerationFailure
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.LocalEventTracker
import com.zoonk.android.data.Resource
import com.zoonk.android.data.TestContext
import com.zoonk.android.data.TestRow
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.setup.PlacementDone
import com.zoonk.android.feature.onboarding.setup.PlacementQuestion
import com.zoonk.android.feature.onboarding.setup.PlacementUnavailable
import com.zoonk.android.feature.onboarding.setup.PlacementWaiting
import com.zoonk.android.feature.onboarding.setup.SetupColumn
import com.zoonk.android.feature.onboarding.setup.SetupContent
import com.zoonk.android.feature.onboarding.setup.StepLoading
import com.zoonk.android.feature.onboarding.setup.isPending
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
import com.zoonk.api.models.PlacementAttempt
import com.zoonk.api.models.PlanPlacementTest
import kotlinx.coroutines.launch
import java.util.UUID

/**
 * `/placement-test`: a course's test of what the learner already knows, opened from its plan or a lesson's offer. An
 * exam's test is its Focus test and a language course's its level test, which are other routes.
 */
@Composable
fun PlacementTestScreen(
    route: AppRoute.PlacementTest,
    app: AppContainer,
    navigator: AppNavigator,
) {
    val summary by app.learnerSummary.summary.collectShown()
    val goal = summary.value?.goals?.firstOrNull { goal -> route.goalId?.let { goal.id.toString() == it } ?: goal.isActive }
    val elsewhere =
        when (goal?.kind) {
            LearnerSummaryGoal.Kind.EXAM -> AppRoute.FocusTest(goal.id.toString())
            LearnerSummaryGoal.Kind.LANGUAGE -> AppRoute.LevelTest(goal.id.toString())
            else -> null
        }
    TestTask(app.learnerSummary.summary, summary, goal, elsewhere, navigator) { goalId, setProgress ->
        val vm =
            viewModel(
                key = "placement-test:$goalId",
            ) { PlacementTestViewModel(goalId.toString(), app.onboarding, createSavedStateHandle()) }
        VisitOf(vm.visit)
        PlacementTestFlow(goalId, goal?.displayName.orEmpty(), app.onboarding, app.plans, setProgress, navigator, vm)
    }
}

/**
 * The frame the tests from the plan share, a task: a question's title and segments, a ✕ that leaves or offers the
 * test's ways out, and the goal in the route or the switcher. A goal whose test is another route ([elsewhere]) goes
 * there; without one, Today.
 */
@Composable
internal fun TestTask(
    summaries: Resource<LearnerSummary>,
    summary: LoadState<LearnerSummary>,
    goal: LearnerSummaryGoal?,
    elsewhere: AppRoute?,
    navigator: AppNavigator,
    content: @Composable ColumnScope.(UUID, (Sitting?) -> Unit) -> Unit,
) {
    var sitting by remember { mutableStateOf<Sitting?>(null) }
    val waysOut = rememberWaysOut()
    val scope = rememberCoroutineScope()
    val tracker = LocalEventTracker.current
    val leave = {
        sitting?.asking?.let { tracker.track(it.left) }
        navigator.closeTask()
    }

    TaskScaffold(
        onClose = { closeTest(sitting, waysOut, leave) },
        title = { TestTitle(sitting) },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding).consumeWindowInsets(padding)) {
            TestSegments(sitting)
            Box(Modifier.weight(1f)) {
                when {
                    elsewhere != null -> {
                        TestRedirect(elsewhere, navigator)
                    }

                    goal != null -> {
                        SetupColumn { content(goal.id) { sitting = it } }
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
    TestWaysOut(sitting, waysOut, leave)
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

/** Where a course's test was opened, and how its ways out go on: onboarding's step, or back to the plan. */
internal class PlacementSetupEnd(
    val saving: Boolean,
    val continueWith: (UUID?) -> Unit,
)

/**
 * A course's test from its start to its result, the same in onboarding ([onboarding]) and from the plan. Its offer is
 * the plan's here; onboarding shows its own before this.
 */
@Composable
internal fun ColumnScope.PlacementTestFlow(
    goalId: UUID,
    subject: String,
    store: OnboardingStore,
    plans: PlanStore,
    onSitting: (Sitting?) -> Unit,
    navigator: AppNavigator,
    vm: PlacementTestViewModel,
    onboarding: PlacementSetupEnd? = null,
) {
    val resource = store.placements[goalId.toString()]
    val placement by resource.collectShown()
    val phase = vm.phase(placement, finished = onboarding != null)
    val scope = rememberCoroutineScope()
    val tracker = LocalEventTracker.current
    val waiting = phase == PlacementTestPhase.Waiting
    val run = remember { GenerationRun() }
    val poll = rememberPoll(active = waiting) { vm.check() }
    val hold = rememberReadyHold(ready = !waiting)
    val held = if (hold.over) phase else PlacementTestPhase.Waiting
    // A test whose questions arrived but that couldn't open is the wait's failure, which starts it again.
    val shown = if (held == PlacementTestPhase.Arrived && vm.failed) PlacementTestPhase.PreparationFailed(attempt = null) else held
    val attempt = placement.value?.attempt
    val test = courseTest(goalId, onboarding != null, attempt)
    val question = shown as? PlacementTestPhase.Question
    val title = (question?.attempt?.chapter?.takeIf { it.isNotBlank() } ?: subject).labelCase()
    val open = shown !in OUTSIDE_THE_TEST
    LaunchedEffect(question?.attempt?.answered, question?.attempt?.id, open) {
        onSitting(
            when {
                question != null -> {
                    asking(
                        test,
                        title,
                        question.attempt.answered,
                        question.attempt.questions,
                        stop = TestStop { vm.stop(question) }.takeIf { question.number > 1 },
                    )
                }

                open -> {
                    Sitting()
                }

                else -> {
                    null
                }
            },
        )
    }
    DisposableEffect(Unit) { onDispose { onSitting(null) } }
    val leave = { onboarding?.continueWith(shown.closedAttempt) ?: navigator.closeTask() }

    when (shown) {
        PlacementTestPhase.Loading -> {
            StepLoading()
        }

        PlacementTestPhase.LoadFailed -> {
            SetupContent { LoadFailedMessage(onRetry = { scope.launch { resource.refresh() } }) }
        }

        PlacementTestPhase.Choose -> {
            if (onboarding == null) {
                PlanCourseOffer(goalId, plans, test, vm, onNotNow = {
                    tracker.track(AnalyticsEvent.TestSkipped(test))
                    navigator.closeTask()
                })
            } else {
                StepLoading()
            }
        }

        PlacementTestPhase.Arrived -> {
            LaunchedEffect(Unit) { vm.start() }
            StepLoading()
        }

        PlacementTestPhase.Waiting, is PlacementTestPhase.PreparationFailed -> {
            val failedStart = shown is PlacementTestPhase.PreparationFailed
            PlacementWaiting(
                existingPlan = onboarding == null,
                run =
                    if (failedStart) {
                        GenerationRun(GenerationRun.Status.Failed, GenerationFailure.Generation)
                    } else {
                        run.withPoll(poll.stopped)
                    },
                onRetry =
                    when {
                        failedStart -> vm::start
                        poll.stopped -> poll::restart
                        else -> null
                    },
                hold = hold,
                pending = onboarding?.saving == true,
                // A start that didn't go through says so in the wait's failure, not again beside Skip.
                failed = vm.failed && held != PlacementTestPhase.Arrived,
                onSkip = leave,
                onboarding = onboarding != null,
            )
        }

        is PlacementTestPhase.Question -> {
            TrackFirstQuestion(vm.sitting, test, shown.number.toLong(), shown.attempt.id.toString())
            SetupContent {
                key(shown.item.itemId) {
                    PlacementQuestion(
                        item = shown.item,
                        labels = shown.labels,
                        pending = vm.answering,
                        saveFailures = vm.saveFailures,
                        onAnswer = { answer, durationMs -> vm.answer(shown, answer, durationMs) },
                    )
                }
            }
        }

        PlacementTestPhase.Unavailable -> {
            PlacementUnavailable(pending = onboarding?.saving == true, failed = false, onContinue = leave)
        }

        is PlacementTestPhase.Over -> {
            PlacementDone(pending = vm.busy, failed = vm.failed, onContinue = { vm.finish(shown.attempt) })
        }

        is PlacementTestPhase.Result -> {
            val undo = rememberPlacementUndo(plans, goalId, shown.changeId)
            // Undo puts the skipped lessons back, so the next lesson may be one of them.
            val lesson = shown.nextLessonId?.takeIf { onboarding == null && undo?.restoredLessons == null }
            PlacementResult(
                result = shown,
                action =
                    stringResource(
                        when {
                            onboarding != null -> R.string.onboarding_continue
                            lesson != null -> R.string.placementtest_start_lesson
                            else -> R.string.placementtest_done
                        },
                    ),
                onAction = {
                    when {
                        onboarding != null -> {
                            leave()
                        }

                        lesson != null -> {
                            tracker.track(AnalyticsEvent.TestLessonStarted(test, lesson.toString()))
                            navigator.closeTask()
                            navigator.open(AppRoute.Lesson(lesson.toString()))
                        }

                        else -> {
                            navigator.closeTask()
                        }
                    }
                },
                undo = undo,
                busy = onboarding?.saving == true,
                pressed = vm.pressed,
                failed = vm.failed,
            )
        }
    }
}

/** The phases before a test opens, which are the page's, not the test's task. */
private val OUTSIDE_THE_TEST = setOf(PlacementTestPhase.Loading, PlacementTestPhase.LoadFailed, PlacementTestPhase.Choose)

/** A course's test for analytics, with the open attempt's facts once there is one. */
internal fun courseTest(
    goalId: UUID,
    onboarding: Boolean,
    attempt: PlacementAttempt?,
) = TestContext(
    goalId = goalId.toString(),
    test = TestContext.Kind.Course,
    surface = if (onboarding) TestContext.Surface.Onboarding else TestContext.Surface.Plan,
    questions = attempt?.questions,
    attemptId = attempt?.id?.toString(),
)

/** The plan's offer for a course: the test's card alone, with "Not now". */
@Composable
private fun ColumnScope.PlanCourseOffer(
    goalId: UUID,
    plans: PlanStore,
    test: TestContext,
    vm: PlacementTestViewModel,
    onNotNow: () -> Unit,
) {
    val plan by plans.plan[goalId].collectShown()
    if (plan.isPending) {
        StepLoading()
        return
    }
    val offer = (plan.value?.plan?.placementTest as? PlanPlacementTest.PlanPlacementTestOneOfValue)?.value?.offer
    TestOffer(
        title = stringResource(R.string.placementtest_start_title),
        sentence = stringResource(R.string.placementtest_choose_description),
        cards =
            listOf(
                testCard(
                    TestRow.Quick,
                    stringResource(R.string.placementtest_test),
                    offer?.questions?.toInt(),
                    offer?.estimatedMinutes?.toInt(),
                ),
            ),
        initial = TestRow.Quick,
        pressed = vm.pressed,
        failed = vm.failed,
        onChoose = { vm.start() },
        test = test.copy(questions = offer?.questions),
        onNotNow = onNotNow,
    )
}
