package com.zoonk.android.feature.conversation

import androidx.compose.foundation.layout.Box
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import com.zoonk.android.R
import com.zoonk.android.data.AnalyticsEvent
import com.zoonk.android.data.TrackShown
import com.zoonk.android.feature.livecall.LiveCallFailure
import com.zoonk.android.feature.subscription.SubscribeGate
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LimitNotice
import com.zoonk.android.ui.components.LimitPeriod
import com.zoonk.android.ui.components.LimitSubject
import com.zoonk.android.ui.components.LimitTier
import com.zoonk.android.ui.components.comesBackLine
import com.zoonk.android.ui.components.hasWayOn
import com.zoonk.android.ui.components.limitLifted
import com.zoonk.android.ui.components.limitWords
import com.zoonk.android.ui.components.needsAccount

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
    val onCreateAccount: () -> Unit,
    val onSubscribe: () -> Unit,
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
            val lifted = limitLifted(limit)
            val (label, onClick) =
                when {
                    lifted -> R.string.conversation_try_again to actions.onRetry
                    limit.needsAccount -> R.string.limit_create_account to actions.onCreateAccount
                    limit.hasWayOn -> R.string.subscription_subscribe to actions.onSubscribe
                    else -> R.string.navigation_back to actions.onClose
                }
            // One call site whatever the action, so the message keeps its held title room when the day comes.
            Problem(title, actions.onClose, actions = {
                if (!lifted && limit.hasWayOn && !limit.needsAccount) TrackShown(AnalyticsEvent.SubscriptionGateShown)
                Button(onClick = onClick, modifier = Modifier.barAction()) { Text(stringResource(label)) }
            }) { CallLimitMessage(limit, actions.onCreateAccount, actions.onSubscribe, inBar = true) }
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
    onSubscribe: () -> Unit,
    modifier: Modifier = Modifier,
    inBar: Boolean = false,
) {
    if (!inBar) {
        LimitNotice(limit, LimitSubject.Calls, onCreateAccount, onSubscribe, modifier)
        return
    }
    CallOffMessage(callLimitTitle(limit), modifier) {
        comesBackLine(limit)?.let {
            Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyLarge)
        }
    }
}

/** A language plan's challenge call a free learner tried, in place under its result. */
@Composable
internal fun ChallengeCallGate(onSubscribe: () -> Unit) {
    TrackShown(AnalyticsEvent.SubscriptionGateShown)
    SubscribeGate(
        stringResource(R.string.conversation_challenge_gate_title),
        onSubscribe,
        line = stringResource(R.string.conversation_challenge_gate_line),
    )
}

/** What ran out, or none once its day has come. */
@Composable
internal fun callLimitTitle(limit: Limit.Reached): String? = limitWords(limit, LimitSubject.Calls).title

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
    CallFrame(title = { CallTitle(title) }, onClose = onClose, bottomBar = actions, lonePage = true) {
        item(key = "problem") { Box(Modifier.callItem()) { content() } }
    }
}
