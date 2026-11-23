package com.zoonk.android.feature.onboarding.setup

import android.os.SystemClock
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.lifecycle.createSavedStateHandle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.data.AnalyticsEvent
import com.zoonk.android.data.GenerationKind
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.TrackOnboardingQuestion
import com.zoonk.android.data.collectShown
import com.zoonk.android.feature.focustest.Pressed
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.WriteOutcome
import com.zoonk.android.feature.onboarding.start.OnboardingActions
import com.zoonk.android.feature.onboarding.start.OnboardingHeading
import com.zoonk.android.feature.onboarding.start.OnboardingSubject
import com.zoonk.android.feature.placementtest.LengthChoice
import com.zoonk.android.feature.placementtest.SetupTestChoice
import com.zoonk.android.feature.practice.SaveErrorText
import com.zoonk.android.feature.questions.Answer
import com.zoonk.android.feature.questions.Question
import com.zoonk.android.feature.questions.QuestionAnswer
import com.zoonk.android.feature.questions.QuestionFormat
import com.zoonk.android.feature.questions.TrueFalseWords
import com.zoonk.android.feature.warmup.ReadyHold
import com.zoonk.android.feature.warmup.rememberReadyHold
import com.zoonk.android.ui.VisitOf
import com.zoonk.android.ui.components.AnswerOption
import com.zoonk.android.ui.components.AnswerOptionGroup
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.ButtonEdge
import com.zoonk.android.ui.components.ButtonIcon
import com.zoonk.android.ui.components.GenerationWait
import com.zoonk.android.ui.components.LessonVisual
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.PictureFrame
import com.zoonk.android.ui.components.PrivatePicture
import com.zoonk.android.ui.components.TaskActions
import com.zoonk.android.ui.components.TextButton
import com.zoonk.android.ui.richtext.RichText
import com.zoonk.android.ui.theme.zoonkType
import com.zoonk.api.models.PlacementLength
import com.zoonk.api.models.TrueFalseLabels
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import kotlin.time.Duration.Companion.seconds

/** A language goal with a target language takes its level test instead, which its caller picks before this. */
@Composable
internal fun ColumnScope.PlacementStep(
    goalId: String,
    subject: String,
    run: GenerationRun,
    onRetryRun: (() -> Unit)?,
    store: OnboardingStore,
    onProgress: (Float?) -> Unit,
    onDone: suspend () -> WriteOutcome<*>,
    onReportSaveFailure: () -> Unit = {},
    lengthChoice: SetupTestChoice,
) {
    val vm = viewModel(key = "placement:$goalId") { PlacementViewModel(goalId, store, createSavedStateHandle(), onDone) }
    VisitOf(vm.visit)
    val resource = store.placements[goalId]
    val placement by resource.collectShown()
    val phase = vm.phase(placement)
    val scope = rememberCoroutineScope()
    val poll = rememberPoll(active = phase == PlacementPhase.Waiting && !run.isStopped) { vm.check() }
    val hold = rememberReadyHold(ready = phase != PlacementPhase.Waiting)
    val shown = if (hold.over) phase else PlacementPhase.Waiting
    val finish = { fromScratch: Boolean -> vm.finish(fromScratch) }
    val progress = (shown as? PlacementPhase.Question)?.spent?.toFloat()
    LaunchedEffect(progress) { onProgress(progress) }
    DisposableEffect(Unit) { onDispose { onProgress(null) } }

    when (shown) {
        PlacementPhase.Loading -> {
            StepLoading()
        }

        PlacementPhase.LoadFailed -> {
            SetupContent { LoadFailedMessage(onRetry = { scope.launch { resource.refresh() } }) }
        }

        PlacementPhase.ChooseLength -> {
            TrackOnboardingQuestion(goalId, "placement")
            LengthChoice(
                wholeCourseMinutes = lengthChoice.minutes,
                pressed =
                    when {
                        vm.isStarting -> Pressed.Main
                        vm.isSaving -> Pressed.Other
                        else -> lengthChoice.pressed
                    },
                failed = vm.finishFailed || lengthChoice.failed,
                onStart = { length -> if (length == PlacementLength.QUICK) vm.start() else lengthChoice.startWhole() },
                onSkip = { finish(true) },
            )
        }

        PlacementPhase.Waiting -> {
            PlacementWaiting(
                run = run.withPoll(poll.stopped),
                onRetry = if (poll.stopped) poll::restart else onRetryRun,
                hold = hold,
                pending = vm.isSaving,
                failed = vm.finishFailed,
                onSkip = { finish(false) },
            )
        }

        PlacementPhase.Unavailable -> {
            PlacementUnavailable(pending = vm.isSaving, failed = vm.finishFailed, onContinue = { finish(false) })
        }

        is PlacementPhase.Question -> {
            SetupContent {
                FinishFailed(vm.finishFailed)
                key(shown.item.itemId) {
                    PlacementQuestion(
                        item = shown.item,
                        subject = subject.labelCase(),
                        position = stringResource(R.string.onboarding_placement_question_number, shown.number),
                        labels = shown.labels,
                        pending = vm.isSaving,
                        saveFailures = vm.saveFailures,
                        onReportSaveFailure = onReportSaveFailure,
                        onAnswer = { answer, durationMs -> vm.answer(shown, answer, durationMs) },
                        onStop = { vm.finish(fromScratch = false, fromQuestion = true) },
                        canStop = shown.number > 1,
                    )
                }
            }
        }

        PlacementPhase.Done -> {
            PlacementDone(pending = vm.isSaving, failed = vm.finishFailed, onContinue = { finish(false) })
        }
    }
}

