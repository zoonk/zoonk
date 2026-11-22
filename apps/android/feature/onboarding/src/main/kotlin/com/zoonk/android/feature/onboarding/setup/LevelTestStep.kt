package com.zoonk.android.feature.onboarding.setup

import android.app.LocaleConfig
import android.app.LocaleManager
import android.os.Build
import android.os.LocaleList
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
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
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.data.GenerationKind
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.audio.SpeechFailedNote
import com.zoonk.android.feature.audio.SpeechPlayer
import com.zoonk.android.feature.audio.SpeechState
import com.zoonk.android.feature.audio.SpeechStatusIcon
import com.zoonk.android.feature.audio.SpokenAudio
import com.zoonk.android.feature.audio.SpokenText
import com.zoonk.android.feature.audio.buttonIconSize
import com.zoonk.android.feature.audio.rememberSpokenAudio
import com.zoonk.android.feature.audio.speechActionLabel
import com.zoonk.android.feature.audio.withoutFailure
import com.zoonk.android.feature.focustest.Note
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.start.OnboardingHeading
import com.zoonk.android.feature.questions.Answer
import com.zoonk.android.feature.questions.Question
import com.zoonk.android.feature.questions.QuestionFormat
import com.zoonk.android.feature.questions.Select
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.ui.VisitOf
import com.zoonk.android.ui.components.ButtonIcon
import com.zoonk.android.ui.components.FilledIconButton
import com.zoonk.android.ui.components.GenerationWait
import com.zoonk.android.ui.components.MediaPending
import com.zoonk.android.ui.components.TextButton
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formattingLocale
import com.zoonk.android.ui.format.languageName
import com.zoonk.android.ui.theme.layoutEnd
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.LanguageLevelTest
import com.zoonk.api.models.LanguageLevelTestOneOf1LevelsInner
import com.zoonk.api.models.LanguageLevelTestOneOf1NextOneOfQuestion
import com.zoonk.api.models.LanguageLevelTestResult
import com.zoonk.api.models.LanguageLevelTestResultResult
import com.zoonk.api.models.TrueFalseLabels
import java.util.UUID
import androidx.compose.ui.text.intl.LocaleList as TextLocales

/** The app's speech player for listening questions; none in previews and tests, where the message shows as text. */
val LocalSetupSpeech = staticCompositionLocalOf<SpeechPlayer?> { null }

/**
 * An open level test ([attemptId]): leaving its wait goes back ([onLeave]), and its end shows
 * [finished]. In [onboarding], leaving skips the test and goes on with the setup.
 */
internal class PlanAttempt(
    val attemptId: UUID,
    val onLeave: () -> Unit,
    val leaving: Boolean,
    val onboarding: Boolean = false,
    val finished: @Composable ColumnScope.(LanguageLevelTestResult) -> Unit,
)

