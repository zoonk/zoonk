package com.zoonk.android.feature.placementtest

import com.zoonk.android.data.LoadState
import com.zoonk.android.data.value
import com.zoonk.android.feature.onboarding.setup.isPending
import com.zoonk.android.feature.onboarding.setup.item
import com.zoonk.api.models.Placement
import com.zoonk.api.models.PlacementAttempt
import com.zoonk.api.models.PlacementLength
import com.zoonk.api.models.PlacementStatus
import com.zoonk.api.models.TrueFalseLabels
import java.util.UUID
import com.zoonk.android.feature.questions.Question as ItemQuestion

/** Main's `PlacementTestPhase`: where a read of the test taken from the plan leaves the learner. */
internal sealed interface PlacementTestPhase {
    data object Loading : PlacementTestPhase

    data object LoadFailed : PlacementTestPhase

    /** No test is open: the learner chooses how much to check. */
    data object Choose : PlacementTestPhase

    /** The open test's questions are still being written. */
    data object Waiting : PlacementTestPhase

    /** [progress]: 0 to 1, of this part. */
    data class Question(
        val item: ItemQuestion,
        val attempt: PlacementAttempt,
        val answered: Int,
        val progress: Double,
        val labels: TrueFalseLabels,
    ) : PlacementTestPhase

    /** This part asks nothing more and isn't closed yet: closing it is the next save. */
    data class PartOver(
        val attempt: PlacementAttempt,
    ) : PlacementTestPhase

    /** A whole-course test between two parts; [lessonsSkipped] is the part that just closed, null when it closed earlier. */
    data class Between(
        val attempt: PlacementAttempt,
        val lessonsSkipped: Int?,
        val changeId: UUID? = null,
    ) : PlacementTestPhase

    data class Result(
        val length: PlacementLength,
        val lessonsSkipped: Int,
        val changeId: UUID? = null,
        val attemptId: UUID? = null,
    ) : PlacementTestPhase
}

/**
 * With no test open, the learner chooses how much to check; an open one goes on where it stopped,
 * once its questions are written. A part [closed] in this visit shows what it did until the learner
 * moves on.
 */
internal fun placementTestPhase(
    placement: LoadState<Placement>,
    closed: PlacementTestPhase?,
): PlacementTestPhase {
    if (closed != null) return closed
    if (placement.isPending) return PlacementTestPhase.Loading
    if (placement is LoadState.Failed) return PlacementTestPhase.LoadFailed

    val read = placement.value
    val attempt = read?.attempt ?: return PlacementTestPhase.Choose
    if (attempt.partComplete) return PlacementTestPhase.Between(attempt, lessonsSkipped = null)
    if (!read.isReady) return PlacementTestPhase.Waiting

    val next = read.next ?: return PlacementTestPhase.PartOver(attempt)
    return PlacementTestPhase.Question(next.item(), attempt, read.answered.toInt(), read.dayBudgetSpent, read.trueFalseLabels)
}

private val Placement.isReady
    get() = status == PlacementStatus.ASKING || status == PlacementStatus.DONE || status == PlacementStatus.UNAVAILABLE

/** An open part with nothing more to ask, which closing applies. */
internal fun Placement.partOver(): PlacementAttempt? = attempt?.takeIf { !it.partComplete && isReady && next == null }
