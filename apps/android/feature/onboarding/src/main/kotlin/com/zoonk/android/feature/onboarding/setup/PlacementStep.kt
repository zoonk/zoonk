package com.zoonk.android.feature.onboarding.setup

import android.os.SystemClock
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.ButtonDefaults
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
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.dp
import androidx.lifecycle.createSavedStateHandle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.data.AnalyticsEvent
import com.zoonk.android.data.GenerationKind
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.recode
import com.zoonk.android.feature.audio.buttonIconSize
import com.zoonk.android.feature.mock.MockStore
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.start.OnboardingActions
import com.zoonk.android.feature.onboarding.start.OnboardingHeading
import com.zoonk.android.feature.warmup.ReadyHold
import com.zoonk.android.feature.warmup.rememberReadyHold
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.AnswerOption
import com.zoonk.android.ui.components.AnswerOptionGroup
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.ButtonIcon
import com.zoonk.android.ui.components.Eyebrow
import com.zoonk.android.ui.components.GenerationWait
import com.zoonk.android.ui.components.KindDot
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.LabelChip
import com.zoonk.android.ui.components.LearnKind
import com.zoonk.android.ui.components.LessonVisual
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.OutlinedTextField
import com.zoonk.android.ui.components.PictureFrame
import com.zoonk.android.ui.components.PrivatePicture
import com.zoonk.android.ui.components.SuccessEyebrow
import com.zoonk.android.ui.components.TextButton
import com.zoonk.android.ui.components.bleed
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.factsLine
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.richtext.RichInlineText
import com.zoonk.android.ui.richtext.RichText
import com.zoonk.android.ui.theme.zoonkType
import com.zoonk.api.models.ChoiceAnswer
import com.zoonk.api.models.ChoiceAnswerAnyOf
import com.zoonk.api.models.ChoiceAnswerAnyOf2
import com.zoonk.api.models.ChoiceAnswerAnyOf3
import com.zoonk.api.models.PlacementAnswer
import com.zoonk.api.models.PlacementAnswerAnyOf
import com.zoonk.api.models.TrueFalseLabels
import kotlinx.coroutines.delay
import java.util.UUID
import kotlin.math.max
import kotlin.time.Duration.Companion.seconds
import com.zoonk.api.models.LessonVisual as ApiLessonVisual

