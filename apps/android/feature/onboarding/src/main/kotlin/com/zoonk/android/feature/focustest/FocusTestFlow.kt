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
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.TrackOnboardingQuestion
import com.zoonk.android.data.collectShown
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.setup.LocalSetupDrafts
import com.zoonk.android.feature.onboarding.setup.PlacementQuestion
import com.zoonk.android.feature.onboarding.setup.PlacementUnavailable
import com.zoonk.android.feature.onboarding.setup.PlacementWaiting
import com.zoonk.android.feature.onboarding.setup.SetupContent
import com.zoonk.android.feature.onboarding.setup.StepLoading
import com.zoonk.android.feature.onboarding.setup.isStopped
import com.zoonk.android.feature.onboarding.setup.rememberPoll
import com.zoonk.android.feature.onboarding.setup.rememberUnsentWords
import com.zoonk.android.feature.onboarding.setup.typedDraftStep
import com.zoonk.android.feature.onboarding.setup.withPoll
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.feature.warmup.rememberReadyHold
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.format.factsLine
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
 * [onDone] leaves it: onboarding saves its step, a plan goes back to it. [plan] is set when the
 * plan is already the learner's.
 */
@Composable
internal fun ColumnScope.FocusTestFlow(
    goalId: String,
    subject: String,
    store: OnboardingStore,
    plans: PlanStore,
    run: GenerationRun,
    onRetryRun: (() -> Unit)?,
    onProgress: (Float?) -> Unit,
    onDone: LeaveTest,
    plan: OnPlan? = null,
    onReportSaveFailure: () -> Unit = {},
) {
    val drafts = LocalSetupDrafts.current
    val vm = viewModel(key = "focus-test:$goalId") { FocusTestViewModel(goalId, store, plans, drafts, createSavedStateHandle()) }
    val resource = store.placements[goalId]
    val placement by resource.collectShown()
    val phase = vm.phase(placement)
    val scope = rememberCoroutineScope()
    val waiting = phase is FocusTestPhase.Waiting
    val poll = rememberPoll(active = waiting && !run.isStopped) { vm.check() }
    val hold = rememberReadyHold(ready = !waiting)
    val shown = if (hold.over) phase else FocusTestPhase.Waiting(answered = (phase as? FocusTestPhase.Waiting)?.answered ?: false)
    val question = shown as? FocusTestPhase.Question
    val progress = question?.sitting?.let { if (it.questions > 0) it.answered.toFloat() / it.questions else 0f }
    LaunchedEffect(progress) { onProgress(progress) }
    DisposableEffect(Unit) { onDispose { onProgress(null) } }
    val onboarding = plan == null
    // Today's "Start the test" already made the offer; until the start answers, the offer waits behind a spinner.
    // A start the app was closed during runs again when the test comes back: the API answers it with the open sitting.
    val starting = plan?.startOnOpen == true && shown is FocusTestPhase.Offer && !vm.failed
    if (starting) LaunchedEffect(Unit) { vm.start(onDone) }

    when {
        shown == FocusTestPhase.Loading || starting -> {
            StepLoading()
        }

        shown == FocusTestPhase.LoadFailed -> {
            SetupContent { LoadFailedMessage(onRetry = { scope.launch { resource.refresh() } }) }
        }

        shown is FocusTestPhase.Waiting -> {
            val skip =
                when {
                    shown.answered -> stringResource(R.string.focustest_see_my_result)
                    onboarding -> stringResource(R.string.focustest_skip_for_now)
                    else -> stringResource(R.string.focustest_not_now)
                }
            PlacementWaiting(
                run = run.withPoll(poll.stopped),
                onRetry = if (poll.stopped) poll::restart else onRetryRun,
                hold = hold,
                pending = vm.busy,
                failed = vm.failed,
                onSkip = { vm.leave(closes = shown.answered || onboarding, onDone) },
                skipLabel = skip,
                skipNote = stringResource(R.string.focustest_skip_note).takeIf { !shown.answered && onboarding },
            )
        }

        shown == FocusTestPhase.Unavailable -> {
            PlacementUnavailable(
                pending = vm.pressed != null,
                failed = vm.failed,
                onContinue = { vm.leave(closes = onboarding, onDone) },
            )
        }

        shown is FocusTestPhase.Offer -> {
            if (onboarding) TrackOnboardingQuestion(goalId, "placement")
            FocusTestOffer(
                test = shown.test,
                minutes = shown.minutes,
                onPlan = !onboarding,
                pressed = vm.pressed,
                failed = vm.failed,
                onStart = { vm.start(onDone) },
                onSkip = { vm.leave(closes = onboarding, onDone) },
            )
        }

        shown is FocusTestPhase.Resume -> {
            FocusTestResume(
                sitting = shown.question.sitting,
                answered = shown.answered.toInt(),
                pressed = vm.pressed,
                failed = vm.failed,
                onContinue = vm::resume,
                onSeeResult = { vm.leave(closes = true, onDone) },
            )
        }

        shown is FocusTestPhase.Question -> {
            TestQuestion(goalId, shown, subject, vm, onDone, onReportSaveFailure)
        }

        shown == FocusTestPhase.Ended -> {
            FocusTestEnded(pending = vm.pressed == Pressed.Main, failed = vm.failed, onFinish = { vm.finish(onDone) })
        }

        shown is FocusTestPhase.Checkpoint -> {
            FocusTestCheckpoint(
                test = shown.test,
                plan =
                    plan?.let {
                        PlanControls(vm.proposalAnswer, vm.deciding, vm.decisionFailed, vm::decide, it.onChangeFocus, it.questions)
                    },
                canContinue = shown.test.offer != null,
                pressed = vm.pressed,
                failed = vm.failed,
                onDone = { vm.done(onDone) },
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
    onDone: LeaveTest,
    onReportSaveFailure: () -> Unit,
) {
    val sitting = question.sitting
    val name = sitting.subject?.let { displayName(it.name, it.shortName) } ?: subject

    SetupContent {
        key(question.item.itemId) {
            PlacementQuestion(
                item = question.item,
                eyebrow =
                    factsLine(
                        name,
                        stringResource(R.string.focustest_question_number, sitting.answered.toInt() + 1, sitting.questions.toInt()),
                    ),
                labels = question.labels,
                typedWords = rememberUnsentWords(goalId, typedDraftStep(question.item.itemId), count = 1),
                pending = vm.answering,
                saveFailures = vm.saveFailures,
                onReportSaveFailure = onReportSaveFailure,
                onAnswer = { answer, durationMs -> vm.answer(question, answer, durationMs, onDone) },
                onStop = { vm.stop(onDone) },
                stopLabel = stringResource(R.string.focustest_stop),
                stopHint = stringResource(R.string.focustest_many_unknown).takeIf { sitting.hint == FocusTestSitting.Hint.MANY_UNKNOWN },
            )
        }
    }
}
