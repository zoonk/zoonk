package com.zoonk.android.feature.conversation

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.Button
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.livecall.LiveCallFailure
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LimitActions
import com.zoonk.android.ui.components.LimitPeriod
import com.zoonk.android.ui.components.LimitSubject
import com.zoonk.android.ui.components.LimitTier
import com.zoonk.android.ui.components.limitMessage

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
                    modifier = Modifier.barAction(),
                ) { Text(stringResource(R.string.conversation_take_over)) }
            }) {
                ProblemMessage(
                    stringResource(R.string.conversation_in_progress_title),
                    stringResource(R.string.conversation_in_progress),
                )
            }
        }

        failure == LiveCallFailure.Dropped -> {
            // Leaving a dropped call ends it, so what was said still gets its feedback.
            BackHandler(onBack = actions.onEnd)
            Problem(title, actions.onEnd, actions = {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilledTonalButton(onClick = actions.onEnd) { Text(stringResource(R.string.conversation_end_call)) }
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
                    modifier = Modifier.barAction(),
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
        Button(onClick = onClose, modifier = Modifier.barAction()) { Text(stringResource(R.string.navigation_back)) }
    }, content = content)
}

@Composable
private fun Problem(
    title: String,
    onClose: () -> Unit,
    actions: @Composable () -> Unit,
    content: @Composable () -> Unit,
) {
    CallFrame(title = { CallTitle(title) }, onClose = onClose, bottomBar = actions) {
        item(key = "problem") { Box(Modifier.callItem()) { content() } }
    }
}
