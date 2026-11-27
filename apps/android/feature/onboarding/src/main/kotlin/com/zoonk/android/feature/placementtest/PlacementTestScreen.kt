package com.zoonk.android.feature.placementtest

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
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
import com.zoonk.android.feature.focustest.Pressed
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.setup.PlacementDone
import com.zoonk.android.feature.onboarding.setup.PlacementQuestion
import com.zoonk.android.feature.onboarding.setup.PlacementUnavailable
import com.zoonk.android.feature.onboarding.setup.PlacementWaiting
import com.zoonk.android.feature.onboarding.setup.SetupColumn
import com.zoonk.android.feature.onboarding.setup.SetupContent
import com.zoonk.android.feature.onboarding.setup.StepLoading
import com.zoonk.android.feature.onboarding.setup.TestProgress
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
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.factsLine
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.scaffold.TaskScaffold
import com.zoonk.api.models.LearnerSummary
import com.zoonk.api.models.LearnerSummaryGoal
import com.zoonk.api.models.PlacementAttempt
import com.zoonk.api.models.PlacementLength
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
 * The frame the tests from the plan share: the open question's bar, a ✕ that saves and leaves, and the goal in the
 * route or the switcher. A goal whose test is another route ([elsewhere]) goes there; without one, Today.
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
    val scope = rememberCoroutineScope()
    val tracker = LocalEventTracker.current

    TaskScaffold(
        onClose = {
            sitting?.let { tracker.track(it.left) }
            navigator.closeTask()
        },
        title = { sitting?.let { TestProgress(it.share) } },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding).consumeWindowInsets(padding)) {
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
    val shown = if (hold.over) phase else PlacementTestPhase.Waiting
    val attempt = placement.value?.attempt
    val test = courseTest(goalId, onboarding != null, attempt)
    val question = shown as? PlacementTestPhase.Question
    LaunchedEffect(question?.attempt?.answered, question?.attempt?.id) {
        onSitting(question?.attempt?.let { sitting(test, it.answered, it.questions) })
    }
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

        PlacementTestPhase.Waiting, is PlacementTestPhase.PreparationFailed -> {
            val failedAttempt = (shown as? PlacementTestPhase.PreparationFailed)?.attempt
            PlacementWaiting(
                existingPlan = onboarding == null,
                run =
                    if (failedAttempt == null) {
                        run.withPoll(poll.stopped)
                    } else {
                        GenerationRun(GenerationRun.Status.Failed, GenerationFailure.Generation)
                    },
                onRetry =
                    when {
                        failedAttempt != null -> {
                            { vm.start(failedAttempt.length) }
                        }

                        poll.stopped -> {
                            poll::restart
                        }

                        else -> {
                            null
                        }
                    },
                hold = hold,
                pending = onboarding?.saving == true,
                failed = vm.failed,
                onSkip = leave,
                onboarding = onboarding != null,
            )
        }

        is PlacementTestPhase.Question -> {
            TrackFirstQuestion(vm.sitting, test, shown.number.toLong(), "${shown.attempt.id}:${shown.attempt.part}")
            SetupContent {
                key(shown.item.itemId) {
                    PlacementQuestion(
                        item = shown.item,
                        subject = (shown.attempt.chapter ?: subject).labelCase(),
                        position =
                            questionPosition(
                                shown.number,
                                shown.attempt.questions.toInt(),
                                shown.attempt.part
                                    .toInt()
                                    .takeIf { shown.wholeCourse },
                                shown.attempt.parts.toInt(),
                            ),
                        labels = shown.labels,
                        pending = vm.answering,
                        saveFailures = vm.saveFailures,
                        onAnswer = { answer, durationMs -> vm.answer(shown, answer, durationMs) },
                        onStop = { vm.stop(shown) },
                        canStop = shown.number > 1,
                    )
                }
            }
        }

        PlacementTestPhase.Unavailable -> {
            PlacementUnavailable(pending = onboarding?.saving == true, failed = false, onContinue = leave)
        }

        is PlacementTestPhase.PartOver -> {
            PlacementDone(pending = vm.busy, failed = vm.failed, onContinue = { vm.finishPart(shown.attempt) })
        }

        is PlacementTestPhase.Continue -> {
            ContinueTest(
                facts = continueFacts(shown.attempt),
                pressed = vm.pressed ?: Pressed.Other.takeIf { onboarding?.saving == true },
                failed = vm.failed,
                onContinue = { vm.start(PlacementLength.WHOLE_COURSE) },
                other = stringResource(if (onboarding == null) R.string.placementtest_not_now else R.string.placementtest_finish_later),
                onOther = leave,
            )
        }

        is PlacementTestPhase.PartDone -> {
            PartDone(
                part = shown.part,
                parts = shown.parts,
                lessonsSkipped = shown.lessonsSkipped,
                heldUntilTomorrow = shown.heldUntilTomorrow,
                partsLeft = shown.partsLeft,
                minutesLeft = shown.minutesLeft,
                pressed = vm.pressed ?: Pressed.Other.takeIf { onboarding?.saving == true },
                failed = vm.failed,
                onFinishLater = leave,
                onKeepGoing = { vm.start(PlacementLength.WHOLE_COURSE) },
                undo = rememberPlacementUndo(plans, goalId, shown.changeId),
            )
        }

        is PlacementTestPhase.PartStopped -> {
            PartStopped(
                part = shown.part,
                parts = shown.parts,
                question = shown.question,
                lessonsSkipped = shown.lessonsSkipped,
                action = stringResource(if (onboarding == null) R.string.placementtest_done else R.string.onboarding_continue),
                onAction = leave,
                busy = onboarding?.saving == true,
                undo = rememberPlacementUndo(plans, goalId, shown.changeId),
            )
        }

        is PlacementTestPhase.Result -> {
            val undo = rememberPlacementUndo(plans, goalId, shown.changeId)
            // Undo puts the skipped lessons back, so the next lesson may be one of them.
            val lesson = shown.nextLessonId?.takeIf { onboarding == null && undo?.restoredLessons == null }
            PlacementResult(
                lessonsSkipped = shown.lessonsSkipped,
                nextLesson = shown.nextLesson,
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
                heldUntilTomorrow = shown.heldUntilTomorrow,
                rest = if (shown.partsLeft > 0) partsLeftFacts(shown.partsLeft, shown.minutesLeft) else emptyList(),
                onTestTheRest = { vm.start(PlacementLength.WHOLE_COURSE, Pressed.Other) }.takeIf { shown.partsLeft > 0 },
            )
        }
    }
}