/** There's no way back during its questions; stopping closes the test and shows what it found. */
@Composable
internal fun ColumnScope.LevelTestSteps(
    goalId: String,
    targetLanguage: String,
    store: OnboardingStore,
    navigator: AppNavigator,
    onProgress: (Float?) -> Unit,
    plan: PlanAttempt,
    onReportSaveFailure: () -> Unit = {},
    onProgressLabel: (String?) -> Unit = {},
) {
    val vm = viewModel(key = "level-test:$goalId:${plan.attemptId}") { LevelTestViewModel(goalId, store, plan.attemptId) }
    VisitOf(vm.visit)
    val test by store.levelTest(goalId, plan.attemptId).collectShown()
    val phase = vm.phase(test)
    val hold =
        com.zoonk.android.feature.warmup
            .rememberReadyHold(phase != LevelTestPhase.Waiting)
    val shown = if (hold.holding) LevelTestPhase.Waiting else phase
    val poll = rememberPoll(active = phase == LevelTestPhase.Waiting && !vm.bank.isStopped) { vm.check() }
    val audioQuestion = (phase as? LevelTestPhase.Question)?.question?.takeIf { it.audioPending }?.id
    val audioPoll = rememberPoll(active = audioQuestion != null, key = audioQuestion) { vm.check() }
    val progress =
        when (phase) {
            is LevelTestPhase.Question -> phase.progress
            else -> null
        }
    val progressLabel =
        when (phase) {
            is LevelTestPhase.Question -> stringResource(R.string.onboarding_test_question_progress, phase.number, phase.total)
            else -> null
        }
    LaunchedEffect(progress, progressLabel) {
        onProgress(progress)
        onProgressLabel(progressLabel)
    }
    DisposableEffect(Unit) {
        onDispose {
            onProgress(null)
            onProgressLabel(null)
        }
    }

    when (shown) {
        LevelTestPhase.Loading -> {
            StepLoading()
        }

        LevelTestPhase.Waiting -> {
            val run = vm.bank.run().withPoll(poll.stopped)
            LevelTestWaiting(
                targetLanguage = targetLanguage,
                hold = hold,
                run = if (hold.holding) run.copy(status = GenerationRun.Status.Ready) else run,
                onRetry =
                    when {
                        poll.stopped -> poll::restart
                        run.status == GenerationRun.Status.Failed -> vm::retry
                        else -> null
                    },
                pending = plan.leaving,
                onSkip = plan.onLeave,
                skipLabel = stringResource(if (plan.onboarding) R.string.onboarding_language_test_skip else R.string.focustest_not_now),
                skipNote = stringResource(R.string.onboarding_language_test_skip_note).takeIf { plan.onboarding },
            )
        }

        is LevelTestPhase.Question -> {
            SetupContent {
                FinishFailed(vm.finishFailed)
                key(shown.question.id) {
                    val audioPending = audioPoll.status(audioQuestion != null) == PollStatus.Polling
                    TestQuestion(shown, targetLanguage, audioPending, vm, navigator, onReportSaveFailure)
                }
            }
        }

        LevelTestPhase.Done -> {
            val result = vm.result ?: test.value?.takeIf { plan.onboarding }?.savedResult(plan.attemptId)
            LaunchedEffect(Unit) {
                if (plan.onboarding && result == null && !vm.finishFailed) vm.finish()
            }
            when {
                result != null -> {
                    plan.finished(this, result)
                }

                plan.onboarding && !vm.finishFailed -> {
                    StepLoading()
                }

                else -> {
                    PlacementDone(
                        pending = vm.isSaving,
                        failed = vm.finishFailed,
                        action =
                            stringResource(
                                if (plan.onboarding) R.string.onboarding_continue else R.string.onboarding_placement_see_plan,
                            ),
                        onContinue = vm::finish,
                    )
                }
            }
        }
    }
}

private fun LanguageLevelTest.savedResult(attemptId: UUID): LanguageLevelTestResult? {
    val test = (this as? LanguageLevelTest.LanguageLevelTestOneOf1Value)?.value ?: return null
    val saved = test.result?.takeIf { it.attemptId == attemptId } ?: return null
    return LanguageLevelTestResult(
        levels = test.levels,
        result =
            LanguageLevelTestResultResult(
                attemptId = saved.attemptId,
                changeId = saved.changeId,
                finishedAt = saved.finishedAt,
                lessonsSkipped = saved.lessonsSkipped,
                levelsSkipped = saved.levelsSkipped.map { LanguageLevelTestResultResult.LevelsSkipped.valueOf(it.name) },
                ranges = saved.ranges,
                wholeCourseReady = saved.wholeCourseReady,
            ),
    )
}

@Composable
internal fun LevelTestLanguageNotes(
    language: String,
    showAlphabetNote: Boolean,
) {
    if (showAlphabetNote) Note(stringResource(R.string.onboarding_language_test_new_alphabet))
    InterfaceOffer(language)
}

/** Main switches the app to the learner's own language when it isn't showing in it; Android keeps an app's language from API 33. */
@Composable
private fun InterfaceOffer(language: String) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
    val context = LocalContext.current
    val own = formattingLocale(language)
    val supported = remember(context) { LocaleConfig(context).supportedLocales }
    val translated = supported != null && (0 until supported.size()).any { supported[it].language == own.language }
    if (!translated || own.language == currentLocale().language) return

    TextButton(
        onClick = { context.getSystemService(LocaleManager::class.java).applicationLocales = LocaleList(own) },
        modifier = Modifier.fillMaxWidth(),
    ) {
        Text(stringResource(R.string.onboarding_language_test_use_app_in, languageName(language, own)))
    }
}

