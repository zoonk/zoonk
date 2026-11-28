package com.zoonk.android.feature.audio

import android.Manifest
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.SystemClock
import android.provider.Settings
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
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.lifecycle.compose.LifecycleStartEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.createSavedStateHandle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.SavedStateHandleSaveableApi
import androidx.lifecycle.viewmodel.compose.saveable
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.Visit
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LimitNotice
import com.zoonk.android.ui.components.LimitSubject
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.TakeTaskBarKey
import com.zoonk.android.ui.components.TaskBarKey
import com.zoonk.android.ui.format.formatClock
import com.zoonk.android.ui.theme.GeistMono
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Holds the take and its grading through rotation; leaving the screen throws an unfinished take away.
 * [grade] is the screen's grading call (a ViewModel's or a store's), which saves what it graded.
 */
@OptIn(SavedStateHandleSaveableApi::class)
class VoiceAnswerModel(
    context: Context,
    private val grade: suspend (VoiceRecording) -> GradeOutcome<*>,
    handle: SavedStateHandle,
) : ViewModel() {
    val recorder = VoiceRecorder(context.applicationContext, viewModelScope)

    var checking by mutableStateOf(false)
        private set

    /** The recorder's screen, held by [recordNote] until the screen goes. */
    internal val visit = Visit()

    internal val issue = visit.outcome<VoiceIssue>()

    /** The learner turned the microphone off for the app. */
    var microphoneOff by mutableStateOf(false)
        internal set

    /** The learner refused the microphone on a screen that then answers another way, kept through a reclaimed process. */
    var blocked by handle.saveable { mutableStateOf(false) }

    /** Once the server said a take missed its start, the screen's takes go without their startup time, so it says so once. */
    private var missedStartVisit: Int? = null

    internal fun record() {
        issue.clear()
        recorder.start(::check)
    }

    internal fun check(recording: VoiceRecording) {
        checking = true
        val started = visit.number
        val sent = if (missedStartVisit == started) recording.withoutMicStartup() else recording
        viewModelScope.launch {
            try {
                when (val outcome = grade(sent)) {
                    is GradeOutcome.Graded, GradeOutcome.Obsolete -> {}

                    GradeOutcome.NoSpeech -> {
                        issue.send(started, VoiceIssue.NoSpeech)
                    }

                    GradeOutcome.MissedStart -> {
                        if (visit.number == started) missedStartVisit = started
                        issue.send(started, VoiceIssue.MissedStart)
                    }

                    is GradeOutcome.Limited -> {
                        issue.send(started, VoiceIssue.Limited(outcome.limit))
                    }

                    GradeOutcome.Failed -> {
                        issue.send(started, VoiceIssue.Failed)
                    }
                }
            } finally {
                checking = false
            }
        }
    }

    override fun onCleared() {
        recorder.cancel()
    }
}

sealed interface VoiceIssue {
    data object NoSpeech : VoiceIssue

    data object MissedStart : VoiceIssue

    data object Failed : VoiceIssue

    data class Limited(
        val limit: Limit,
    ) : VoiceIssue
}

/**
 * The take for [key], graded by [grade], shared by its [VoiceAnswerButton] and its [recordNote] wherever each is drawn,
 * so each place that makes it grades it the same way. Wherever the take shows, even only as "The microphone is off",
 * coming back with the microphone allowed gives it back.
 */
@Composable
fun voiceAnswerModel(
    key: String,
    grade: suspend (VoiceRecording) -> GradeOutcome<*>,
): VoiceAnswerModel {
    val context = LocalContext.current
    val model = viewModel(key = key) { VoiceAnswerModel(context, grade, createSavedStateHandle()) }
    LifecycleResumeEffect(model) {
        if (model.recorder.hasPermission) model.microphoneOff = false
        onPauseOrDispose {}
    }
    return model
}

/**
 * The take's Record and Stop, in its screen's bottom bar, with [recordNote] over it saying how it went. With [onBlocked], a denied
 * microphone hands over to the screen's other way to answer instead of showing how to turn it on. A take still running when the
 * screen leaves or the app goes to the background is thrown away.
 */