/** A course's test for analytics, with the open attempt's facts once there is one. */
internal fun courseTest(
    goalId: UUID,
    onboarding: Boolean,
    attempt: PlacementAttempt?,
) = TestContext(
    goalId = goalId.toString(),
    test = TestContext.Kind.Course,
    surface = if (onboarding) TestContext.Surface.Onboarding else TestContext.Surface.Plan,
    part = attempt?.part,
    parts = attempt?.parts,
    questions = attempt?.questions,
    attemptId = attempt?.id?.toString(),
)

/** Where a full test with parts left stands: the question it picks up at, or the part it goes on with and the time left. */
@Composable
private fun continueFacts(attempt: PlacementAttempt): List<String> {
    val resume = attempt.resume
    val parts = attempt.parts.toInt()
    return if (resume != null) {
        listOf(
            stringResource(R.string.placementtest_part_of, resume.part.toInt(), parts),
            stringResource(R.string.onboarding_test_question_progress, resume.question.toInt(), attempt.questions.toInt()),
        )
    } else {
        listOfNotNull(
            stringResource(R.string.placementtest_part_of, (attempt.nextPart ?: attempt.part).toInt(), parts),
            attempt.remainingEstimatedMinutes.takeIf { it > 0 }?.let {
                stringResource(R.string.placementtest_about_left, formatMinutes(it.toInt(), currentLocale()))
            },
        )
    }
}

/** The plan's offer for a course: the quick and the full test when it has parts, else the one test with its facts. */
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
    val quick = offer?.let { testFacts(it.questions.toInt(), it.estimatedMinutes.toInt()) }.orEmpty()
    val whole = offer?.wholeCourse
    val rows =
        listOfNotNull(
            OfferRow(TestRow.Quick, stringResource(R.string.placementtest_quick), quick.factsLine()),
            whole?.let {
                OfferRow(
                    TestRow.WholeCourse,
                    stringResource(R.string.placementtest_full_test),
                    fullTestFacts(it.parts.toInt(), it.estimatedMinutes.toInt()).factsLine(),
                )
            },
        )
    TestOffer(
        title = stringResource(R.string.placementtest_start_title),
        sentence = stringResource(R.string.placementtest_choose_description),
        rows = rows,
        initial = TestRow.Quick,
        pressed = vm.pressed,
        failed = vm.failed,
        onChoose = { vm.start(if (it == TestRow.WholeCourse) PlacementLength.WHOLE_COURSE else PlacementLength.QUICK) },
        test = test.copy(parts = whole?.parts, questions = offer?.questions),
        chip = stringResource(R.string.placementtest_title),
        facts = quick,
        onNotNow = onNotNow,
    )
}
