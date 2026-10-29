package com.zoonk.android.feature.pronunciation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.intl.LocaleList
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.SessionState
import com.zoonk.android.data.collectShown
import com.zoonk.android.feature.audio.ListenButton
import com.zoonk.android.feature.audio.MicrophoneOff
import com.zoonk.android.feature.audio.RecordButton
import com.zoonk.android.feature.audio.SpeechFailedNote
import com.zoonk.android.feature.audio.SpeechPlayer
import com.zoonk.android.feature.audio.SpeechState
import com.zoonk.android.feature.audio.SpokenAudio
import com.zoonk.android.feature.audio.SpokenText
import com.zoonk.android.feature.audio.VoiceIssue
import com.zoonk.android.feature.audio.VoiceRecorder
import com.zoonk.android.feature.audio.buttonIconSize
import com.zoonk.android.feature.audio.rememberRecordTap
import com.zoonk.android.feature.audio.rememberSpokenAudio
import com.zoonk.android.feature.audio.withoutFailure
import com.zoonk.android.feature.player.LessonColumn
import com.zoonk.android.feature.player.segmentParts
import com.zoonk.android.feature.questions.ItemLine
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.FeedbackTone
import com.zoonk.android.ui.components.FeedbackVerdict
import com.zoonk.android.ui.components.LimitNotice
import com.zoonk.android.ui.components.LimitSubject
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.components.MeterParts
import com.zoonk.android.ui.components.MomentReadouts
import com.zoonk.android.ui.components.MomentScore
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.scaffold.TaskScaffold
import com.zoonk.api.models.PronunciationAnswerGrade
import com.zoonk.api.models.PronunciationRoundResult
import kotlinx.coroutines.launch
import java.time.ZoneId
import kotlin.time.toJavaInstant

/** `/pronunciation` (main's `PronunciationReviewScreen`): the active goal's words due to say again, or [AppRoute.Pronunciation.goalId]'s. */
@Composable
fun PronunciationScreen(
    route: AppRoute.Pronunciation,
    app: AppContainer,
    navigator: AppNavigator,
) {
    val summary by app.learnerSummary.summary.collectShown()
    val session by app.sessions.state.collectAsStateWithLifecycle()
    val owner = (session as? SessionState.SignedIn)?.session?.localId
    val goalId = route.goalId ?: (summary as? LoadState.Loaded)?.value?.activeGoalId?.toString()

    if (owner == null || goalId == null) {
        TaskScaffold(onClose = navigator::closeTask, title = { Text(stringResource(R.string.pronunciation_title)) }) { padding ->
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
        }
        return
    }

    key(owner, goalId) { PronunciationTask(goalId, owner, app.pronunciation, app.speech, navigator) }
}

/** Reads the words once: once the round starts, what grading changes is the next round's. */
@Composable
internal fun PronunciationTask(
    goalId: String,
    owner: String,
    store: PronunciationStore,
    speech: SpeechPlayer,
    navigator: AppNavigator,
) {
    val context = LocalContext.current
    val model = viewModel(key = "pronunciation:$owner:$goalId") { PronunciationViewModel(context) }
    val round = model.round

    if (round != null) {
        PronunciationRoundScreen(round, model, speech, navigator)
        return
    }

    val resource = remember(goalId) { store.reviews(goalId) }
    val load by resource.collectShown()
    val scope = rememberCoroutineScope()

    when (val state = load) {
        is LoadState.Loaded -> LaunchedEffect(state.value) { model.start(goalId, state.value, store) }
        LoadState.Empty -> LaunchedEffect(Unit) { model.start(goalId, null, store) }
        is LoadState.Failed -> if (state.error == ApiError.NotFound) LaunchedEffect(Unit) { model.start(goalId, null, store) }
        LoadState.Idle, LoadState.Loading -> Unit
    }

    TaskScaffold(onClose = navigator::closeTask, title = { Text(stringResource(R.string.pronunciation_title)) }) { padding ->
        val failed = (load as? LoadState.Failed)?.takeIf { it.error != ApiError.NotFound }
        Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
            if (failed != null) LoadFailedMessage(onRetry = { scope.launch { resource.refresh() } }) else CircularProgressIndicator()
        }
    }
}

