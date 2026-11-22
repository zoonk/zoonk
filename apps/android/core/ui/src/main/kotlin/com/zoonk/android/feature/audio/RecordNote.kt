package com.zoonk.android.feature.audio

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.zoonk.android.R
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.VisitOf
import com.zoonk.android.ui.components.LimitNotice
import com.zoonk.android.ui.components.LimitSubject
import kotlinx.coroutines.delay

/**
 * Main's `RecordNote` for [model]'s take, the bar's note right over its Record. This is where the take's screen composes it, so it
 * also stands for the take's visit there. A limit shows here with its way on when [navigator] is given; without it, the screen's
 * column shows it ([VoiceAnswerLimit]).
 */
@Composable
fun recordNote(
    model: VoiceAnswerModel,
    navigator: AppNavigator? = null,
): (@Composable () -> Unit)? {
    VisitOf(model.visit)
    val status by model.recorder.state.collectAsStateWithLifecycle()
    return recordNote(status is VoiceRecorder.Status.Recording, model.checking, model.issue.value, navigator)
}

/**
 * Main's `RecordNote`, the one line over a screen's Record in its bottom bar, read out by the bar's note as it changes: how to start, that it's listening, what went wrong,
 * or that the check is slow. Nothing while a take is checked in good time: Record or Check shows busy for that.
 */
@Composable
fun recordNote(
    recording: Boolean,
    checking: Boolean,
    issue: VoiceIssue?,
    navigator: AppNavigator? = null,
): (@Composable () -> Unit)? {
    val check = checkNote(checking, failed = !recording && issue == VoiceIssue.Failed)
    return when {
        recording -> ({ ListeningLine() })
        checking || issue == VoiceIssue.Failed -> check
        issue == VoiceIssue.NoSpeech -> ({ NoteLine(stringResource(R.string.audio_no_speech), wrong = true) })
        issue is VoiceIssue.Limited -> navigator?.let { ({ LimitNote(issue, it) }) }
        else -> ({ NoteLine(stringResource(R.string.audio_say_it)) })
    }
}

/**
 * Main's lesson check line in the bar's note, for any answer the server checks: a [failed] check, or one still [checking] past
 * the lesson's slow bound. Nothing before then.
 */
@Composable
fun checkNote(
    checking: Boolean,
    failed: Boolean,
): (@Composable () -> Unit)? {
    val slow by produceState(false, checking) {
        value = false
        if (checking) {
            delay(SLOW_CHECK_MS)
            value = true
        }
    }
    return when {
        failed -> ({ NoteLine(stringResource(R.string.audio_check_failed), wrong = true) })
        checking && slow -> ({ NoteLine(stringResource(R.string.audio_checking_slow)) })
        else -> null
    }
}

/** TalkBack reading it would speak into the take, so it stays out of what TalkBack reads, as main's `aria-hidden` line does. */
@Composable
private fun ListeningLine() {
    Text(stringResource(R.string.audio_listening), Modifier.clearAndSetSemantics {}, color = MaterialTheme.colorScheme.onSurfaceVariant)
}

@Composable
private fun NoteLine(
    text: String,
    wrong: Boolean = false,
) {
    Text(
        text = text,
        color = if (wrong) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
    )
}

@Composable
private fun LimitNote(
    issue: VoiceIssue.Limited,
    navigator: AppNavigator,
) {
    LimitNotice(
        issue.limit,
        LimitSubject.Help,
        onCreateAccount = { navigator.open(AppRoute.Login) },
        onSubscribe = { navigator.open(AppRoute.Subscription) },
    )
}

/** Main's `CHECK_BOUNDS.slowMs`. */
private const val SLOW_CHECK_MS = 15_000L