@Composable
private fun ColumnScope.LevelTestWaiting(
    targetLanguage: String,
    hold: com.zoonk.android.feature.warmup.ReadyHold,
    run: GenerationRun,
    onRetry: (() -> Unit)?,
    pending: Boolean,
    onSkip: () -> Unit,
    skipLabel: String,
    skipNote: String?,
) {
    val title = stringResource(if (hold.holding) R.string.warm_up_questions_ready else R.string.onboarding_language_test_preparing_title)
    SetupWait(
        run,
        GenerationKind.LevelTestBank,
        com.zoonk.android.data.AnalyticsEvent.WarmUpSurface.PlacementWait,
        title,
        hold,
        stringResource(R.string.onboarding_continue),
        onRetry,
        skip = {
            TextButton(
                busy = pending,
                onClick = onSkip,
                modifier = Modifier.fillMaxWidth(),
                leadingIcon = if (skipNote != null) ({ ButtonIcon(R.drawable.ic_skip_next) }) else null,
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
        },
    ) { share ->
        GenerationWait(GenerationKind.LevelTestBank, run, onRetry, share = share) {
            OnboardingHeading(
                title,
                stringResource(R.string.onboarding_language_test_preparing_description, languageName(targetLanguage, currentLocale())),
            )
        }
    }
}

/**
 * Reading questions show their passage; listening ones play it as a voice message. While the
 * message can't play, its question is skipped instead, which doesn't count toward a level.
 */
@Composable
private fun ColumnScope.TestQuestion(
    shown: LevelTestPhase.Question,
    targetLanguage: String,
    audioPending: Boolean,
    vm: LevelTestViewModel,
    navigator: AppNavigator,
    onReportSaveFailure: () -> Unit,
) {
    val question = shown.question
    val listening = question.skill == LanguageLevelTestOneOf1NextOneOfQuestion.Skill.LISTENING
    val audio = LocalSetupSpeech.current?.let { rememberSpokenAudio(it, targetLanguage) }
    val noAudio = listening && (audioPending || audio?.state is SpeechState.Failed)
    PlacementQuestion(
        item =
            Question(
                itemId = question.id,
                format = QuestionFormat.MultipleChoice,
                question = question.question,
                options = question.options,
                select = Select.All.takeIf { shown.confirmation },
                context = question.passage.takeUnless { listening },
            ),
        eyebrow = null,
        labels = TrueFalseLabels.TRUE_FALSE,
        pending = vm.isSaving,
        saveFailures = vm.saveFailures,
        onReportSaveFailure = onReportSaveFailure,
        onAnswer = { answer, durationMs -> vm.answer(question.id, answer, durationMs, skipped = noAudio && answer == Answer.DontKnow) },
        onStop = vm::stop,
        canStop = shown.number > 1,
        dontKnowLabel =
            stringResource(
                when {
                    noAudio -> R.string.onboarding_language_test_skip_question
                    listening -> R.string.onboarding_language_test_did_not_understand
                    else -> R.string.onboarding_placement_dont_know
                },
            ),
        media = { if (listening) ListeningMessage(question, targetLanguage, audioPending, audio, navigator) },
    )
}

/**
 * Read a little slower than normal, so the test isn't one of catching fast speech. A stored
 * recording plays as it is; without one, the learner's tap asks for it.
 */
@Composable
private fun ListeningMessage(
    question: LevelTestQuestion,
    language: String,
    pending: Boolean,
    audio: SpokenAudio?,
    navigator: AppNavigator,
) {
    if (audio == null) {
        Text(question.passage, style = MaterialTheme.typography.bodyLarge.copy(localeList = TextLocales(language)))
        return
    }
    if (pending) {
        MediaPending(Modifier.fillMaxWidth().heightIn(min = MESSAGE_MIN_HEIGHT)) {
            Icon(
                painterResource(R.drawable.ic_headphones),
                contentDescription = null,
                modifier = Modifier.size(20.dp * LocalDensity.current.fontScale),
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                stringResource(R.string.onboarding_language_test_audio_on_its_way),
                modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
        return
    }
    var played by rememberSaveable { mutableStateOf(false) }
    val state = audio.state.withoutFailure()
    val label =
        speechActionLabel(
            state,
            stringResource(if (played) R.string.onboarding_language_test_play_again else R.string.onboarding_language_test_play),
        )
    val play = {
        played = true
        audio.speak(listOf(SpokenText(question.passage, recording = question.audio?.url?.toString())), rate = LISTENING_RATE)
    }

    OutlinedCard(Modifier.fillMaxWidth()) {
        Column(
            Modifier.heightIn(min = MESSAGE_MIN_HEIGHT).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterVertically),
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                FilledIconButton(
                    onClick = { if (audio.isBusy) audio.cancel() else play() },
                    modifier = Modifier.semantics { contentDescription = label },
                ) {
                    SpeechStatusIcon(state) {
                        Icon(
                            painterResource(R.drawable.ic_play_arrow),
                            contentDescription = null,
                            modifier = Modifier.size(buttonIconSize()),
                        )
                    }
                }
                Row(
                    modifier = Modifier.weight(1f).semantics { liveRegion = LiveRegionMode.Polite },
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Icon(
                        painterResource(R.drawable.ic_headphones),
                        contentDescription = null,
                        modifier = Modifier.padding(top = 2.dp).size(16.dp * LocalDensity.current.fontScale),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Text(
                        stringResource(
                            if (state == SpeechState.Loading) {
                                R.string.onboarding_language_test_message_loading
                            } else {
                                R.string.onboarding_language_test_message
                            },
                        ),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
            }
            (audio.state as? SpeechState.Failed)?.let { failed ->
                SpeechFailedNote(language, failed.limit, onRetry = play, navigator = navigator)
            }
        }
    }
}

/** A skill's row: its name, its level's bar and its level. */
internal class LevelRow(
    val name: String,
    val label: String,
    val bar: @Composable (Modifier) -> Unit,
)

/** The names and levels take their widest one's width, so every bar starts and ends together. */
@Composable
internal fun LevelRows(levels: List<LevelRow>) {
    val names = levels.map { it.name }
    val labels = levels.map { it.label }
    val nameStyle = MaterialTheme.typography.labelLarge
    val labelStyle = MaterialTheme.typography.labelMedium.withTabularFigures()
    val measurer = rememberTextMeasurer()
    val density = LocalDensity.current
    val nameWidth = with(density) { names.maxOf { measurer.measure(it, nameStyle).size.width }.toDp() }
    val labelWidth = with(density) { labels.maxOf { measurer.measure(it, labelStyle).size.width }.toDp() }

    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val nameColumn = nameWidth.coerceAtMost(maxWidth * NAME_SHARE_LIMIT)
        Column {
            levels.forEachIndexed { index, level ->
                if (index > 0) HorizontalDivider()
                Row(
                    modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp).semantics(mergeDescendants = true) {},
                    horizontalArrangement = Arrangement.spacedBy(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(names[index], modifier = Modifier.width(nameColumn), style = nameStyle)
                    level.bar(Modifier.weight(1f))
                    Text(labels[index], modifier = Modifier.width(labelWidth), style = labelStyle, textAlign = layoutEnd())
                }
            }
        }
    }
}

@Composable
internal fun skillName(skill: LanguageLevelTestOneOf1LevelsInner.Skill): String =
    stringResource(
        when (skill) {
            LanguageLevelTestOneOf1LevelsInner.Skill.READING -> R.string.onboarding_language_test_reading
            LanguageLevelTestOneOf1LevelsInner.Skill.LISTENING -> R.string.onboarding_language_test_listening
            LanguageLevelTestOneOf1LevelsInner.Skill.SPEAKING -> R.string.onboarding_language_test_speaking
            LanguageLevelTestOneOf1LevelsInner.Skill.WRITING -> R.string.onboarding_language_test_writing
        },
    )

private const val LISTENING_RATE = 0.9f

/** The ready message's height, so Play replaces the on-its-way panel without moving the question. */
private val MESSAGE_MIN_HEIGHT = 80.dp
private const val NAME_SHARE_LIMIT = 0.4f
