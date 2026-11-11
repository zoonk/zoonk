package com.zoonk.android.feature.focustest

import com.zoonk.android.data.LoadState
import com.zoonk.android.data.value
import com.zoonk.android.feature.onboarding.setup.PlacementItem
import com.zoonk.android.feature.onboarding.setup.isPending
import com.zoonk.android.feature.onboarding.setup.item
import com.zoonk.api.models.FocusTest
import com.zoonk.api.models.FocusTestSitting
import com.zoonk.api.models.Placement
import com.zoonk.api.models.PlacementStatus
import com.zoonk.api.models.TrueFalseLabels

/** What Start or Continue the test opens: its count and its time, said before the tap. */
internal data class NextSitting(
    val questions: Int,
    val minutes: Int,
    val pastCeiling: Int,
)

/** A sitting closed in this visit, shown as its result until the learner moves on. */
internal data class Closed(
    val test: FocusTest,
    val end: FocusTestSitting.End?,
)

internal sealed interface FocusTestPhase {
    data object Loading : FocusTestPhase

    data object LoadFailed : FocusTestPhase

    data object Unavailable : FocusTestPhase

    /** [answered]: the learner has test answers, so leaving the wait uses them. */
    data class Waiting(
        val answered: Boolean,
    ) : FocusTestPhase

    data class Invitation(
        val test: FocusTest,
        val next: NextSitting,
    ) : FocusTestPhase

    data class Resume(
        val question: Question,
    ) : FocusTestPhase

    data class Question(
        val item: PlacementItem,
        val sitting: FocusTestSitting,
        val labels: TrueFalseLabels,
    ) : FocusTestPhase

    /** A sitting that's over and not closed yet: the learner came back to it, or closing it failed. */
    data class Ended(
        val end: FocusTestSitting.End?,
    ) : FocusTestPhase

    data class Checkpoint(
        val test: FocusTest,
        val end: FocusTestSitting.End?,
    ) : FocusTestPhase
}

/** A sitting opened and left before its first answer is offered again, with its own numbers. */
internal fun nextSitting(test: FocusTest): NextSitting? {
    test.offer?.let { return NextSitting(it.questions.toInt(), it.minutes.toInt(), it.pastCeiling.toInt()) }
    val sitting = test.sitting ?: return null
    return if (sitting.answered == 0L && sitting.left > 0) NextSitting(sitting.questions.toInt(), sitting.minutes.toInt(), 0) else null
}

/** The test's result, or else what it offers; null when there's neither. */
private fun resting(test: FocusTest): FocusTestPhase? {
    if (test.checkpoint != null) return FocusTestPhase.Checkpoint(test, end = null)
    return nextSitting(test)?.let { FocusTestPhase.Invitation(test, it) }
}

/**
 * Until the learner [entered] the test in this visit, opening it never drops them into a question:
 * a sitting with answers shows its resume screen, and one without is offered again. A sitting
 * [closed] in this visit shows its result. A test with no result and nothing to ask is unavailable.
 * A read that never came back is [FocusTestPhase.LoadFailed], never the questions' wait.
 */
internal fun focusTestPhase(
    placement: LoadState<Placement>,
    entered: Boolean,
    closed: Closed?,
): FocusTestPhase {
    if (closed != null) return FocusTestPhase.Checkpoint(closed.test, closed.end)
    if (placement.isPending) return FocusTestPhase.Loading
    if (placement is LoadState.Failed) return FocusTestPhase.LoadFailed

    val read = placement.value
    if (read?.status == PlacementStatus.UNAVAILABLE) return FocusTestPhase.Unavailable
    val test = read?.focusTest

    if (read == null || (read.status != PlacementStatus.ASKING && read.status != PlacementStatus.DONE)) {
        val shown = test?.takeIf { !entered && it.sitting == null }?.let(::resting)
        return shown ?: FocusTestPhase.Waiting(answered = test?.checkpoint != null)
    }

    test ?: return FocusTestPhase.Unavailable
    val sitting = test.sitting ?: return resting(test) ?: FocusTestPhase.Unavailable
    val next = read.next ?: return FocusTestPhase.Ended(sitting.end)
    val question = FocusTestPhase.Question(next.item(), sitting, read.trueFalseLabels)

    return when {
        entered -> question
        sitting.answered > 0 -> FocusTestPhase.Resume(question)
        else -> resting(test) ?: question
    }
}

/** A read whose open sitting has nothing more to ask, which completion closes. */
internal fun Placement.sittingOver(): FocusTestSitting? =
    focusTest?.sitting?.takeIf { next == null && (status == PlacementStatus.ASKING || status == PlacementStatus.DONE) }
