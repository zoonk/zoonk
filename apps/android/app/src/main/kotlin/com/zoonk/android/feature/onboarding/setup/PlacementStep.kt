package com.zoonk.android.feature.onboarding.setup

import android.os.SystemClock
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.createSavedStateHandle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.data.GenerationKind
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.recode
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.start.OnboardingActions
import com.zoonk.android.feature.onboarding.start.OnboardingHeading
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.AnswerOption
import com.zoonk.android.ui.components.AnswerOptionGroup
import com.zoonk.android.ui.components.DoneMark
import com.zoonk.android.ui.components.GenerationWait
import com.zoonk.android.ui.components.KindDot
import com.zoonk.android.ui.components.LabelChip
import com.zoonk.android.ui.components.LearnKind
import com.zoonk.android.ui.components.LessonVisual
import com.zoonk.android.ui.components.Meter
import com.zoonk.android.ui.components.PictureFrame
import com.zoonk.android.ui.components.PrivatePicture
import com.zoonk.android.ui.components.answerTone
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.richtext.RichInlineText
import com.zoonk.android.ui.richtext.RichText
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.ChoiceAnswer
import com.zoonk.api.models.ChoiceAnswerAnyOf
import com.zoonk.api.models.ChoiceAnswerAnyOf2
import com.zoonk.api.models.ChoiceAnswerAnyOf3
import com.zoonk.api.models.PlacementAnswer
import com.zoonk.api.models.PlacementAnswerAnyOf
import com.zoonk.api.models.TrueFalseLabels
import kotlinx.coroutines.delay
import kotlin.time.Duration.Companion.seconds
import com.zoonk.api.models.LessonVisual as ApiLessonVisual

/**
 * Main's `PlacementStep`: a few questions that find where the plan starts, or a mock exam in their
 * place. A language goal with a target language takes its level test instead (F48), which its
 * caller picks before this.
 */
