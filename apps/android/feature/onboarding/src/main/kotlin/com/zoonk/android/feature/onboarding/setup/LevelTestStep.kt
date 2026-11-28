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
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.runtime.withFrameMillis
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
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
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.data.AnalyticsEvent
import com.zoonk.android.data.GenerationKind
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.TestContext
import com.zoonk.android.data.TrackVisibleWait
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.recode
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
import com.zoonk.android.feature.placementtest.Sitting
import com.zoonk.android.feature.placementtest.TestStop
import com.zoonk.android.feature.placementtest.TestVisit
import com.zoonk.android.feature.placementtest.TrackFirstQuestion
import com.zoonk.android.feature.placementtest.asking
import com.zoonk.android.feature.questions.Answer
import com.zoonk.android.feature.questions.Question
import com.zoonk.android.feature.questions.QuestionFormat
import com.zoonk.android.feature.questions.Select
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.ui.VisitOf
import com.zoonk.android.ui.components.ButtonIcon
import com.zoonk.android.ui.components.FilledIconButton
import com.zoonk.android.ui.components.GenerationWait
import com.zoonk.android.ui.components.LinkButton
import com.zoonk.android.ui.components.Meter
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatClock
import com.zoonk.android.ui.format.formattingLocale
import com.zoonk.android.ui.format.languageName
import com.zoonk.android.ui.theme.layoutEnd
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonkType
import com.zoonk.api.models.LanguageLevelTest
import com.zoonk.api.models.LanguageLevelTestOneOf1LevelsInner
import com.zoonk.api.models.LanguageLevelTestOneOf1NextOneOfQuestion
import com.zoonk.api.models.LanguageLevelTestResult
import com.zoonk.api.models.LanguageLevelTestResultResult
import com.zoonk.api.models.TrueFalseLabels
import kotlinx.coroutines.delay
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
    /** The test's visit, held by its view model, so its first question is counted once. */
    val visit: TestVisit,
    val finished: @Composable ColumnScope.(LanguageLevelTestResult) -> Unit,
)

/** There's no way back during its questions; stopping closes the test and shows what it found. */
@Composable
internal fun ColumnScope.LevelTestSteps(
    goalId: String,
    targetLanguage: String,
    store: OnboardingStore,
    navigator: AppNavigator,
    onSitting: (Sitting?) -> Unit,
    plan: PlanAttempt,
    onReportSaveFailure: () -> Unit = {},
) {
    val vm = viewModel(key = "level-test:$goalId:${plan.attemptId}") { LevelTestViewModel(goalId, store, plan.attemptId) }
    VisitOf(vm.visit)
    val test by store.levelTest(goalId, plan.attemptId).collectShown()
    val phase = vm.phase(test)
    val poll = rememberPoll(active = phase == LevelTestPhase.Waiting && !vm.bank.isStopped) { vm.check() }
    val audioQuestion = (phase as? LevelTestPhase.Question)?.question?.takeIf { it.audioPending }?.id
    val audioPoll = rememberPoll(active = audioQuestion != null, key = audioQuestion) { vm.check() }
    val context =
        TestContext(
            goalId = goalId,
            test = TestContext.Kind.Language,
            surface = if (plan.onboarding) TestContext.Surface.Onboarding else TestContext.Surface.Plan,
            questions = (phase as? LevelTestPhase.Question)?.total?.toLong(),
            attemptId = plan.attemptId.toString(),
        )
    val question = phase as? LevelTestPhase.Question
    val title =
        question?.let {
            stringResource(
                if (it.question.isListening) R.string.onboarding_language_test_listening else R.string.onboarding_language_test_reading,
            )
        }
    LaunchedEffect(question?.number, question?.canStop, title, vm.isSaving) {
        onSitting(
            if (question != null && title != null) {
                asking(
                    context,
                    title,
                    question.number - 1L,
                    question.total.toLong(),
                    groups = levelTestGroups(question.total),
                    stop = TestStop(enabled = !vm.isSaving, onStop = vm::stop).takeIf { question.canStop },
                )
            } else {
                Sitting()
            },
        )
    }
    DisposableEffect(Unit) { onDispose { onSitting(null) } }

    when (phase) {
        LevelTestPhase.Loading -> {
            StepLoading()
        }

        LevelTestPhase.Waiting -> {
            val run = vm.bank.run().withPoll(poll.stopped)
            LevelTestWaiting(
                run = run,
                onRetry =
                    when {
                        poll.stopped -> poll::restart
                        run.status == GenerationRun.Status.Failed -> vm::retry
                        else -> null
                    },
                pending = plan.leaving,
                onSkip = plan.onLeave,
                onboarding = plan.onboarding,
            )
        }

        is LevelTestPhase.Question -> {
            TrackFirstQuestion(plan.visit, context, phase.number.toLong(), plan.attemptId.toString())
            SetupContent {
                FinishFailed(vm.finishFailed)
                key(phase.question.id) {
                    val audioPending = audioPoll.status(audioQuestion != null) == PollStatus.Polling
                    TestQuestion(phase, targetLanguage, audioPending, vm, navigator, onReportSaveFailure)
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
                    PlacementDone(pending = vm.isSaving, failed = vm.finishFailed, onContinue = vm::finish)
                }
            }
        }
    }
}

