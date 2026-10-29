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
import androidx.compose.material3.Button
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.createSavedStateHandle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.data.GenerationKind
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.collectShown
import com.zoonk.android.feature.audio.SpeechFailedNote
import com.zoonk.android.feature.audio.SpeechPlayer
import com.zoonk.android.feature.audio.SpeechState
import com.zoonk.android.feature.audio.SpeechStatusIcon
import com.zoonk.android.feature.audio.SpokenText
import com.zoonk.android.feature.audio.VoiceAnswerModel
import com.zoonk.android.feature.audio.VoiceAnswerRecorder
import com.zoonk.android.feature.audio.buttonIconSize
import com.zoonk.android.feature.audio.rememberSpokenAudio
import com.zoonk.android.feature.audio.speechActionLabel
import com.zoonk.android.feature.audio.withoutFailure
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.start.OnboardingActions
import com.zoonk.android.feature.onboarding.start.OnboardingHeading
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.ui.components.GenerationWait
import com.zoonk.android.ui.components.LevelBar
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.ChoiceAnswer
import com.zoonk.api.models.LanguageLevelTestOneOf1LevelsInner
import com.zoonk.api.models.LanguageLevelTestOneOf1NextOneOfQuestion
import com.zoonk.api.models.PlacementAnswer
import com.zoonk.api.models.TrueFalseLabels
import java.util.Locale
import androidx.compose.ui.text.intl.LocaleList as TextLocales

/** The app's speech player for listening questions; none in previews and tests, where the message shows as text. */
internal val LocalSetupSpeech = staticCompositionLocalOf<SpeechPlayer?> { null }

/** [language] is the learner's own. There's no way back during its questions; stopping shows the levels so far. */
@Composable
internal fun ColumnScope.LanguageLevelTestStep(
    goalId: String,
    language: String,
    targetLanguage: String,
    store: OnboardingStore,
    navigator: AppNavigator,
    onProgress: (Float?) -> Unit,
    onDone: () -> Unit,
) {
    val vm = viewModel(key = "level-test:$goalId") { LevelTestViewModel(goalId, store, createSavedStateHandle()) }
    val test by store.levelTests[goalId].collectShown()
    val phase = vm.phase(test)
    val poll = rememberPoll(active = phase == LevelTestPhase.Waiting && !vm.bank.isStopped) { vm.check() }
    val progress =
        when (phase) {
            is LevelTestPhase.Question -> phase.progress
            is LevelTestPhase.Speaking -> phase.progress
            else -> null
        }
    LaunchedEffect(progress) { onProgress(progress) }
    DisposableEffect(Unit) { onDispose { onProgress(null) } }
    val finish = { vm.finish(onDone) }

    when (phase) {
        LevelTestPhase.Loading -> {
            StepLoading()
        }

        LevelTestPhase.Intro -> {
            LevelTestIntro(language, targetLanguage, pending = vm.isSaving, failed = vm.finishFailed, onStart = vm::begin, onSkip = finish)
        }

        LevelTestPhase.Waiting -> {
            val run = vm.bank.run().withPoll(poll)
            LevelTestWaiting(
                targetLanguage = targetLanguage,
                run = run,
                onRetry =
                    when {
                        poll.stopped -> poll::restart
                        run.status == GenerationRun.Status.Failed -> vm::begin
                        else -> null
                    },
                pending = vm.isSaving,
                failed = vm.finishFailed,
                onSkip = finish,
            )
        }

        is LevelTestPhase.Question -> {
            key(phase.question.id) {
                TestQuestion(phase.question, targetLanguage, vm, navigator)
            }
        }

        is LevelTestPhase.Speaking -> {
            LevelTestSpeaking(phase.sentence, targetLanguage, goalId, store, navigator, onSkip = vm::stop)
        }

        is LevelTestPhase.Done -> {
            LevelTestDone(phase.levels, pending = vm.isSaving, failed = vm.finishFailed, onContinue = finish)
        }
    }
}