@Composable
internal fun ColumnScope.PlacementStep(
    goalId: String,
    subject: String,
    areaCount: Int,
    run: GenerationRun,
    onRetryRun: (() -> Unit)?,
    store: OnboardingStore,
    navigator: AppNavigator,
    onProgress: (Float?) -> Unit,
    onDone: () -> Unit,
) {
    val drafts = LocalSetupDrafts.current
    val vm = viewModel(key = "placement:$goalId") { PlacementViewModel(goalId, store, drafts, createSavedStateHandle()) }
    val resource = store.placements[goalId]
    val placement by resource.collectShown()
    val mocks by store.placementMocks[goalId].collectShown()
    val phase = vm.phase(placement, mocks)
    val poll = rememberPoll(active = phase == PlacementPhase.Waiting && !run.isStopped) { resource.refreshed() }
    val finish = { fromScratch: Boolean -> vm.finish(fromScratch, onDone = onDone) }
    val progress = (phase as? PlacementPhase.Question)?.spent?.toFloat()
    LaunchedEffect(progress) { onProgress(progress) }
    DisposableEffect(Unit) { onDispose { onProgress(null) } }

    when (phase) {
        PlacementPhase.Loading -> {
            StepLoading()
        }

        is PlacementPhase.Intro -> {
            PlacementIntro(
                subject = subject,
                areaCount = areaCount,
                mock = phase.mock,
                pending = vm.isSaving,
                failed = vm.finishFailed,
                onMock = { navigator.open(AppRoute.PlacementMock(goalId)) },
                onStart = vm::start,
                onScratch = { finish(true) },
            )
        }

        PlacementPhase.Waiting -> {
            PlacementWaiting(
                run = run.withPoll(poll),
                onRetry = if (poll.stopped) poll::restart else onRetryRun,
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
            key(phase.item.itemId) {
                PlacementQuestion(
                    question = phase,
                    typedWords = rememberUnsentWords(goalId, typedDraftStep(phase.item.itemId), count = 1),
                    subject = subject,
                    pending = vm.isSaving,
                    answerFailed = vm.answerFailed,
                    finishFailed = vm.finishFailed,
                    onAnswer = { answer, durationMs -> vm.answer(phase, answer, durationMs) },
                    onRetry = vm::retryAnswer,
                    onStop = { finish(false) },
                )
            }
        }

        is PlacementPhase.MockRunning -> {
            PlacementMockRunning(
                pending = vm.isSaving,
                failed = vm.finishFailed,
                onContinue = { navigator.open(AppRoute.Mock(phase.mockId)) },
                onStop = { vm.finish(fromScratch = false, stopMockId = phase.mockId, onDone = onDone) },
            )
        }

        is PlacementPhase.Done -> {
            PlacementDone(phase, pending = vm.isSaving, failed = vm.finishFailed, onContinue = { finish(false) })
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
        Button(onClick = onStart, enabled = !pending, modifier = Modifier.fillMaxWidth()) {
            Text(stringResource(R.string.onboarding_placement_start))
        }
        TextButton(onClick = onScratch, enabled = !pending, modifier = Modifier.fillMaxWidth()) {
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

    OutlinedCard(onClick = onClick, modifier = Modifier.fillMaxWidth()) {
        ListItem(
            headlineContent = { Text(stringResource(R.string.onboarding_placement_mock_title)) },
            supportingContent = { Text(description) },
            leadingContent = { KindDot(LearnKind.Mock) },
            trailingContent =
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
            colors = ListItemDefaults.colors(containerColor = Color.Transparent),
        )
    }
}

@Composable
private fun ColumnScope.PlacementWaiting(
    run: GenerationRun,
    onRetry: (() -> Unit)?,
    pending: Boolean,
    failed: Boolean,
    onSkip: () -> Unit,
) {
    var patient by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        delay(PATIENCE)
        patient = true
    }

    GenerationWait(kind = GenerationKind.Placement, run = run, onRetry = onRetry) {
        OnboardingHeading(
            stringResource(R.string.onboarding_placement_waiting_title),
            // The learner's own material is read in the `readExamNotice` step.
            stringResource(
                if (READS_MATERIAL_STEP in run.steps) {
                    R.string.onboarding_placement_waiting_material
                } else {
                    R.string.onboarding_placement_waiting_skills
                },
            ),
        )
    }

    if (patient || run.status == GenerationRun.Status.Failed) {
        OnboardingActions {
            FinishFailed(failed)
            TextButton(onClick = onSkip, enabled = !pending, modifier = Modifier.fillMaxWidth()) {
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

@Composable
private fun ColumnScope.PlacementQuestion(
    question: PlacementPhase.Question,
    typedWords: UnsentWords,
    subject: String,
    pending: Boolean,
    answerFailed: Boolean,
    finishFailed: Boolean,
    onAnswer: (PlacementAnswer, Long) -> Unit,
    onRetry: () -> Unit,
    onStop: () -> Unit,
) {
    val item = question.item
    val choices = choices(item.format, question.labels)
    var picked by rememberSaveable { mutableStateOf<Int?>(null) }
    var typed by typedWords.field(0)
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

    Eyebrow("${subject.labelCase()} · ${stringResource(R.string.onboarding_placement_question_number, question.number)}")
    item.context?.let {
        RichText(it, style = MaterialTheme.typography.bodyLarge.copy(color = MaterialTheme.colorScheme.onSurfaceVariant))
    }
    item.image?.let { PrivatePicture(it.url, it.alt, it.width, it.height, PictureFrame.Question) }
    val visual = remember(item.visual) { item.visual?.recode<ApiLessonVisual, LessonVisual>() }
    visual?.let { LessonVisual(it) }
    RichText(item.question, modifier = Modifier.semantics { heading() }, style = MaterialTheme.typography.titleLarge)

    if (item.format == PlacementFormat.Typed) {
        val typedFocus = remember { FocusRequester() }
        LaunchedEffect(Unit) { typedFocus.requestFocus() }
        OutlinedTextField(
            value = typed,
            onValueChange = { typed = it.take(MAX_TYPED_ANSWER) },
            modifier = Modifier.fillMaxWidth().focusRequester(typedFocus),
            label = { Text(stringResource(R.string.onboarding_placement_your_answer)) },
            minLines = 3,
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
            keyboardActions = KeyboardActions(onSend = { confirm() }),
        )
    } else {
        AnswerList(choices, picked, onPick = { picked = it })
    }

    OnboardingActions {
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
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(
                onClick = { send(DONT_KNOW) },
                enabled = !pending,
                modifier = Modifier.weight(1f),
                contentPadding = ButtonDefaults.ButtonWithIconContentPadding,
            ) {
                Icon(painterResource(R.drawable.ic_help), contentDescription = null, modifier = Modifier.size(ButtonDefaults.IconSize))
                Text(
                    stringResource(R.string.onboarding_placement_dont_know),
                    modifier = Modifier.padding(start = ButtonDefaults.IconSpacing),
                )
            }
            Button(onClick = { confirm() }, enabled = answer != null && !pending, modifier = Modifier.weight(CONFIRM_WEIGHT)) {
                Text(stringResource(R.string.onboarding_placement_confirm))
            }
        }
        TextButton(onClick = onStop, enabled = !pending, modifier = Modifier.fillMaxWidth()) {
            Text(stringResource(R.string.onboarding_placement_stop))
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
        Button(onClick = onContinue, enabled = !pending, modifier = Modifier.fillMaxWidth()) {
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
        TextButton(onClick = onStop, enabled = !pending, modifier = Modifier.fillMaxWidth()) {
            Text(stringResource(R.string.onboarding_placement_stop_mock))
        }
    }
}

@Composable
private fun FinishFailed(failed: Boolean) {
    if (!failed) return
    Text(
        text = stringResource(R.string.onboarding_save_failed),
        modifier = Modifier.fillMaxWidth().semantics { liveRegion = LiveRegionMode.Polite },
        color = MaterialTheme.colorScheme.error,
        style = MaterialTheme.typography.bodyMedium,
    )
}

/** Main's `OnboardingSubject`: what the screen is about, above its title. */
@Composable
internal fun Eyebrow(text: String) {
    Text(text = text, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelLarge)
}

@Composable
internal fun SuccessEyebrow(text: String) {
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
        DoneMark()
        Text(text = text, color = MaterialTheme.colorScheme.onTertiaryContainer, style = MaterialTheme.typography.titleSmall)
    }
}

private fun String.labelCase() = replaceFirstChar { it.uppercase() }

private val DONT_KNOW = PlacementAnswer.ChoiceAnswerValue(ChoiceAnswer.ChoiceAnswerAnyOf3Value(ChoiceAnswerAnyOf3(dontKnow = true)))
private val PATIENCE = 20.seconds
private const val MAX_TYPED_ANSWER = 1000
private const val READS_MATERIAL_STEP = "readExamNotice"

private const val CONFIRM_WEIGHT = 1.6f