@Composable
internal fun ColumnScope.StepLoading() {
    SetupContent {
        Box(Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
    }
}

/** The Focus test passes its own way out of the wait: a learner with answers uses them, one on a plan just goes back. */
@Composable
internal fun ColumnScope.PlacementWaiting(
    run: GenerationRun,
    onRetry: (() -> Unit)?,
    hold: ReadyHold,
    pending: Boolean,
    failed: Boolean,
    onSkip: () -> Unit,
    skipLabel: String = stringResource(R.string.onboarding_language_test_skip),
    skipNote: String? = null,
    existingPlan: Boolean = false,
) {
    var patient by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        delay(PATIENCE)
        patient = true
    }

    val shown = if (hold.holding) run.copy(status = GenerationRun.Status.Ready, failure = null) else run
    val title =
        stringResource(
            com.zoonk.android.feature.warmup
                .placementWaitTitle(hold.holding, shown.status == GenerationRun.Status.Failed),
        )
    val kind = if (existingPlan) GenerationKind.PlacementQuestions else GenerationKind.Placement
    SetupWait(
        shown,
        kind,
        AnalyticsEvent.WarmUpSurface.PlacementWait,
        title,
        hold,
        stringResource(R.string.onboarding_continue),
        onRetry,
        skip =
            if (patient || run.status == GenerationRun.Status.Failed) {
                {
                    FinishFailed(failed)
                    OutlinedButton(
                        busy = pending,
                        onClick = onSkip,
                        modifier = Modifier.fillMaxWidth(),
                        leadingIcon = { ButtonIcon(R.drawable.ic_skip_next) },
                    ) {
                        Text(skipLabel)
                    }
                    skipNote?.let {
                        Text(
                            text = it,
                            modifier = Modifier.fillMaxWidth(),
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            textAlign = TextAlign.Center,
                            style = MaterialTheme.typography.bodyMedium,
                        )
                    }
                }
            } else {
                null
            },
    ) { share ->
        GenerationWait(kind, shown, onRetry, share = share) {
            OnboardingHeading(
                title,
                when {
                    hold.holding || shown.status == GenerationRun.Status.Failed -> null
                    READS_MATERIAL_STEP in run.steps -> stringResource(R.string.onboarding_placement_waiting_material)
                    else -> stringResource(R.string.onboarding_placement_waiting_time)
                },
            )
        }
    }
}

private enum class PlacementSender { Confirm, DontKnow, Stop }

/**
 * Shared with the Focus test, the plan's tests and the language level test. Placement asks by taps alone: a
 * statement keeps its plain two options under its title, and every other format takes the runners' controls.
 */