/** A language goal with a target language takes its level test instead, which its caller picks before this. */
@Composable
internal fun ColumnScope.PlacementStep(
    goalId: String,
    subject: String,
    areaCount: Int,
    run: GenerationRun,
    onRetryRun: (() -> Unit)?,
    store: OnboardingStore,
    mocks: MockStore,
    navigator: AppNavigator,
    onProgress: (Float?) -> Unit,
    onDone: () -> Unit,
) {
    val drafts = LocalSetupDrafts.current
    val vm = viewModel(key = "placement:$goalId") { PlacementViewModel(goalId, store, drafts, createSavedStateHandle()) }
    val resource = store.placements[goalId]
    val placement by resource.collectShown()
    val options by mocks.options[UUID.fromString(goalId)].collectShown()
    val phase = vm.phase(placement, options)
    val poll = rememberPoll(active = phase == PlacementPhase.Waiting && !run.isStopped) { vm.check() }
    val hold = rememberReadyHold(ready = phase != PlacementPhase.Waiting)
    val shown = if (hold.over) phase else PlacementPhase.Waiting
    val finish = { fromScratch: Boolean -> vm.finish(fromScratch, onDone = onDone) }
    val progress = (shown as? PlacementPhase.Question)?.spent?.toFloat()
    LaunchedEffect(progress) { onProgress(progress) }
    DisposableEffect(Unit) { onDispose { onProgress(null) } }

    when (shown) {
        PlacementPhase.Loading -> {
            StepLoading()
        }

        is PlacementPhase.Intro -> {
            PlacementIntro(
                subject = subject,
                areaCount = areaCount,
                mock = shown.mock,
                pending = vm.isSaving,
                starting = vm.isStarting,
                failed = vm.finishFailed,
                onMock = { navigator.open(AppRoute.PlacementMock(goalId)) },
                onStart = vm::start,
                onScratch = { finish(true) },
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
            PlacementOutcome(
                eyebrow = null,
                title = stringResource(R.string.onboarding_placement_unavailable_title),
                description = stringResource(R.string.onboarding_placement_unavailable_description),
                pending = vm.isSaving,
                failed = vm.finishFailed,
                onContinue = { finish(false) },
            )
        }

        is PlacementPhase.Question -> {
            key(shown.item.itemId) {
                PlacementQuestion(
                    item = shown.item,
                    eyebrow = factsLine(subject.labelCase(), stringResource(R.string.onboarding_placement_question_number, shown.number)),
                    labels = shown.labels,
                    typedWords = rememberUnsentWords(goalId, typedDraftStep(shown.item.itemId), count = 1),
                    pending = vm.isSaving,
                    answerFailed = vm.answerFailed,
                    finishFailed = vm.finishFailed,
                    onAnswer = { answer, durationMs -> vm.answer(shown, answer, durationMs) },
                    onRetry = vm::retryAnswer,
                    onStop = { finish(false) },
                )
            }
        }

        is PlacementPhase.MockRunning -> {
            PlacementMockRunning(
                pending = vm.isSaving,
                failed = vm.finishFailed,
                onContinue = { navigator.open(AppRoute.Mock(shown.mockId)) },
                onStop = { vm.finish(fromScratch = false, stopMockId = shown.mockId, onDone = onDone) },
            )
        }

        is PlacementPhase.Done -> {
            PlacementDone(shown, pending = vm.isSaving, failed = vm.finishFailed, onContinue = { finish(false) })
        }
    }
}

@Composable
internal fun ColumnScope.StepLoading() {
    Box(Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
}

@Composable
private fun ColumnScope.PlacementIntro(
    subject: String,
    areaCount: Int,
    mock: MockOffer?,
    pending: Boolean,
    starting: Boolean,
    failed: Boolean,
    onMock: () -> Unit,
    onStart: () -> Unit,
    onScratch: () -> Unit,
) {
    Eyebrow(subject.labelCase())
    OnboardingHeading(
        stringResource(R.string.onboarding_placement_title),
        if (areaCount > 0) {
            pluralStringResource(R.plurals.onboarding_placement_description_areas, areaCount, areaCount)
        } else {
            stringResource(R.string.onboarding_placement_description)
        },
    )
    mock?.let { MockOfferRow(it, onMock) }
    OnboardingActions {
        FinishFailed(failed)
        Button(
            busy = starting,
            onClick = onStart,
            modifier = Modifier.fillMaxWidth(),
            enabled = !pending,
            leadingIcon = { ButtonIcon(R.drawable.ic_play_arrow) },
        ) {
            Text(stringResource(R.string.onboarding_placement_start))
        }
        TextButton(
            busy = pending,
            onClick = onScratch,
            modifier = Modifier.fillMaxWidth(),
            enabled = !starting,
            leadingIcon = { ButtonIcon(R.drawable.ic_skip_next) },
        ) {
            Text(stringResource(R.string.onboarding_placement_skip_basics))
        }
    }
}

@Composable
private fun MockOfferRow(
    mock: MockOffer,
    onClick: () -> Unit,
) {
    val locale = currentLocale()
    val longest = formatMinutes(mock.longestMinutes.toInt(), locale)
    val description =
        if (mock.longestMinutes == mock.shortestMinutes) {
            stringResource(R.string.onboarding_placement_mock_about, longest)
        } else {
            stringResource(R.string.onboarding_placement_mock_range, formatMinutes(mock.shortestMinutes.toInt(), locale), longest)
        }
    val plus = stringResource(R.string.onboarding_placement_plus_description)

    ListRow(
        headline = { Text(stringResource(R.string.onboarding_placement_mock_title)) },
        modifier = Modifier.bleed(LIST_ITEM_INSET),
        onClick = onClick,
        leading = { KindDot(LearnKind.Mock) },
        supporting = { Text(description) },
        meta =
            if (mock.plusRequired) {
                {
                    LabelChip(
                        stringResource(R.string.onboarding_placement_plus),
                        Modifier.clearAndSetSemantics { contentDescription = plus },
                    )
                }
            } else {
                null
            },
    )
}

@Composable
private fun ColumnScope.PlacementWaiting(
    run: GenerationRun,
    onRetry: (() -> Unit)?,
    hold: ReadyHold,
    pending: Boolean,
    failed: Boolean,
    onSkip: () -> Unit,
) {
    var patient by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        delay(PATIENCE)
        patient = true
    }

    Column(verticalArrangement = Arrangement.spacedBy(24.dp)) {
        GenerationWait(
            kind = GenerationKind.Placement,
            run = if (hold.holding) run.copy(status = GenerationRun.Status.Ready, failure = null) else run,
            onRetry = onRetry,
        ) {
            OnboardingHeading(
                stringResource(if (hold.holding) R.string.warm_up_questions_ready else R.string.onboarding_placement_waiting_title),
                stringResource(
                    when {
                        hold.holding -> R.string.warm_up_questions_ready_description

                        // The learner's own material is read in the `readExamNotice` step.
                        READS_MATERIAL_STEP in run.steps -> R.string.onboarding_placement_waiting_material

                        else -> R.string.onboarding_placement_waiting_skills
                    },
                ),
            )
        }
        SetupWarmUpCard(run.warmUpId, AnalyticsEvent.WarmUpSurface.PlacementWait, hold)
    }
    PageHold(hold, stringResource(R.string.onboarding_continue))

    if (!hold.holding && (patient || run.status == GenerationRun.Status.Failed)) {
        OnboardingActions {
            FinishFailed(failed)
            TextButton(
                busy = pending,
                onClick = onSkip,
                modifier = Modifier.fillMaxWidth(),
                leadingIcon = { ButtonIcon(R.drawable.ic_skip_next) },
            ) {
                Text(stringResource(R.string.onboarding_placement_skip_for_now))
            }
            Text(
                text = stringResource(R.string.onboarding_placement_skip_note),
                modifier = Modifier.fillMaxWidth(),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
    }
}

private class Choice(
    val label: String,
    val answer: PlacementAnswer,
    /** Option text can hold emphasis and math; true and false are plain words. */
    val rich: Boolean,
)

/** Shared with the language level test; only a typed question needs [typedWords]. */
@Composable
internal fun ColumnScope.PlacementQuestion(
    item: PlacementItem,
    eyebrow: String?,
    labels: TrueFalseLabels,
    typedWords: UnsentWords?,
    pending: Boolean,
    answerFailed: Boolean,
    finishFailed: Boolean,
    onAnswer: (PlacementAnswer, Long) -> Unit,
    onRetry: () -> Unit,
    onStop: () -> Unit,
    dontKnowLabel: String = stringResource(R.string.onboarding_placement_dont_know),
    media: @Composable () -> Unit = {},
) {
    val choices = choices(item.format, labels)
    var picked by rememberSaveable { mutableStateOf<Int?>(null) }
    val typed = typedWords?.values?.first().orEmpty()
    var sent by rememberSaveable { mutableStateOf(false) }
    val shownAt = remember { SystemClock.elapsedRealtime() }
    val answer: PlacementAnswer? =
        if (item.format == PlacementFormat.Typed) {
            typed.trim().takeIf(String::isNotEmpty)?.let { PlacementAnswer.PlacementAnswerAnyOfValue(PlacementAnswerAnyOf(it)) }
        } else {
            picked?.let { choices.getOrNull(it)?.answer }
        }
    val send = { chosen: PlacementAnswer ->
        if (!pending) {
            sent = true
            onAnswer(chosen, SystemClock.elapsedRealtime() - shownAt)
        }
    }
    val confirm = { answer?.let(send) }
    val visual = remember(item.visual) { item.visual?.recode<ApiLessonVisual, LessonVisual>() }

    QuestionPages(
        read = {
            eyebrow?.let { Eyebrow(it) }
            media()
            item.context?.let { RichText(it, style = MaterialTheme.typography.bodyLarge) }
            item.image?.let { PrivatePicture(it.url, it.alt, it.width, it.height, PictureFrame.Question) }
            visual?.let { LessonVisual(it) }
            RichText(item.question, modifier = Modifier.semantics { heading() }, style = MaterialTheme.zoonkType.question)
        },
        answer = {
            if (item.format == PlacementFormat.Typed) {
                val typedFocus = remember { FocusRequester() }
                LaunchedEffect(Unit) { typedFocus.requestFocus() }
                OutlinedTextField(
                    value = typed,
                    onValueChange = { typedWords?.set(0, it.take(MAX_TYPED_ANSWER)) },
                    modifier = Modifier.fillMaxWidth().focusRequester(typedFocus),
                    label = stringResource(R.string.onboarding_placement_your_answer),
                    minLines = 3,
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                    keyboardActions = KeyboardActions(onSend = { confirm() }),
                )
            } else {
                AnswerList(choices, picked, onPick = { picked = it })
            }
        },
    ) {
        if (answerFailed && sent && !pending) {
            Column(Modifier.semantics { liveRegion = LiveRegionMode.Polite }) {
                Text(
                    stringResource(R.string.onboarding_placement_answer_failed),
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodyMedium,
                )
                TextButton(onClick = onRetry) { Text(stringResource(R.string.onboarding_placement_try_again)) }
            }
        }
        FinishFailed(finishFailed)
        BesideOrAbove(
            start = {
                OutlinedButton(
                    onClick = { send(DONT_KNOW) },
                    enabled = !pending,
                    contentPadding = ButtonDefaults.ButtonWithIconContentPadding,
                ) {
                    Icon(painterResource(R.drawable.ic_help), contentDescription = null, modifier = Modifier.size(buttonIconSize()))
                    Text(dontKnowLabel, modifier = Modifier.padding(start = ButtonDefaults.IconSpacing))
                }
            },
            end = {
                Button(onClick = { confirm() }, enabled = answer != null && !pending) {
                    Text(stringResource(R.string.onboarding_placement_confirm))
                }
            },
        )
        TextButton(onClick = onStop, enabled = !pending, modifier = Modifier.fillMaxWidth()) {
            Text(stringResource(R.string.onboarding_placement_stop))
        }
    }
}

/** [end] moves above [start] when [start] can't fit on one line beside it, so no label breaks mid-word. */
@Composable
private fun BesideOrAbove(
    start: @Composable () -> Unit,
    end: @Composable () -> Unit,
) {
    Layout(contents = listOf(start, end)) { (starts, ends), constraints ->
        val gap = ACTION_GAP.roundToPx()
        val width = constraints.maxWidth
        val startWidth = starts.first().maxIntrinsicWidth(constraints.maxHeight)
        val beside = startWidth + gap + END_MIN_WIDTH.roundToPx() <= width
        val startPlaceable = starts.first().measure(Constraints.fixedWidth(if (beside) startWidth else width))
        val endPlaceable = ends.first().measure(Constraints.fixedWidth(if (beside) width - gap - startWidth else width))

        if (beside) {
            val height = max(startPlaceable.height, endPlaceable.height)
            layout(width, height) {
                startPlaceable.placeRelative(0, (height - startPlaceable.height) / 2)
                endPlaceable.placeRelative(startWidth + gap, (height - endPlaceable.height) / 2)
            }
        } else {
            layout(width, endPlaceable.height + gap + startPlaceable.height) {
                endPlaceable.placeRelative(0, 0)
                startPlaceable.placeRelative(0, endPlaceable.height + gap)
            }
        }
    }
}

@Composable
private fun choices(
    format: PlacementFormat,
    labels: TrueFalseLabels,
): List<Choice> =
    when (format) {
        is PlacementFormat.Choice -> {
            format.options.mapIndexed { index, option ->
                Choice(
                    option,
                    PlacementAnswer.ChoiceAnswerValue(ChoiceAnswer.ChoiceAnswerAnyOfValue(ChoiceAnswerAnyOf(index.toLong()))),
                    rich = true,
                )
            }
        }

        PlacementFormat.TrueFalse -> {
            val rightWrong = labels == TrueFalseLabels.RIGHT_WRONG
            listOf(true, false).map { isTrue ->
                val label =
                    when {
                        rightWrong && isTrue -> R.string.onboarding_placement_right
                        rightWrong -> R.string.onboarding_placement_wrong
                        isTrue -> R.string.onboarding_placement_true
                        else -> R.string.onboarding_placement_false
                    }
                Choice(
                    stringResource(label),
                    PlacementAnswer.ChoiceAnswerValue(ChoiceAnswer.ChoiceAnswerAnyOf2Value(ChoiceAnswerAnyOf2(isTrue))),
                    rich = false,
                )
            }
        }

        PlacementFormat.Typed -> {
            emptyList()
        }
    }

@Composable
private fun AnswerList(
    choices: List<Choice>,
    picked: Int?,
    onPick: (Int) -> Unit,
) {
    AnswerOptionGroup {
        choices.forEachIndexed { index, choice ->
            AnswerOption(marker = index + 1, picked = picked == index, result = null, onClick = { onPick(index) }) {
                if (choice.rich) {
                    RichInlineText(choice.label, style = MaterialTheme.typography.bodyLarge)
                } else {
                    Text(choice.label, style = MaterialTheme.typography.bodyLarge)
                }
            }
        }
    }
}

@Composable
private fun ColumnScope.PlacementDone(
    done: PlacementPhase.Done,
    pending: Boolean,
    failed: Boolean,
    onContinue: () -> Unit,
) {
    when {
        done.fromMock -> {
            PlacementOutcome(
                eyebrow = stringResource(R.string.onboarding_placement_mock_done),
                title = stringResource(R.string.onboarding_placement_mock_set_title),
                description = pluralStringResource(R.plurals.onboarding_placement_mock_set_description, done.answered, done.answered),
                pending = pending,
                failed = failed,
                onContinue = onContinue,
            )
        }

        done.forToday -> {
            PlacementOutcome(
                eyebrow = pluralStringResource(R.plurals.onboarding_placement_answered, done.answered, done.answered),
                title = stringResource(R.string.onboarding_placement_enough_title),
                description = stringResource(R.string.onboarding_placement_enough_description),
                pending = pending,
                failed = failed,
                onContinue = onContinue,
            )
        }

        else -> {
            PlacementOutcome(
                eyebrow = pluralStringResource(R.plurals.onboarding_placement_answered, done.answered, done.answered),
                title = stringResource(R.string.onboarding_placement_set_title),
                description = stringResource(R.string.onboarding_placement_set_description),
                pending = pending,
                failed = failed,
                onContinue = onContinue,
            )
        }
    }
}

@Composable
private fun ColumnScope.PlacementOutcome(
    eyebrow: String?,
    title: String,
    description: String,
    pending: Boolean,
    failed: Boolean,
    onContinue: () -> Unit,
) {
    eyebrow?.let { SuccessEyebrow(it) }
    OnboardingHeading(title, description)
    OnboardingActions {
        FinishFailed(failed)
        Button(
            busy = pending,
            onClick = onContinue,
            modifier = Modifier.fillMaxWidth(),
            trailingIcon = { ButtonIcon(R.drawable.ic_arrow_forward) },
        ) {
            Text(stringResource(R.string.onboarding_placement_see_plan))
        }
    }
}

@Composable
private fun ColumnScope.PlacementMockRunning(
    pending: Boolean,
    failed: Boolean,
    onContinue: () -> Unit,
    onStop: () -> Unit,
) {
    OnboardingHeading(
        stringResource(R.string.onboarding_placement_mock_waiting_title),
        stringResource(R.string.onboarding_placement_mock_waiting_description),
    )
    OnboardingActions {
        FinishFailed(failed)
        Button(onClick = onContinue, modifier = Modifier.fillMaxWidth()) {
            Text(stringResource(R.string.onboarding_placement_continue_mock))
        }
        TextButton(
            busy = pending,
            onClick = onStop,
            modifier = Modifier.fillMaxWidth(),
            leadingIcon = { ButtonIcon(R.drawable.ic_stop_circle) },
        ) {
            Text(stringResource(R.string.onboarding_placement_stop_mock))
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

private fun String.labelCase() = replaceFirstChar { it.uppercase() }

private val DONT_KNOW = PlacementAnswer.ChoiceAnswerValue(ChoiceAnswer.ChoiceAnswerAnyOf3Value(ChoiceAnswerAnyOf3(dontKnow = true)))
private val PATIENCE = 20.seconds
private const val MAX_TYPED_ANSWER = 1000
private const val READS_MATERIAL_STEP = "readExamNotice"

private val ACTION_GAP = 8.dp
private val END_MIN_WIDTH = 160.dp