@Composable
internal fun PronunciationRoundScreen(
    round: PronunciationRound,
    model: PronunciationViewModel,
    speech: SpeechPlayer,
    navigator: AppNavigator,
) {
    when (val step = round.step) {
        is RoundStep.Result -> RoundEnd(round.words.isEmpty(), step.result, navigator::closeTask)
        is RoundStep.Word -> WordStep(round, step, model, speech, navigator)
    }
}

@Composable
private fun WordStep(
    round: PronunciationRound,
    step: RoundStep.Word,
    model: PronunciationViewModel,
    speech: SpeechPlayer,
    navigator: AppNavigator,
) {
    val word = round.words[step.index]
    val normal = rememberSpokenAudio(speech, round.language)
    val slow = rememberSpokenAudio(speech, round.language)
    val status by model.recorder.state.collectAsStateWithLifecycle()
    val recording = status is VoiceRecorder.Status.Recording
    val tapRecord =
        rememberRecordTap(
            recorder = model.recorder,
            onAllowed = { model.microphoneOff = false },
            onRefused = { lasting -> if (lasting) model.microphoneOff = true },
            record = {
                normal.cancel()
                slow.cancel()
                model.record()
            },
        )
    val haptics = LocalHapticFeedback.current

    LaunchedEffect(step.grade) {
        val grade = step.grade ?: return@LaunchedEffect
        haptics.performHapticFeedback(if (grade.isCorrect) HapticFeedbackType.Confirm else HapticFeedbackType.Reject)
    }

    TaskScaffold(
        onClose = navigator::closeTask,
        title = { Text(stringResource(R.string.pronunciation_title)) },
        actions = {
            if (step.grade == null && !model.microphoneOff) {
                WordMenu(enabled = !round.pending && !recording, onSkip = model::next)
            }
        },
        bottomBar = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                if (round.finishFailed) SaveFailed(onRetry = model::finish)
                WordActions(round, step, model, status, tapRecord)
            }
        },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(vertical = 16.dp),
        ) {
            LessonColumn {
                RoundMeter(round)
                key(word.id) { WordCard(word, round.language, normal, slow, navigator) }
                val grade = step.grade
                when {
                    grade != null -> {
                        GradeNote(grade)
                    }

                    model.microphoneOff -> {
                        MicrophoneOff(stringResource(R.string.pronunciation_microphone_off))
                    }

                    step.issue is VoiceIssue.Limited && !recording && !round.pending -> {
                        LimitNotice(
                            step.issue.limit,
                            LimitSubject.Help,
                            onCreateAccount = { navigator.open(AppRoute.Login) },
                            onSeePlus = { navigator.open(AppRoute.Subscription) },
                        )
                    }

                    else -> {
                        RecorderStatus(step.issue, pending = round.pending, recording = recording)
                    }
                }
            }
        }
    }
}

@Composable
private fun RoundMeter(round: PronunciationRound) {
    val locale = currentLocale()
    val total = round.words.size
    val label =
        stringResource(
            R.string.pronunciation_position,
            formatNumber((round.index + 1).toDouble(), locale),
            formatNumber(total.toDouble(), locale),
        )

    Column(
        Modifier.semantics(mergeDescendants = true) {
            contentDescription = label
            progressBarRangeInfo = ProgressBarRangeInfo(round.outcomes.size.toFloat(), 0f..total.toFloat())
        },
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelMedium)
        MeterParts(segmentParts(round.segments))
    }
}