@Composable
fun VoiceAnswerButton(
    model: VoiceAnswerModel,
    modifier: Modifier = Modifier,
    onRecordTap: () -> Unit = {},
    onBlocked: (() -> Unit)? = null,
) {
    val tapRecord =
        rememberRecordTap(
            recorder = model.recorder,
            onRefused = { lasting ->
                when {
                    onBlocked != null -> onBlocked()
                    lasting -> model.microphoneOff = true
                }
            },
            record = model::record,
        )
    val status by model.recorder.state.collectAsStateWithLifecycle()

    RecordButton(
        status = status,
        onStart = {
            onRecordTap()
            tapRecord()
        },
        onStop = model.recorder::stop,
        modifier = modifier,
        busy = model.checking,
    )
}

@Composable
fun VoiceAnswerLimit(
    model: VoiceAnswerModel,
    navigator: AppNavigator,
    modifier: Modifier = Modifier,
) {
    val status by model.recorder.state.collectAsStateWithLifecycle()
    val issue = model.issue.value.takeUnless { status is VoiceRecorder.Status.Recording }
    if (issue !is VoiceIssue.Limited) return

    LimitNotice(
        issue.limit,
        LimitSubject.Help,
        onCreateAccount = { navigator.open(AppRoute.Login) },
        onSubscribe = { navigator.open(AppRoute.Subscription) },
        modifier = modifier,
    )
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
    onRefused: (lasting: Boolean) -> Unit,
    record: () -> Unit,
    onAllowed: () -> Unit = {},
): () -> Unit {
    val activity = LocalActivity.current
    val currentRecord by rememberUpdatedState(record)
    val currentOnRefused by rememberUpdatedState(onRefused)
    val currentOnAllowed by rememberUpdatedState(onAllowed)
    val permission =
        rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            recorder.endPermissionRequest()
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
    return {
        recorder.clearStartFailure()
        if (recorder.hasPermission) {
            currentRecord()
        } else if (recorder.beginPermissionRequest()) {
            permission.launch(Manifest.permission.RECORD_AUDIO)
        }
    }
}

/**
 * Record while idle; Stop with the take's clock while recording, in the same filled button; [busy] while the take is checked. It
 * stays one button through all three, so TalkBack keeps its focus. In a frame's bar it's the main action, so Enter presses it.
 */
@Composable
fun RecordButton(
    status: VoiceRecorder.Status,
    onStart: () -> Unit,
    onStop: () -> Unit,
    modifier: Modifier = Modifier,
    busy: Boolean = false,
) {
    val recording = status as? VoiceRecorder.Status.Recording
    val held = status == VoiceRecorder.Status.Acquiring || (busy && recording == null)
    val press = if (recording != null) onStop else onStart
    TakeTaskBarKey(TaskBarKey.Main, press.takeUnless { held })
    Button(
        onClick = press,
        modifier = modifier,
        busy = held,
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
        text = formatClock(seconds * MILLIS_PER_SECOND),
        modifier = Modifier.clearAndSetSemantics {},
        color = LocalContentColor.current.copy(alpha = CLOCK_ALPHA),
        style = MaterialTheme.typography.labelLarge.copy(fontFamily = GeistMono),
    )
}

private const val CLOCK_TICK_MS = 250L

private const val CLOCK_ALPHA = 0.7f

/** Inline, beside the step it belongs to; [description] says what the microphone is for here. [titled] is false under a title that already says it. */
@Composable
fun MicrophoneOff(
    description: String,
    modifier: Modifier = Modifier,
    titled: Boolean = true,
) {
    val context = LocalContext.current
    Column(
        modifier = modifier.semantics { liveRegion = LiveRegionMode.Polite },
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        if (titled) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Icon(painterResource(R.drawable.ic_mic_off), contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(stringResource(R.string.audio_microphone_off_title), style = MaterialTheme.typography.titleSmall)
            }
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

private const val MILLIS_PER_SECOND = 1_000L