private fun LanguageLevelTest.savedResult(attemptId: UUID): LanguageLevelTestResult? {
    val test = (this as? LanguageLevelTest.LanguageLevelTestOneOf1Value)?.value ?: return null
    val saved = test.result?.takeIf { it.attemptId == attemptId } ?: return null
    return LanguageLevelTestResult(levels = test.levels, result = saved.recode())
}

/** Main switches the app to the learner's own language when it isn't showing in it; Android keeps an app's language from API 33. */
@Composable
internal fun InterfaceOffer(language: String) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
    val context = LocalContext.current
    val own = formattingLocale(language)
    val supported = remember(context) { LocaleConfig(context).supportedLocales }
    val translated = supported != null && (0 until supported.size()).any { supported[it].language == own.language }
    if (!translated || own.language == currentLocale().language) return

    LinkButton(stringResource(R.string.onboarding_language_test_use_app_in, languageName(language, own)), onClick = {
        context.getSystemService(LocaleManager::class.java).applicationLocales = LocaleList(own)
    })
}

@Composable
private fun ColumnScope.LevelTestWaiting(
    run: GenerationRun,
    onRetry: (() -> Unit)?,
    pending: Boolean,
    onSkip: () -> Unit,
    onboarding: Boolean,
) {
    TrackVisibleWait(AnalyticsEvent.WarmUpSurface.PlacementWait.value, "curriculum", LocalSetupWait.current.goalId)
    SetupContent {
        GenerationWait(GenerationKind.LevelTestBank, run, onRetry) {
            OnboardingHeading(stringResource(R.string.generation_placement), stringResource(R.string.onboarding_placement_waiting_time))
        }
        PageActions {
            OutlinedButton(busy = pending, onClick = onSkip, modifier = Modifier.fillMaxWidth()) {
                Text(stringResource(if (onboarding) R.string.onboarding_skip else R.string.placementtest_not_now))
            }
            if (onboarding) {
                Text(
                    text = stringResource(R.string.focustest_skip_note),
                    modifier = Modifier.fillMaxWidth(),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        }
    }
}

/**
 * Reading questions show their passage; listening ones play it as a voice message. Until the message has played to its
 * end once, the bar's way around it ends the test's listening; after, it's the miss. While the message can't play, its
 * question is skipped instead, which doesn't count toward a level. [audioPending] says the reads are still asking for
 * the recording, which holds the play button; once they stop, a tap can ask for the message itself.
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
    val listening = question.isListening
    val audio = LocalSetupSpeech.current?.let { rememberSpokenAudio(it, targetLanguage) }
    var heard by rememberSaveable { mutableStateOf(false) }
    // Until the recording is confirmed delivered, the way around it skips only this question, even once the polls stop;
    // a message heard to its end makes it the miss either way.
    val noAudio = listening && !heard && (question.audioPending || audio?.state is SpeechState.Failed)
    val cantListen = stringResource(R.string.onboarding_language_test_cant_listen)
    val notUnderstood = stringResource(R.string.onboarding_language_test_did_not_understand)
    val skip = stringResource(R.string.onboarding_language_test_skip_question)
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
        labels = TrueFalseLabels.TRUE_FALSE,
        pending = vm.isSaving,
        saveFailures = vm.saveFailures,
        onReportSaveFailure = onReportSaveFailure,
        onAnswer = { answer, durationMs -> vm.answer(question.id, answer, durationMs, skipped = noAudio && answer == Answer.DontKnow) },
        second =
            if (listening) {
                SecondAction(
                    label =
                        when {
                            heard -> notUnderstood
                            noAudio -> skip
                            else -> cantListen
                        },
                    labels = listOf(cantListen, notUnderstood, skip),
                    busy = vm.deferring,
                    onClick = { vm.deferAudio(question.id) }.takeUnless { noAudio || heard },
                )
            } else {
                SecondAction(stringResource(R.string.onboarding_placement_dont_know))
            },
        media = { if (listening) ListeningMessage(question, targetLanguage, audioPending, audio, navigator, onHeard = { heard = true }) },
    )
}

/**
 * The voice message as one row: play, a line that fills as it plays, and its length counting down. Read a little
 * slower than normal, so the test isn't one of catching fast speech. A stored recording plays as it is; without one, the
 * learner's tap asks for it. While the recording is on its way, the button waits and the line says so.
 */
@Composable
private fun ListeningMessage(
    question: LevelTestQuestion,
    language: String,
    pending: Boolean,
    audio: SpokenAudio?,
    navigator: AppNavigator,
    onHeard: () -> Unit,
) {
    if (audio == null) {
        Text(question.passage, style = MaterialTheme.typography.bodyLarge.copy(localeList = TextLocales(language)))
        return
    }
    var played by rememberSaveable { mutableStateOf(false) }
    val state = audio.state.withoutFailure()
    val playing = state == SpeechState.Playing
    val totalMs = question.audio?.durationMs?.let { (it / LISTENING_RATE).toLong() }
    var elapsedMs by remember { mutableLongStateOf(0L) }
    LaunchedEffect(playing) {
        elapsedMs = 0L
        if (!playing) return@LaunchedEffect
        val start = withFrameMillis { it }
        while (true) {
            delay(TICK_MS)
            withFrameMillis { elapsedMs = it - start }
        }
    }
    val label =
        speechActionLabel(
            state,
            stringResource(if (played) R.string.onboarding_language_test_play_again else R.string.onboarding_language_test_play),
        )
    val play = {
        played = true
        audio.speak(
            listOf(SpokenText(question.passage, recording = question.audio?.url?.toString())),
            rate = LISTENING_RATE,
            onDone = onHeard,
        )
    }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            FilledIconButton(
                onClick = { if (audio.isBusy) audio.cancel() else play() },
                enabled = !pending,
                modifier = Modifier.size(48.dp).semantics { contentDescription = label },
            ) {
                if (pending) {
                    CircularProgressIndicator(Modifier.size(buttonIconSize()), strokeWidth = 2.dp)
                } else {
                    SpeechStatusIcon(state) {
                        Icon(
                            painterResource(R.drawable.ic_play_arrow),
                            contentDescription = null,
                            modifier = Modifier.size(buttonIconSize()),
                        )
                    }
                }
            }
            if (pending) {
                Text(
                    stringResource(R.string.onboarding_language_test_audio_on_its_way),
                    modifier = Modifier.weight(1f).semantics { liveRegion = LiveRegionMode.Polite },
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
            } else {
                Meter(
                    share = if (playing && totalMs != null && totalMs > 0) elapsedMs.toFloat() / totalMs else 0f,
                    modifier = Modifier.weight(1f),
                    color = MaterialTheme.colorScheme.onSurface,
                    height = 4.dp,
                )
                // The length's room is kept while it isn't known, so the line never jumps.
                Text(
                    totalMs?.let { formatClock((it - if (playing) elapsedMs else 0L).coerceAtLeast(0L)) }.orEmpty(),
                    modifier = Modifier.widthIn(min = 36.dp),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.zoonkType.data.withTabularFigures(),
                    textAlign = layoutEnd(),
                )
            }
        }
        (audio.state as? SpeechState.Failed)?.let { failed ->
            SpeechFailedNote(language, failed.limit, onRetry = play, navigator = navigator)
        }
    }
}

/** A skill's row: its name, its level's bar and its level, [muted] when the skill wasn't tested. */
internal class LevelRow(
    val name: String,
    val label: String,
    val muted: Boolean = false,
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
                    Text(
                        labels[index],
                        modifier = Modifier.width(labelWidth),
                        color = if (level.muted) MaterialTheme.colorScheme.onSurfaceVariant else Color.Unspecified,
                        style = if (level.muted) labelStyle.copy(fontWeight = FontWeight.Normal) else labelStyle,
                        textAlign = layoutEnd(),
                    )
                }
            }
        }
    }
}

@Composable
internal fun skillName(skill: LanguageLevelTestOneOf1LevelsInner.Skill): String {
    return stringResource(
        when (skill) {
            LanguageLevelTestOneOf1LevelsInner.Skill.READING -> R.string.onboarding_language_test_reading
            LanguageLevelTestOneOf1LevelsInner.Skill.UNKNOWN_DEFAULT_OPEN_API -> return ""
            LanguageLevelTestOneOf1LevelsInner.Skill.LISTENING -> R.string.onboarding_language_test_listening
            LanguageLevelTestOneOf1LevelsInner.Skill.SPEAKING -> R.string.onboarding_language_test_speaking
            LanguageLevelTestOneOf1LevelsInner.Skill.WRITING -> R.string.onboarding_language_test_writing
        },
    )
}

private const val LISTENING_RATE = 0.9f

private const val TICK_MS = 250L
private const val NAME_SHARE_LIMIT = 0.4f
