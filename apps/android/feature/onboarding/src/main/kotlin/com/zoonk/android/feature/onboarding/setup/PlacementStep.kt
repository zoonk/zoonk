package com.zoonk.android.feature.onboarding.setup

import android.os.SystemClock
import androidx.annotation.StringRes
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
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.lifecycle.createSavedStateHandle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.data.AnalyticsEvent
import com.zoonk.android.data.GenerationKind
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.TrackOnboardingQuestion
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.recode
import com.zoonk.android.feature.focustest.Pressed
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.WriteOutcome
import com.zoonk.android.feature.onboarding.start.OnboardingActions
import com.zoonk.android.feature.onboarding.start.OnboardingHeading
import com.zoonk.android.feature.player.steps.StepPart
import com.zoonk.android.feature.practice.SaveErrorText
import com.zoonk.android.feature.questions.Answer
import com.zoonk.android.feature.questions.ItemSupport
import com.zoonk.android.feature.questions.NotSureButton
import com.zoonk.android.feature.questions.Question
import com.zoonk.android.feature.questions.QuestionAnswer
import com.zoonk.android.feature.questions.QuestionFormat
import com.zoonk.android.feature.questions.QuestionTitle
import com.zoonk.android.feature.questions.initialAnswer
import com.zoonk.android.feature.warmup.ReadyHold
import com.zoonk.android.feature.warmup.rememberReadyHold
import com.zoonk.android.ui.VisitOf
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.ButtonIcon
import com.zoonk.android.ui.components.GenerationWait
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.TaskActions
import com.zoonk.api.models.TrueFalseLabels
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import kotlin.time.Duration.Companion.seconds

@Composable
internal fun ColumnScope.StepLoading() {
    SetupContent {
        Box(Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
    }
}

/**
 * The wait for a test's questions, with its way out there from the start: "Skip" with where the test waits in
 * [onboarding], "Not now" on the plan. [skipLabel] replaces it where leaving does more, as the Focus test's "See my
 * result" does for a learner with answers.
 */
@Composable
internal fun ColumnScope.PlacementWaiting(
    run: GenerationRun,
    onRetry: (() -> Unit)?,
    hold: ReadyHold,
    pending: Boolean,
    failed: Boolean,
    onSkip: () -> Unit,
    onboarding: Boolean,
    existingPlan: Boolean = !onboarding,
    skipLabel: String? = null,
) {
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
        skip = {
            FinishFailed(failed)
            OutlinedButton(busy = pending, onClick = onSkip, modifier = Modifier.fillMaxWidth()) {
                Text(skipLabel ?: stringResource(if (onboarding) R.string.onboarding_skip else R.string.placementtest_not_now))
            }
            if (onboarding && skipLabel == null) {
                Text(
                    text = stringResource(R.string.focustest_skip_note),
                    modifier = Modifier.fillMaxWidth(),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
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

private enum class PlacementSender { Confirm, DontKnow }

/**
 * The bar's second button where it does more than "I don't know yet": its [label] now, every label it can change to
 * ([labels], so it holds the widest one's width), and what it does instead of answering ([onClick]).
 */
internal class SecondAction(
    val label: String,
    val labels: List<String> = emptyList(),
    val busy: Boolean = false,
    val onClick: (() -> Unit)? = null,
)

/**
 * Shared with the Focus test, the plan's tests and the language level test. Every format takes practice's question and
 * controls, so a test looks and answers like the lessons it places. What it tests and where the learner is are the
 * test's top; a save that's out for the question ([pending]) with no button of its own, such as a stop, shows on
 * Confirm.
 */
@Composable
internal fun ColumnScope.PlacementQuestion(
    item: Question,
    labels: TrueFalseLabels,
    pending: Boolean,
    saveFailures: Int,
    onAnswer: (Answer, Long) -> Unit,
    onReportSaveFailure: () -> Unit = {},
    second: SecondAction = SecondAction(stringResource(R.string.onboarding_placement_dont_know)),
    media: @Composable () -> Unit = {},
) {
    var draftJson by rememberSaveable { mutableStateOf<String?>(null) }
    val answer = draftJson?.let { Json.decodeFromString(Answer.serializer(), it) } ?: item.initialAnswer
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
    val ask: @Composable (StepPart) -> Unit = { part ->
        QuestionAnswer(
            question = item,
            words = labels.recode(),
            allowBlank = false,
            check = null,
            draft = answer,
            enabled = !pending,
            onAnswer = setAnswer,
            onSubmit = { send(it, PlacementSender.Confirm) },
            part = part,
        )
    }

    QuestionPages(
        questionId = item.itemId,
        read = {
            media()
            ItemSupport(item)
            if (item.format != QuestionFormat.TrueFalse) QuestionTitle(item.question)
            // Across an open book's fold a statement's card stays on the page before it, as in practice.
            if (LocalSetupPage.current?.fold != null) ask(StepPart.Screen)
        },
        answer = { ask(if (LocalSetupPage.current?.fold != null) StepPart.Turn else StepPart.Whole) },
    ) {
        if (saveFailures > 0 && !pending) {
            SaveErrorText(
                failures = saveFailures,
                firstFailureMessage = stringResource(R.string.onboarding_placement_answer_failed),
                onReport = onReportSaveFailure,
            )
        }
        TaskActions { main ->
            NotSureButton(
                onClick = { second.onClick?.invoke() ?: send(Answer.DontKnow, PlacementSender.DontKnow) },
                busy = second.busy || (pending && sender == PlacementSender.DontKnow),
                enabled = !pending && !second.busy,
                focusableWhenDisabled = pending || second.busy,
                label = second.label,
                labels = second.labels,
            )
            Button(
                onClick = { confirm() },
                busy = pending && sender != PlacementSender.DontKnow && !second.busy,
                modifier = main,
                enabled = answer != null && !pending && !second.busy,
                focusableWhenDisabled = pending,
            ) {
                Text(stringResource(R.string.onboarding_placement_confirm))
            }
        }
    }
}

@Composable
internal fun ColumnScope.PlacementDone(
    pending: Boolean,
    failed: Boolean,
    onContinue: () -> Unit,
) {
    PlacementOutcome(
        title = stringResource(R.string.focustest_answers_saved_title),
        failureMessage = R.string.mock_step_failed,
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
        failureMessage = R.string.onboarding_save_failed,
        pending = pending,
        failed = failed,
        onContinue = onContinue,
    )
}

@Composable
private fun ColumnScope.PlacementOutcome(
    title: String,
    @StringRes failureMessage: Int,
    pending: Boolean,
    failed: Boolean,
    onContinue: () -> Unit,
) {
    SetupContent {
        OnboardingHeading(title)
        OnboardingActions {
            FinishFailed(failed, failureMessage)
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
internal fun FinishFailed(
    failed: Boolean,
    @StringRes message: Int = R.string.onboarding_save_failed,
) {
    if (!failed) return
    Text(
        text = stringResource(message),
        modifier = Modifier.fillMaxWidth().semantics { liveRegion = LiveRegionMode.Polite },
        color = MaterialTheme.colorScheme.error,
        style = MaterialTheme.typography.bodyMedium,
    )
}

internal fun String.labelCase() = replaceFirstChar { it.uppercase() }

private const val READS_MATERIAL_STEP = "readExamNotice"
