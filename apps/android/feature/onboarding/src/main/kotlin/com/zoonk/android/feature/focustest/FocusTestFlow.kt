package com.zoonk.android.feature.focustest

import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.res.stringResource
import androidx.lifecycle.createSavedStateHandle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.data.AnalyticsEvent
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.LocalEventTracker
import com.zoonk.android.data.TestContext
import com.zoonk.android.data.TrackOnboardingQuestion
import com.zoonk.android.data.collectShown
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.WriteOutcome
import com.zoonk.android.feature.onboarding.setup.PlacementQuestion
import com.zoonk.android.feature.onboarding.setup.PlacementUnavailable
import com.zoonk.android.feature.onboarding.setup.PlacementWaiting
import com.zoonk.android.feature.onboarding.setup.SetupContent
import com.zoonk.android.feature.onboarding.setup.StepLoading
import com.zoonk.android.feature.onboarding.setup.isStopped
import com.zoonk.android.feature.onboarding.setup.rememberPoll
import com.zoonk.android.feature.onboarding.setup.withPoll
import com.zoonk.android.feature.placementtest.Sitting
import com.zoonk.android.feature.placementtest.TrackFirstQuestion
import com.zoonk.android.feature.placementtest.questionPosition
import com.zoonk.android.feature.placementtest.sitting
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.feature.warmup.rememberReadyHold
import com.zoonk.android.ui.ActOn
import com.zoonk.android.ui.VisitOf
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.api.models.FocusTestSitting
import kotlinx.coroutines.launch

/** The test opened on a plan the learner already has: its focus sheet, the switch for its questions in sessions, and whether Today's "Start the test" opened it. */
internal class OnPlan(
    val onChangeFocus: () -> Unit,
    val questions: SessionQuestionsModel,
    val startOnOpen: Boolean,
)

/**
 * An exam goal's Focus test, the same in onboarding's placement step and opened from the plan.
 * Leaving it saves [handBack] (onboarding's step), then [onLeft] goes on (a plan goes back to it).
 * [plan] is set when the plan is already the learner's. [asked]: the learner asked for the test on
 * the level question, so it starts without its offer. [levelGiven]: the learner said where they stand on it, which
 * onboarding's "First lesson" starts from.
 */
