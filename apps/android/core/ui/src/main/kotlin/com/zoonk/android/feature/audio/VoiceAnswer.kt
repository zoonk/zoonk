package com.zoonk.android.feature.audio

import android.Manifest
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.SystemClock
import android.provider.Settings
import android.text.format.DateUtils
import androidx.activity.compose.LocalActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.size
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.lifecycle.compose.LifecycleStartEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.data.MutationResult
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LimitNotice
import com.zoonk.android.ui.components.LimitSubject
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.theme.GeistMono
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** Holds the take and its grading through rotation; leaving the screen throws an unfinished take away. */
class VoiceAnswerModel(
    context: Context,
) : ViewModel() {
    val recorder = VoiceRecorder(context.applicationContext, viewModelScope)

    var checking by mutableStateOf(false)
        private set

    var issue by mutableStateOf<VoiceIssue?>(null)
        private set

    /** The learner turned the microphone off for the app. */
    var microphoneOff by mutableStateOf(false)
        internal set

    /** The learner refused the microphone on a screen that then answers another way. */
    var blocked by mutableStateOf(false)

    internal fun <T> record(
        grade: suspend (VoiceRecording) -> GradeOutcome<T>,
        onGraded: (T) -> Unit,
    ) {
        issue = null
        recorder.start { recording -> viewModelScope.launch { check(recording, grade, onGraded) } }
    }

    private suspend fun <T> check(
        recording: VoiceRecording,
        grade: suspend (VoiceRecording) -> GradeOutcome<T>,
        onGraded: (T) -> Unit,
    ) {
        checking = true
        try {
            when (val outcome = grade(recording)) {
                is GradeOutcome.Graded -> onGraded(outcome.value)
                GradeOutcome.NoSpeech -> issue = VoiceIssue.NoSpeech
                is GradeOutcome.Limited -> issue = VoiceIssue.Limited(outcome.limit)
                GradeOutcome.Failed -> issue = VoiceIssue.Failed
                GradeOutcome.Obsolete -> Unit
            }
        } finally {
            checking = false
        }
    }

    override fun onCleared() {
        recorder.cancel()
    }
}

sealed interface VoiceIssue {
    data object NoSpeech : VoiceIssue

    data object Failed : VoiceIssue

    data class Limited(
        val limit: Limit,
    ) : VoiceIssue
}

/** The take for [key], shared by its [VoiceAnswerButton] and its [VoiceAnswerLine] wherever each is drawn. */
@Composable
fun voiceAnswerModel(key: String): VoiceAnswerModel {
    val context = LocalContext.current
    return viewModel(key = key) { VoiceAnswerModel(context) }
}

/**
 * Record, then [grade] in the screen's ViewModel scope; [onGraded] may run after a rotation, so it
 * should only call a ViewModel or store. With [onBlocked], a denied microphone hands over to the
 * screen's other way to answer instead of showing how to turn it on. [key] tells several
 * recorders on one screen apart. A take still running when the screen leaves or the app goes to
 * the background is thrown away.
 */
@Composable
fun <T> VoiceAnswerRecorder(
    grade: suspend (VoiceRecording) -> GradeOutcome<T>,
    onGraded: (T) -> Unit,
    navigator: AppNavigator,
    modifier: Modifier = Modifier,
    key: String = "voice-answer",
    asksToSpeak: Boolean = true,
    onBlocked: (() -> Unit)? = null,
) {
    if (voiceAnswerModel(key).microphoneOff && onBlocked == null) {
        MicrophoneOff(stringResource(R.string.audio_microphone_off_answer), modifier)
        return
    }

    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        VoiceAnswerButton(grade, onGraded, key = key, onBlocked = onBlocked)
        VoiceAnswerLine(navigator, key = key, asksToSpeak = asksToSpeak)
    }
}

/** The take's Record and Stop, for a screen that puts it in its bottom bar; [VoiceAnswerLine] says how it went. */
@Composable
fun <T> VoiceAnswerButton(
    grade: suspend (VoiceRecording) -> GradeOutcome<T>,
    onGraded: (T) -> Unit,
    key: String,
    modifier: Modifier = Modifier,
    onBlocked: (() -> Unit)? = null,
) {
    val model = voiceAnswerModel(key)
    val currentGrade by rememberUpdatedState(grade)
    val currentOnGraded by rememberUpdatedState(onGraded)
    val tapRecord =
        rememberRecordTap(
            recorder = model.recorder,
            onAllowed = { model.microphoneOff = false },
            onRefused = { lasting ->
                when {
                    onBlocked != null -> onBlocked()
                    lasting -> model.microphoneOff = true
                }
            },
            record = { model.record({ currentGrade(it) }, { currentOnGraded(it) }) },
        )
    val status by model.recorder.state.collectAsStateWithLifecycle()

    RecordButton(status = status, onStart = tapRecord, onStop = model.recorder::stop, modifier = modifier, enabled = !model.checking)
}