@Composable
internal fun ColumnScope.PlacementQuestion(
    item: Question,
    subject: String?,
    labels: TrueFalseLabels,
    pending: Boolean,
    saveFailures: Int,
    onAnswer: (Answer, Long) -> Unit,
    onStop: () -> Unit,
    canStop: Boolean,
    onReportSaveFailure: () -> Unit = {},
    dontKnowLabel: String = stringResource(R.string.onboarding_placement_dont_know),
    stopLabel: String = stringResource(R.string.onboarding_placement_stop),
    /** Said right above Stop, when stopping is worth suggesting. */
    stopHint: String? = null,
    /** Where the question sits, at the end of [subject]'s row, such as "Question 2" or a whole-course test's part. */
    position: String? = null,
    media: @Composable () -> Unit = {},
) {
    var draftJson by rememberSaveable { mutableStateOf<String?>(null) }
    val answer = draftJson?.let { Json.decodeFromString(Answer.serializer(), it) }
    val setAnswer = { picked: Answer? -> draftJson = picked?.let { Json.encodeToString(Answer.serializer(), it) } }
    var sender by rememberSaveable { mutableStateOf<PlacementSender?>(null) }
    val shownAt = remember { SystemClock.elapsedRealtime() }
    val send = { chosen: Answer, pressed: PlacementSender ->
        if (!pending) {
            sender = pressed
            onAnswer(chosen, SystemClock.elapsedRealtime() - shownAt)
        }
    }
    val confirm = { answer?.let { send(it, PlacementSender.Confirm) } }
    val visual = item.visual

    QuestionPages(
        questionId = item.itemId,
        read = {
            subject?.let { OnboardingSubject(it, position) }
            media()
            item.context?.let { RichText(it, style = MaterialTheme.typography.bodyLarge) }
            item.image?.let { PrivatePicture(it.url, it.alt, it.width, it.height, PictureFrame.Question) }
            visual?.let { LessonVisual(it) }
            RichText(item.question, modifier = Modifier.semantics { heading() }, style = MaterialTheme.zoonkType.question)
        },
        answer = {
            if (item.format == QuestionFormat.TrueFalse) {
                StatementAnswers(labels, answer, onPick = setAnswer)
            } else {
                QuestionAnswer(
                    question = item,
                    words = TrueFalseWords.TrueFalse,
                    allowBlank = false,
                    check = null,
                    draft = answer,
                    enabled = !pending,
                    onAnswer = setAnswer,
                    onSubmit = { send(it, PlacementSender.Confirm) },
                )
            }
            if (canStop) {
                stopHint?.let {
                    Text(
                        text = it,
                        modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
                TextButton(
                    onClick = {
                        sender = PlacementSender.Stop
                        onStop()
                    },
                    busy = pending && sender == PlacementSender.Stop,
                    enabled = !pending,
                    focusableWhenDisabled = pending,
                    edge = ButtonEdge.Start,
                ) {
                    Text(stopLabel, textDecoration = TextDecoration.Underline)
                }
            }
        },
    ) {
        if (saveFailures > 0 && !pending) {
            SaveErrorText(
                failures = saveFailures,
                firstFailureMessage = stringResource(R.string.onboarding_placement_answer_failed),
                onReport = onReportSaveFailure,
            )
        }
        TaskActions { main ->
            OutlinedButton(
                onClick = { send(Answer.DontKnow, PlacementSender.DontKnow) },
                busy = pending && sender == PlacementSender.DontKnow,
                enabled = !pending,
                focusableWhenDisabled = pending,
                leadingIcon = { ButtonIcon(R.drawable.ic_help) },
            ) {
                Text(dontKnowLabel)
            }
            Button(
                onClick = { confirm() },
                busy = pending && sender == PlacementSender.Confirm,
                modifier = main,
                enabled = answer != null && !pending,
                focusableWhenDisabled = pending,
            ) {
                Text(stringResource(R.string.onboarding_placement_confirm))
            }
        }
    }
}

/** A statement's title is the question itself, so its two options are plain words under it. */
@Composable
private fun StatementAnswers(
    labels: TrueFalseLabels,
    picked: Answer?,
    onPick: (Answer) -> Unit,
) {
    val rightWrong = labels == TrueFalseLabels.RIGHT_WRONG
    AnswerOptionGroup {
        listOf(true, false).forEachIndexed { index, isTrue ->
            val label =
                when {
                    rightWrong && isTrue -> R.string.onboarding_placement_right
                    rightWrong -> R.string.onboarding_placement_wrong
                    isTrue -> R.string.onboarding_placement_true
                    else -> R.string.onboarding_placement_false
                }
            AnswerOption(
                marker = index + 1,
                picked = picked == Answer.TrueFalse(isTrue),
                result = null,
                onClick = { onPick(Answer.TrueFalse(isTrue)) },
            ) {
                Text(stringResource(label), style = MaterialTheme.typography.bodyLarge)
            }
        }
    }
}

/** Main's `PlacementDone`: a test that's over and not saved yet; the title says it's done. */
@Composable
internal fun ColumnScope.PlacementDone(
    pending: Boolean,
    failed: Boolean,
    onContinue: () -> Unit,
) {
    PlacementOutcome(
        title = stringResource(R.string.focustest_answers_saved_title),
        description = null,
        pending = pending,
        failed = failed,
        onContinue = onContinue,
    )
}

@Composable
internal fun ColumnScope.PlacementUnavailable(
    pending: Boolean,
    failed: Boolean,
    onContinue: () -> Unit,
) {
    PlacementOutcome(
        title = stringResource(R.string.onboarding_placement_unavailable_title),
        description = null,
        pending = pending,
        failed = failed,
        onContinue = onContinue,
    )
}

@Composable
private fun ColumnScope.PlacementOutcome(
    title: String,
    description: String?,
    pending: Boolean,
    failed: Boolean,
    onContinue: () -> Unit,
) {
    SetupContent {
        OnboardingHeading(title, description)
        OnboardingActions {
            FinishFailed(failed)
            Button(
                busy = pending,
                onClick = onContinue,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(stringResource(R.string.onboarding_continue))
            }
        }
    }
}

@Composable
internal fun FinishFailed(failed: Boolean) {
    if (!failed) return
    Text(
        text = stringResource(R.string.onboarding_save_failed),
        modifier = Modifier.fillMaxWidth().semantics { liveRegion = LiveRegionMode.Polite },
        color = MaterialTheme.colorScheme.error,
        style = MaterialTheme.typography.bodyMedium,
    )
}

internal fun String.labelCase() = replaceFirstChar { it.uppercase() }

private val PATIENCE = 20.seconds
private const val READS_MATERIAL_STEP = "readExamNotice"