@Composable
private fun WordCard(
    word: ReviewWord,
    language: String,
    normal: SpokenAudio,
    slow: SpokenAudio,
    navigator: AppNavigator,
) {
    val segments = listOf(SpokenText(word.word, recording = word.audioUrl, personal = false))
    // One sound plays at a time, so at most one of them failed.
    val failed =
        when {
            normal.state is SpeechState.Failed -> normal to 1f
            slow.state is SpeechState.Failed -> slow to SpeechPlayer.SLOW_RATE
            else -> null
        }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                word.word,
                Modifier.semantics { heading() },
                style = MaterialTheme.typography.displaySmall.copy(localeList = LocaleList(language)),
                fontWeight = FontWeight.SemiBold,
            )
            word.romanization?.let {
                Text(
                    it,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyLarge,
                )
            }
            word.respelling?.let { SayItLike(it) }
        }

        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            ListenButton(normal, segments, stringResource(R.string.pronunciation_listen), state = normal.state.withoutFailure())
            ListenButton(
                slow,
                segments,
                stringResource(R.string.pronunciation_listen_slowly),
                state = slow.state.withoutFailure(),
                rate = SpeechPlayer.SLOW_RATE,
                icon = R.drawable.ic_slow_motion_video,
            )
        }

        failed?.let { (audio, rate) ->
            SpeechFailedNote(
                language = language,
                limit = (audio.state as? SpeechState.Failed)?.limit,
                onRetry = { audio.speak(segments, rate) },
                navigator = navigator,
            )
        }

        word.tip?.let {
            ItemLine(it, style = MaterialTheme.typography.bodySmall.copy(color = MaterialTheme.colorScheme.onSurfaceVariant))
        }
    }
}

@Composable
private fun SayItLike(respelling: String) {
    val sentence = stringResource(R.string.pronunciation_say_it_like, respelling)
    val start = sentence.indexOf(respelling)
    Text(
        buildAnnotatedString {
            append(sentence.substring(0, start.coerceAtLeast(0)))
            withStyle(
                SpanStyle(color = MaterialTheme.colorScheme.onSurface, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Medium),
            ) {
                append(if (start >= 0) respelling else "")
            }
            append(if (start >= 0) sentence.substring(start + respelling.length) else sentence)
        },
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        style = MaterialTheme.typography.bodyMedium,
    )
}

@Composable
private fun RecorderStatus(
    issue: VoiceIssue?,
    pending: Boolean,
    recording: Boolean,
) {
    val text =
        when {
            pending -> stringResource(R.string.pronunciation_grading)
            recording -> stringResource(R.string.pronunciation_recording)
            issue == VoiceIssue.NoSpeech -> stringResource(R.string.pronunciation_no_speech)
            issue == VoiceIssue.Failed -> stringResource(R.string.pronunciation_failed)
            else -> stringResource(R.string.pronunciation_press_record)
        }
    Text(
        text,
        // Announcing the take's start would speak into the microphone.
        Modifier.semantics { if (!recording) liveRegion = LiveRegionMode.Polite },
        color =
            if (issue == VoiceIssue.Failed && !pending &&
                !recording
            ) {
                MaterialTheme.colorScheme.error
            } else {
                MaterialTheme.colorScheme.onSurfaceVariant
            },
        style = MaterialTheme.typography.bodyMedium,
    )
}

@Composable
private fun GradeNote(grade: PronunciationAnswerGrade) {
    val locale = currentLocale()
    Column(Modifier.semantics(mergeDescendants = true) {}, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        if (grade.isCorrect) {
            FeedbackVerdict(stringResource(R.string.pronunciation_sounded_right), FeedbackTone.Right)
        } else {
            Text(
                stringResource(R.string.pronunciation_heard, grade.transcript),
                Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                style = MaterialTheme.typography.titleSmall,
            )
        }
        val next = grade.nextReviewAt
        Text(
            if (next == null) {
                stringResource(R.string.pronunciation_learned)
            } else {
                val day = next.toJavaInstant().atZone(ZoneId.systemDefault()).toLocalDate()
                stringResource(R.string.pronunciation_comes_back, formatDate(day, locale, DateStyle.Long))
            },
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
    }
}

@Composable
private fun WordMenu(
    enabled: Boolean,
    onSkip: () -> Unit,
) {
    var open by remember { mutableStateOf(false) }
    Box {
        IconButton(onClick = { open = true }) {
            Icon(painterResource(R.drawable.ic_more_vert), contentDescription = stringResource(R.string.pronunciation_options))
        }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            DropdownMenuItem(
                text = { Text(stringResource(R.string.pronunciation_skip)) },
                leadingIcon = { Icon(painterResource(R.drawable.ic_skip_next), contentDescription = null) },
                enabled = enabled,
                onClick = {
                    open = false
                    onSkip()
                },
            )
        }
    }
}