/** What the take for [key] is doing: listening, checking, what went wrong, or a limit with its way on. */
@Composable
fun VoiceAnswerLine(
    navigator: AppNavigator,
    key: String,
    modifier: Modifier = Modifier,
    asksToSpeak: Boolean = true,
) {
    val model = voiceAnswerModel(key)
    val status by model.recorder.state.collectAsStateWithLifecycle()
    val recording = status is VoiceRecorder.Status.Recording
    val slow by produceState(false, model.checking) {
        value = false
        if (model.checking) {
            delay(SLOW_CHECK_MS)
            value = true
        }
    }
    val issue = model.issue.takeUnless { recording }
    val hint =
        when {
            recording -> stringResource(R.string.audio_listening)
            model.checking && slow -> stringResource(R.string.audio_checking_slow)
            model.checking -> stringResource(R.string.audio_checking)
            issue is VoiceIssue.Limited -> null
            issue == VoiceIssue.NoSpeech -> stringResource(R.string.audio_no_speech)
            issue == VoiceIssue.Failed -> stringResource(R.string.audio_check_failed)
            asksToSpeak -> stringResource(R.string.audio_say_it)
            else -> null
        }

    if (issue is VoiceIssue.Limited) {
        LimitNotice(
            issue.limit,
            LimitSubject.Help,
            onCreateAccount = { navigator.open(AppRoute.Login) },
            onSubscribe = { navigator.open(AppRoute.Subscription) },
            modifier = modifier,
        )
        return
    }
    hint?.let {
        Text(
            text = it,
            // Announcing the take's start would speak into the microphone.
            modifier = modifier.semantics { if (!recording) liveRegion = LiveRegionMode.Polite },
            color = if (issue == VoiceIssue.Failed) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
    }
}

/**
 * The Record tap: it asks for the microphone first when needed, then [record]s. [onRefused] hears
 * whether the refusal lasts (Android asks again after a first one; only Settings undoes a lasting
 * one), and [onAllowed] runs when the learner comes back with the microphone on. A take still
 * running when the screen leaves or the app goes to the background is thrown away.
 */
@Composable
fun rememberRecordTap(
    recorder: VoiceRecorder,
    onAllowed: () -> Unit,
    onRefused: (lasting: Boolean) -> Unit,
    record: () -> Unit,
): () -> Unit {
    val activity = LocalActivity.current
    val currentRecord by rememberUpdatedState(record)
    val currentOnRefused by rememberUpdatedState(onRefused)
    val currentOnAllowed by rememberUpdatedState(onAllowed)
    val permission =
        rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            if (granted) {
                currentRecord()
            } else {
                currentOnRefused(activity?.shouldShowRequestPermissionRationale(Manifest.permission.RECORD_AUDIO) != true)
            }
        }
    LifecycleResumeEffect(recorder) {
        if (recorder.hasPermission) currentOnAllowed()
        onPauseOrDispose {}
    }
    LifecycleStartEffect(recorder) {
        onStopOrDispose { if (activity?.isChangingConfigurations != true) recorder.cancel() }
    }
    return { if (recorder.hasPermission) currentRecord() else permission.launch(Manifest.permission.RECORD_AUDIO) }
}

/**
 * Record while idle; Stop with the take's clock while recording, in the same filled button. It
 * stays one button through both, so TalkBack keeps its focus.
 */
@Composable
fun RecordButton(
    status: VoiceRecorder.Status,
    onStart: () -> Unit,
    onStop: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    val recording = status as? VoiceRecorder.Status.Recording
    Button(
        onClick = if (recording != null) onStop else onStart,
        modifier = modifier,
        enabled = enabled || recording != null,
    ) {
        if (recording == null) {
            Text(stringResource(R.string.audio_record))
            return@Button
        }
        Text(stringResource(R.string.audio_record_stop))
        Spacer(Modifier.size(ButtonDefaults.IconSpacing))
        RecordingClock(recording.startedAt)
    }
}

/** The clock moves every second, so it stays out of the button's name. */
@Composable
private fun RecordingClock(startedAt: Long) {
    val seconds by produceState((SystemClock.elapsedRealtime() - startedAt) / 1000, startedAt) {
        while (true) {
            value = (SystemClock.elapsedRealtime() - startedAt) / 1000
            delay(CLOCK_TICK_MS)
        }
    }
    Text(
        text = DateUtils.formatElapsedTime(seconds),
        modifier = Modifier.clearAndSetSemantics {},
        color = LocalContentColor.current.copy(alpha = CLOCK_ALPHA),
        style = MaterialTheme.typography.labelLarge.copy(fontFamily = GeistMono),
    )
}

private const val CLOCK_TICK_MS = 250L

/** Main's spoken answers say so after 15 seconds. */
private const val SLOW_CHECK_MS = 15_000L

private const val CLOCK_ALPHA = 0.7f

/** Inline, beside the step it belongs to; [description] says what the microphone is for here. */
@Composable
fun MicrophoneOff(
    description: String,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    Column(
        modifier = modifier.semantics { liveRegion = LiveRegionMode.Polite },
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Icon(painterResource(R.drawable.ic_mic_off), contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(stringResource(R.string.audio_microphone_off_title), style = MaterialTheme.typography.titleSmall)
        }
        Text(description, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
        OutlinedButton(
            onClick = {
                context.startActivity(
                    Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", context.packageName, null)),
                )
            },
        ) {
            Text(stringResource(R.string.audio_open_settings))
        }
    }
}
