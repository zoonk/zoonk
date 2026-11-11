package com.zoonk.android.feature.focustest

import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
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
import com.zoonk.android.ui.format.factsLine
import com.zoonk.api.models.FocusTestSitting

/**
 * An exam goal's Focus test, the same in onboarding's placement step and opened from the plan.
 * [onDone] leaves it: onboarding saves its step, a plan goes back to it. [onChangeFocus] is the
 * plan's focus sheet, for a checkpoint on a plan the learner already has.
 */
@Composable
internal fun ColumnScope.FocusTestFlow(
    goalId: String,
    host: FocusTestHost,
    subject: String,
    store: OnboardingStore,
    plans: PlanStore,
    run: GenerationRun,
    onRetryRun: (() -> Unit)?,
    onProgress: (Float?) -> Unit,
    onDone: LeaveTest,
    onChangeFocus: (() -> Unit)? = null,
    onReportSaveFailure: () -> Unit = {},
) {
    val drafts = LocalSetupDrafts.current
    val vm = viewModel(key = "focus-test:$goalId") { FocusTestViewModel(goalId, store, plans, drafts, createSavedStateHandle()) }
    val placement by store.placements[goalId].collectShown()
    val phase = vm.phase(placement)
    val waiting = phase is FocusTestPhase.Waiting
    val poll = rememberPoll(active = waiting && !run.isStopped) { vm.check() }
    val hold = rememberReadyHold(ready = !waiting)
    val shown = if (hold.over) phase else FocusTestPhase.Waiting(answered = (phase as? FocusTestPhase.Waiting)?.answered ?: false)
    val question = shown as? FocusTestPhase.Question
    val progress = question?.sitting?.let { if (it.questions > 0) it.answered.toFloat() / it.questions else 0f }
    LaunchedEffect(progress) { onProgress(progress) }
    DisposableEffect(Unit) { onDispose { onProgress(null) } }

    when (shown) {
        FocusTestPhase.Loading -> {
            StepLoading()
        }

        is FocusTestPhase.Waiting -> {
            val skip =
                when {
                    shown.answered -> stringResource(R.string.focustest_use_my_answers)
                    host == FocusTestHost.Onboarding -> stringResource(R.string.focustest_skip_for_now)
                    else -> stringResource(R.string.focustest_not_now)
                }
            PlacementWaiting(
                run = run.withPoll(poll.stopped),
                onRetry = if (poll.stopped) poll::restart else onRetryRun,
                hold = hold,
                pending = vm.busy,
                failed = vm.failed,
                onSkip = { vm.leave(closes = shown.answered || host == FocusTestHost.Onboarding, onDone) },
                skipLabel = skip,
                skipNote = stringResource(R.string.focustest_skip_note).takeIf { !shown.answered && host == FocusTestHost.Onboarding },
            )
        }

        FocusTestPhase.Unavailable -> {
            FocusTestUnavailable(vm, host, onDone)
        }

        is FocusTestPhase.Invitation -> {
            if (host == FocusTestHost.Onboarding) TrackOnboardingQuestion(goalId, "placement")
            FocusTestInvitation(
                test = shown.test,
                next = shown.next,
                host = host,
                subject = subject,
                pressed = vm.pressed,
                failed = vm.failed,
                onStart = { vm.start(onDone) },
                onSkip = { vm.leave(closes = host == FocusTestHost.Onboarding, onDone) },
            )
        }

        is FocusTestPhase.Resume -> {
            FocusTestResume(
                sitting = shown.question.sitting,
                subject = subject,
                pressed = vm.pressed,
                failed = vm.failed,
                onContinue = vm::resume,
                onUseAnswers = { vm.leave(closes = true, onDone) },
            )
        }

        is FocusTestPhase.Question -> {
            TestQuestion(goalId, shown, subject, vm, onDone, onReportSaveFailure)
        }

        is FocusTestPhase.Ended -> {
            FocusTestEnded(
                end = shown.end,
                subject = subject,
                pending = vm.pressed == Pressed.Main,
                failed = vm.failed,
                onFinish = { vm.finish(shown.end, onDone) },
            )
        }

        is FocusTestPhase.Checkpoint -> {
            FocusTestCheckpoint(
                test = shown.test,
                end = shown.end,
                host = host,
                subject = subject,
                pressed = vm.pressed,
                failed = vm.failed,
                proposal =
                    onChangeFocus?.let {
                        ProposalControls(vm.proposalAnswer, vm.deciding, vm.decisionFailed, vm::decide, onChangeFocus = it)
                    },
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

/** Nothing to ask and nothing answered: onboarding passes the step, a plan goes back. */
@Composable
private fun ColumnScope.FocusTestUnavailable(
    vm: FocusTestViewModel,
    host: FocusTestHost,
    onDone: LeaveTest,
) {
    PlacementUnavailable(
        pending = vm.pressed != null,
        failed = vm.failed,
        onContinue = { vm.leave(closes = host == FocusTestHost.Onboarding, onDone) },
    )
}