@Composable
private fun WordActions(
    round: PronunciationRound,
    step: RoundStep.Word,
    model: PronunciationViewModel,
    status: VoiceRecorder.Status,
    tapRecord: () -> Unit,
) {
    val level by model.recorder.level.collectAsStateWithLifecycle()
    val grade = step.grade
    when {
        grade != null -> {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                if (!grade.isCorrect) {
                    OutlinedButton(onClick = round::tryAgain, contentPadding = ButtonDefaults.ButtonWithIconContentPadding) {
                        Icon(painterResource(R.drawable.ic_replay), contentDescription = null, modifier = Modifier.size(buttonIconSize()))
                        Spacer(Modifier.size(ButtonDefaults.IconSpacing))
                        Text(stringResource(R.string.pronunciation_try_again))
                    }
                }
                Button(onClick = model::next, modifier = Modifier.weight(1f), enabled = !round.pending) {
                    Text(
                        stringResource(
                            if (round.index + 1 ==
                                round.words.size
                            ) {
                                R.string.pronunciation_see_how
                            } else {
                                R.string.pronunciation_continue
                            },
                        ),
                    )
                }
            }
        }

        model.microphoneOff -> {
            Button(onClick = model::next, modifier = Modifier.fillMaxWidth(), enabled = !round.pending) {
                Text(stringResource(R.string.pronunciation_skip))
            }
        }

        else -> {
            RecordButton(
                status = status,
                level = { level },
                onStart = tapRecord,
                onStop = model.recorder::stop,
                modifier = Modifier.fillMaxWidth(),
                enabled = !round.pending,
            )
        }
    }
}

@Composable
private fun SaveFailed(onRetry: () -> Unit) {
    Row(Modifier.fillMaxWidth().semantics { liveRegion = LiveRegionMode.Polite }, verticalAlignment = Alignment.CenterVertically) {
        Text(
            stringResource(R.string.pronunciation_save_failed),
            Modifier.weight(1f),
            color = MaterialTheme.colorScheme.error,
            style = MaterialTheme.typography.bodyMedium,
        )
        TextButton(onClick = onRetry) { Text(stringResource(R.string.pronunciation_save_retry)) }
    }
}

/** The day's moment and its ceremony come with the session's (L3), as on the lesson's end. */
@Composable
private fun RoundEnd(
    noWords: Boolean,
    result: PronunciationRoundResult?,
    onDone: () -> Unit,
) {
    TaskScaffold(
        onClose = onDone,
        title = { Text(stringResource(R.string.pronunciation_title)) },
        bottomBar = {
            Button(onClick = onDone, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.pronunciation_done)) }
        },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(vertical = 24.dp),
        ) {
            LessonColumn(Modifier.semantics { liveRegion = LiveRegionMode.Polite }) {
                if (noWords) {
                    Text(
                        stringResource(R.string.pronunciation_no_words),
                        Modifier.semantics { heading() },
                        style = MaterialTheme.typography.headlineSmall,
                    )
                    return@LessonColumn
                }
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        stringResource(if (result == null) R.string.pronunciation_nothing_said else R.string.pronunciation_practice_done),
                        Modifier.semantics { heading() },
                        style = MaterialTheme.typography.headlineSmall,
                    )
                    Text(
                        stringResource(R.string.pronunciation_accent),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodyLarge,
                    )
                }
                result?.let {
                    MomentReadouts(it.brainPower, score = MomentScore(it.total.toInt(), it.correct.toInt(), spoken = true))
                }
            }
        }
    }
}
