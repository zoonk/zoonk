package com.zoonk.android.feature.checkpoint

import com.zoonk.android.feature.session.ownBrainPower
import com.zoonk.api.models.Checkpoint
import com.zoonk.api.models.CheckpointPhase

/** Main's `getResultRows`: the rows beside a result. Its Brain Power is the score's readout, as at every task's end, never a row. */
internal data class ResultRows(
    val badge: Boolean,
    val nextPhase: CheckpointPhase?,
    val phaseComplete: Boolean,
    val retry: Checkpoint.Retry?,
) {
    val isEmpty: Boolean get() = !badge && !phaseComplete && retry == null && nextPhase == null
}

internal fun resultRows(
    duel: Duel,
    won: Boolean,
): ResultRows {
    val checkpoint = duel.read.checkpoint
    val reward = checkpoint.reward

    return if (won) {
        ResultRows(
            badge = reward.badge,
            nextPhase = checkpoint.nextPhase?.takeIf { reward.phaseComplete && duel.read.isBoss },
            phaseComplete = reward.phaseComplete,
            retry = null,
        )
    } else {
        ResultRows(
            badge = false,
            nextPhase = checkpoint.nextPhase?.takeIf { checkpoint.retry != Checkpoint.Retry.PASSED },
            phaseComplete = false,
            retry = if (duel.state.completion != null) Checkpoint.Retry.TOMORROW else checkpoint.retry,
        )
    }
}

/** A result reopened later has no completion: a win shows its prize, a loss nothing. */
internal fun earnedBrainPower(
    duel: Duel,
    won: Boolean,
): Long = duel.state.completion?.ownBrainPower ?: if (won) duel.read.checkpoint.reward.brainPower else 0