@Composable
internal fun ColumnScope.FocusTestFlow(
    goalId: String,
    subject: String,
    store: OnboardingStore,
    plans: PlanStore,
    run: GenerationRun,
    onRetryRun: (() -> Unit)?,
    onSitting: (Sitting?) -> Unit,
    handBack: LeaveTest = { WriteOutcome.Done(Unit) },
    plan: OnPlan? = null,
    asked: Boolean = false,
    levelGiven: Boolean = false,
    onReportSaveFailure: () -> Unit = {},
    onLeft: () -> Unit = {},
) {
    val vm = viewModel(key = "focus-test:$goalId") { FocusTestViewModel(goalId, store, plans, createSavedStateHandle(), handBack) }
    VisitOf(vm.visit)
    ActOn(vm.left) { onLeft() }
    val resource = store.placements[goalId]
    val placement by resource.collectShown()
    val phase = vm.phase(placement)
    val scope = rememberCoroutineScope()
    val waiting = phase is FocusTestPhase.Waiting
    val poll = rememberPoll(active = waiting && !run.isStopped) { vm.check() }
    val hold = rememberReadyHold(ready = !waiting)
    val shown = if (hold.over) phase else FocusTestPhase.Waiting(answered = (phase as? FocusTestPhase.Waiting)?.answered ?: false)
    val onboarding = plan == null
    val question = shown as? FocusTestPhase.Question
    val test =
        TestContext(
            goalId = goalId,
            test = TestContext.Kind.Focus,
            surface = if (onboarding) TestContext.Surface.Onboarding else TestContext.Surface.Plan,
            questions = question?.sitting?.questions ?: (shown as? FocusTestPhase.Offer)?.test?.offer?.questions,
        )
    LaunchedEffect(question?.sitting?.answered, question?.sitting?.questions) {
        onSitting(question?.sitting?.let { sitting(test, it.answered, it.questions) })
    }
    DisposableEffect(Unit) { onDispose { onSitting(null) } }
    val tracker = LocalEventTracker.current
    // Today's "Start the test" and the level question's "short test" already made the offer; until the start answers,
    // the offer waits behind a spinner.
    val starting = (plan?.startOnOpen == true || asked) && shown is FocusTestPhase.Offer && !vm.failed
    if (starting) LaunchedEffect(vm.busy) { vm.startAsked() }

    when {
        shown == FocusTestPhase.Loading || starting -> {
            StepLoading()
        }

        shown == FocusTestPhase.LoadFailed -> {
            SetupContent { LoadFailedMessage(onRetry = { scope.launch { resource.refresh() } }) }
        }

        shown is FocusTestPhase.Waiting -> {
            PlacementWaiting(
                run = run.withPoll(poll.stopped),
                onRetry = if (poll.stopped) poll::restart else onRetryRun,
                hold = hold,
                pending = vm.busy,
                failed = vm.failed,
                onSkip = { vm.leave(closes = shown.answered || onboarding) },
                onboarding = onboarding,
                skipLabel = stringResource(R.string.focustest_see_my_result).takeIf { shown.answered },
            )
        }

        shown == FocusTestPhase.Unavailable -> {
            PlacementUnavailable(
                pending = vm.pressed != null,
                failed = vm.failed,
                onContinue = { vm.leave(closes = onboarding) },
            )
        }

        shown is FocusTestPhase.Offer -> {
            if (onboarding) TrackOnboardingQuestion(goalId, "placement")
            FocusTestOffer(
                test = shown.test,
                minutes = shown.minutes,
                onPlan = !onboarding,
                levelGiven = levelGiven,
                pressed = vm.pressed,
                failed = vm.failed,
                onStart = vm::start,
                onSkip = {
                    if (!onboarding) tracker.track(AnalyticsEvent.TestSkipped(test))
                    vm.leave(closes = onboarding)
                },
                analytics = test,
            )
        }

        shown is FocusTestPhase.Question -> {
            TrackFirstQuestion(vm.sitting, test, shown.sitting.answered + 1, "focus:${vm.sittingsEntered}")
            TestQuestion(goalId, shown, subject, vm, onReportSaveFailure)
        }

        shown == FocusTestPhase.Ended -> {
            FocusTestEnded(pending = vm.pressed == Pressed.Main, failed = vm.failed, onFinish = vm::finish)
        }

        shown is FocusTestPhase.Checkpoint -> {
            FocusTestCheckpoint(
                test = shown.test,
                plan =
                    plan?.let {
                        PlanControls(
                            vm.proposalAnswer,
                            vm.repricedProposal,
                            vm.deciding,
                            vm.decisionFailed,
                            vm::decide,
                            it.onChangeFocus,
                            it.questions,
                        )
                    },
                canContinue = shown.test.offer != null,
                pressed = vm.pressed,
                failed = vm.failed,
                onDone = vm::done,
                onContinueTest = vm::continueTest,
            )
        }
    }
}

@Composable
private fun ColumnScope.TestQuestion(
    goalId: String,
    question: FocusTestPhase.Question,
    subject: String,
    vm: FocusTestViewModel,
    onReportSaveFailure: () -> Unit,
) {
    val sitting = question.sitting
    val name = sitting.subject?.name ?: subject

    SetupContent {
        key(question.item.itemId) {
            PlacementQuestion(
                item = question.item,
                subject = name,
                position = questionPosition(sitting.answered.toInt() + 1, sitting.questions.toInt()),
                labels = question.labels,
                pending = vm.answering,
                saveFailures = vm.saveFailures,
                onReportSaveFailure = onReportSaveFailure,
                onAnswer = { answer, durationMs -> vm.answer(question, answer, durationMs) },
                onStop = vm::stop,
                canStop = sitting.answered > 0,
                stopLabel = stringResource(R.string.focustest_stop),
                stopHint = stringResource(R.string.focustest_many_unknown).takeIf { sitting.hint == FocusTestSitting.Hint.MANY_UNKNOWN },
            )
        }
    }
}