@Composable
private fun ColumnScope.LevelTestIntro(
    language: String,
    targetLanguage: String,
    pending: Boolean,
    failed: Boolean,
    onStart: () -> Unit,
    onSkip: () -> Unit,
) {
    OnboardingHeading(
        stringResource(R.string.onboarding_language_test_title, languageName(targetLanguage, currentLocale())),
        stringResource(R.string.onboarding_language_test_description),
    )
    if (usesNonLatinScript(targetLanguage)) {
        Text(
            stringResource(R.string.onboarding_language_test_new_alphabet),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
    }
    OnboardingActions {
        FinishFailed(failed)
        Button(onClick = onStart, enabled = !pending, modifier = Modifier.fillMaxWidth()) {
            Text(stringResource(R.string.onboarding_placement_start))
        }
        TextButton(onClick = onSkip, enabled = !pending, modifier = Modifier.fillMaxWidth()) {
            Text(stringResource(R.string.onboarding_language_test_skip))
        }
        InterfaceOffer(language)
    }
}

/** Main switches the app to the learner's own language when it isn't showing in it; Android keeps an app's language from API 33. */
@Composable
private fun InterfaceOffer(language: String) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
    val context = LocalContext.current
    val own = Locale.forLanguageTag(language)
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
    run: GenerationRun,
    onRetry: (() -> Unit)?,
    pending: Boolean,
    failed: Boolean,
    onSkip: () -> Unit,
) {
    GenerationWait(kind = GenerationKind.LevelTestBank, run = run, onRetry = onRetry) {
        OnboardingHeading(
            stringResource(R.string.onboarding_language_test_preparing_title),
            stringResource(R.string.onboarding_language_test_preparing_description, languageName(targetLanguage, currentLocale())),
        )
    }
    OnboardingActions {
        FinishFailed(failed)
        TextButton(onClick = onSkip, enabled = !pending, modifier = Modifier.fillMaxWidth()) {
            Text(stringResource(R.string.onboarding_language_test_skip))
        }
        Text(
            text = stringResource(R.string.onboarding_language_test_skip_note),
            modifier = Modifier.fillMaxWidth(),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            style = MaterialTheme.typography.bodyMedium,
        )
    }
}

/** Reading questions show their passage; listening ones play it as a voice message. */
@Composable
private fun ColumnScope.TestQuestion(
    question: LevelTestQuestion,
    targetLanguage: String,
    vm: LevelTestViewModel,
    navigator: AppNavigator,
) {
    val listening = question.skill == LanguageLevelTestOneOf1NextOneOfQuestion.Skill.LISTENING
    PlacementQuestion(
        item =
            PlacementItem(
                itemId = question.id,
                question = question.question,
                context = question.passage.takeUnless { listening },
                image = null,
                visual = null,
                format = PlacementFormat.Choice(question.options),
            ),
        eyebrow = null,
        labels = TrueFalseLabels.TRUE_FALSE,
        typedWords = null,
        pending = vm.isSaving,
        answerFailed = vm.answerFailed,
        finishFailed = false,
        onAnswer = { answer, durationMs -> vm.answer(question.id, answer.selectedIndex(), durationMs) },
        onRetry = vm::retryAnswer,
        onStop = vm::stop,
        dontKnowLabel =
            stringResource(
                if (listening) R.string.onboarding_language_test_did_not_understand else R.string.onboarding_placement_dont_know,
            ),
        media = { if (listening) ListeningMessage(question.passage, targetLanguage, navigator) },
    )
}

private fun PlacementAnswer.selectedIndex(): Long? =
    (((this as? PlacementAnswer.ChoiceAnswerValue)?.value as? ChoiceAnswer.ChoiceAnswerAnyOfValue)?.value)?.selectedIndex

/** Read a little slower than normal, so the test isn't one of catching fast speech. */
@Composable
private fun ListeningMessage(
    text: String,
    language: String,
    navigator: AppNavigator,
) {
    val player = LocalSetupSpeech.current
    if (player == null) {
        Text(text, style = MaterialTheme.typography.bodyLarge.copy(localeList = TextLocales(language)))
        return
    }
    val audio = rememberSpokenAudio(player, language)
    var played by rememberSaveable { mutableStateOf(false) }
    val state = audio.state.withoutFailure()
    val label =
        speechActionLabel(
            state,
            stringResource(if (played) R.string.onboarding_language_test_play_again else R.string.onboarding_language_test_play),
        )
    val play = {
        played = true
        audio.speak(listOf(SpokenText(text)), rate = LISTENING_RATE)
    }

    OutlinedCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
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
                SpeechFailedNote(language, failed.limit, onRetry = play, navigator = navigator, text = text)
            }
        }
    }
}

