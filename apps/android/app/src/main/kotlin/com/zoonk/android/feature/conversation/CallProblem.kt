package com.zoonk.android.feature.conversation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.livecall.LiveCallFailure
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LimitActions
import com.zoonk.android.ui.components.LimitPeriod
import com.zoonk.android.ui.components.LimitSubject
import com.zoonk.android.ui.components.LimitTier
import com.zoonk.android.ui.components.limitMessage
import kotlinx.coroutines.delay

/** Why a call stopped before its result: a failure, or a save the server refused. */
sealed interface CallProblemKind {
    data class Failed(
        val failure: LiveCallFailure,
        val limit: Limit.Reached?,
    ) : CallProblemKind

    data object TakenOver : CallProblemKind

    data object SaveEnded : CallProblemKind
}

internal class CallProblemActions(
    val onClose: () -> Unit,
    val onRetry: () -> Unit,
    val onTakeover: () -> Unit,
    val onEnd: () -> Unit,
    val onCreateAccount: () -> Unit,
    val onSeePlus: () -> Unit,
)

/** Main's `CallProblem`: what happened, in the learner's words, with the one way on. */
@Composable
internal fun CallProblem(
    kind: CallProblemKind,
    title: String,
    actions: CallProblemActions,
) {
    val failure = (kind as? CallProblemKind.Failed)?.failure
    when {
        failure == LiveCallFailure.Limit -> {
            val limit = kind.limit ?: Limit.Reached(LimitTier.Plus, LimitPeriod.Day)
            ProblemWithBack(title, actions.onClose) {
                CallLimitMessage(limit, actions.onCreateAccount, actions.onSeePlus)
            }
        }

        kind == CallProblemKind.TakenOver || kind == CallProblemKind.SaveEnded || failure == LiveCallFailure.Ended -> {
            val text = if (kind == CallProblemKind.TakenOver) R.string.conversation_taken_over else R.string.conversation_ended
            ProblemWithBack(
                title,
                actions.onClose,
            ) { ProblemMessage(stringResource(R.string.conversation_ended_title), stringResource(text)) }
        }

        failure == LiveCallFailure.CallsPaused -> {
            ProblemWithBack(title, actions.onClose) {
                ProblemMessage(stringResource(R.string.conversation_paused_title), stringResource(R.string.conversation_paused))
            }
        }

        failure == LiveCallFailure.CallInProgress -> {
            Problem(title, actions.onClose, actions = {
                Button(
                    onClick = actions.onTakeover,
                    modifier = Modifier.fillMaxWidth(),
                ) { Text(stringResource(R.string.conversation_take_over)) }
            }) {
                ProblemMessage(
                    stringResource(R.string.conversation_in_progress_title),
                    stringResource(R.string.conversation_in_progress),
                )
            }
        }

        failure == LiveCallFailure.Dropped -> {
            Problem(title, actions.onEnd, actions = {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = actions.onEnd) { Text(stringResource(R.string.conversation_end_call)) }
                    Button(
                        onClick = actions.onRetry,
                        modifier = Modifier.weight(1f),
                    ) { Text(stringResource(R.string.conversation_call_again)) }
                }
            }) { ProblemMessage(stringResource(R.string.conversation_dropped_title), stringResource(R.string.conversation_dropped)) }
        }

        else -> {
            Problem(title, actions.onClose, actions = {
                Button(
                    onClick = actions.onRetry,
                    modifier = Modifier.fillMaxWidth(),
                ) { Text(stringResource(R.string.conversation_try_again)) }
            }) {
                ProblemMessage(
                    stringResource(R.string.conversation_not_connected_title),
                    stringResource(R.string.conversation_not_connected),
                )
            }
        }
    }
}

/** Never says how much call time a plan has. */
@Composable
internal fun CallLimitMessage(
    limit: Limit.Reached,
    onCreateAccount: () -> Unit,
    onSeePlus: () -> Unit,
    modifier: Modifier = Modifier,
    title: String? = null,
) {
    val heading =
        title ?: stringResource(
            when (limit.period) {
                LimitPeriod.Month -> R.string.conversation_no_calls_month
                LimitPeriod.Total -> R.string.conversation_calls_need_account
                else -> R.string.conversation_no_calls_today
            },
        )
    CallOffMessage(heading, modifier) {
        Text(
            limitMessage(limit, LimitSubject.Calls),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyLarge,
        )
        LimitActions(limit, onCreateAccount, onSeePlus)
    }
}

@Composable
private fun ProblemMessage(
    title: String,
    text: String,
) {
    CallOffMessage(title) {
        Text(text, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyLarge)
    }
}

@Composable
private fun ProblemWithBack(
    title: String,
    onClose: () -> Unit,
    content: @Composable () -> Unit,
) {
    Problem(title, onClose, actions = {
        Button(onClick = onClose, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.navigation_back)) }
    }, content = content)
}

@Composable
private fun Problem(
    title: String,
    onClose: () -> Unit,
    actions: @Composable () -> Unit,
    content: @Composable () -> Unit,
) {
    CallFrame(title = title, onClose = onClose, bottomBar = actions) {
        item(key = "problem") { Box(Modifier.callItem()) { content() } }
    }
}

/** A call's feedback takes a few seconds, an exam's grade 13 to 33 s (about 23 for most). */
@Composable
internal fun SavingCall(
    save: CallSave,
    grading: Boolean,
    title: String,
    onRetry: () -> Unit,
    onClose: () -> Unit,
) {
    if (save == CallSave.Saving) {
        val slow by produceState(false) {
            delay(if (grading) SLOW_GRADE_MS else SLOW_FEEDBACK_MS)
            value = true
        }
        val line =
            when {
                grading && slow -> R.string.conversation_rating_slow
                grading -> R.string.conversation_rating
                slow -> R.string.conversation_writing_feedback_slow
                else -> R.string.conversation_writing_feedback
            }
        CallFrame(title = title, onClose = onClose) {
            item(key = "saving") {
                Row(
                    Modifier.callItem().semantics(mergeDescendants = true) { liveRegion = LiveRegionMode.Polite },
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                    Text(
                        stringResource(line),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodyLarge,
                    )
                }
            }
        }
        return
    }

    val message = if (save == CallSave.Closing) R.string.conversation_still_closing else R.string.conversation_save_failed
    CallFrame(title = title, onClose = onClose, bottomBar = {
        Button(onClick = onRetry, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.conversation_try_again)) }
    }) {
        item(key = "failed") {
            Text(
                stringResource(message),
                Modifier.callItem().semantics {
                    liveRegion = LiveRegionMode.Polite
                },
                style = MaterialTheme.typography.bodyLarge,
            )
        }
    }
}

private const val SLOW_FEEDBACK_MS = 20_000L
private const val SLOW_GRADE_MS = 45_000L