/** Like the test's questions, it has no way back; skipping it ends the test. */
@Composable
private fun ColumnScope.LevelTestSpeaking(
    sentence: LevelTestSentence,
    targetLanguage: String,
    goalId: String,
    store: OnboardingStore,
    navigator: AppNavigator,
    onSkip: () -> Unit,
) {
    OnboardingHeading(stringResource(R.string.onboarding_language_test_say_it))
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(
            sentence.sentence,
            fontWeight = FontWeight.SemiBold,
            style = MaterialTheme.typography.titleLarge.copy(localeList = TextLocales(targetLanguage)),
        )
        Text(sentence.translation, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyLarge)
    }
    val recorderKey = "level-test-sentence:$goalId"
    val context = LocalContext.current
    // The recorder's own model, shared by its key: skipping while a sentence is graded would race the grade.
    val voice = viewModel(key = recorderKey) { VoiceAnswerModel(context) }
    OnboardingActions {
        VoiceAnswerRecorder(
            grade = { store.speakLevelTest(goalId, it) },
            onGraded = {},
            navigator = navigator,
            key = recorderKey,
        )
        TextButton(onClick = onSkip, enabled = !voice.checking, modifier = Modifier.fillMaxWidth()) {
            Text(stringResource(R.string.onboarding_language_test_skip_part))
        }
    }
}

@Composable
private fun ColumnScope.LevelTestDone(
    levels: List<SkillLevel>,
    pending: Boolean,
    failed: Boolean,
    onContinue: () -> Unit,
) {
    Icon(
        painterResource(R.drawable.ic_check_circle),
        contentDescription = null,
        tint = MaterialTheme.colorScheme.onTertiaryContainer,
    )
    OnboardingHeading(
        stringResource(R.string.onboarding_language_test_done_title),
        stringResource(R.string.onboarding_language_test_done_description),
    )
    if (levels.isNotEmpty()) LevelRows(levels)
    OnboardingActions {
        FinishFailed(failed)
        Button(onClick = onContinue, enabled = !pending, modifier = Modifier.fillMaxWidth()) {
            Text(stringResource(R.string.onboarding_language_test_build_plan))
        }
    }
}

/** The names and levels take their widest one's width, so every bar starts and ends together. */
@Composable
private fun LevelRows(levels: List<SkillLevel>) {
    val names = levels.map { skillName(it.skill) }
    val nameStyle = MaterialTheme.typography.labelLarge
    val labelStyle = MaterialTheme.typography.labelMedium.withTabularFigures()
    val measurer = rememberTextMeasurer()
    val density = LocalDensity.current
    val nameWidth = with(density) { names.maxOf { measurer.measure(it, nameStyle).size.width }.toDp() }
    val labelWidth = with(density) { levels.maxOf { measurer.measure(it.label, labelStyle).size.width }.toDp() }

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
                    LevelBar(level.score, Modifier.weight(1f))
                    Text(level.label, modifier = Modifier.width(labelWidth), style = labelStyle, textAlign = TextAlign.End)
                }
            }
        }
    }
}

@Composable
private fun skillName(skill: LanguageLevelTestOneOf1LevelsInner.Skill): String =
    stringResource(
        when (skill) {
            LanguageLevelTestOneOf1LevelsInner.Skill.READING -> R.string.onboarding_language_test_reading
            LanguageLevelTestOneOf1LevelsInner.Skill.LISTENING -> R.string.onboarding_language_test_listening
            LanguageLevelTestOneOf1LevelsInner.Skill.SPEAKING -> R.string.onboarding_language_test_speaking
            LanguageLevelTestOneOf1LevelsInner.Skill.WRITING -> R.string.onboarding_language_test_writing
        },
    )

/** As it reads mid-sentence in [locale], such as "italiano" in Portuguese. */
private fun languageName(
    tag: String,
    locale: Locale,
): String = Locale.forLanguageTag(tag).getDisplayLanguage(locale).ifEmpty { tag }

/** The languages core writes an alphabet lesson for (`NON_LATIN_SCRIPT_LANGUAGES` in packages/utils/src/languages.ts). */
private fun usesNonLatinScript(tag: String): Boolean = Locale.forLanguageTag(tag).language in NON_LATIN_SCRIPT_LANGUAGES

private val NON_LATIN_SCRIPT_LANGUAGES =
    setOf(
        "am",
        "ar",
        "be",
        "bg",
        "bn",
        "bo",
        "dv",
        "el",
        "fa",
        "gu",
        "he",
        "hi",
        "hy",
        "ja",
        "ka",
        "km",
        "kn",
        "ko",
        "lo",
        "mk",
        "ml",
        "mn",
        "mr",
        "my",
        "ne",
        "pa",
        "ps",
        "ru",
        "sd",
        "si",
        "sr",
        "ta",
        "te",
        "th",
        "ti",
        "uk",
        "ur",
        "yi",
        "zh",
    )

private const val LISTENING_RATE = 0.9f
private const val NAME_SHARE_LIMIT = 0.4f
