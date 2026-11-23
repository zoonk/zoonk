package com.zoonk.android.feature.onboarding.setup

import com.zoonk.android.data.LoadState
import com.zoonk.android.data.recode
import com.zoonk.android.data.value
import com.zoonk.android.feature.questions.Question
import com.zoonk.api.models.Placement
import com.zoonk.api.models.PlacementQuestion
import com.zoonk.api.models.PlacementStatus
import com.zoonk.api.models.TrueFalseLabels

internal sealed interface PlacementPhase {
    data object Loading : PlacementPhase

    data object LoadFailed : PlacementPhase

    data object ChooseLength : PlacementPhase

    data object Waiting : PlacementPhase

    data object Unavailable : PlacementPhase

    data class Question(
        val item: com.zoonk.android.feature.questions.Question,
        val number: Int,
        /** 0 to 1: how much of today's few minutes of questions the answers used. */
        val spent: Double,
        val labels: TrueFalseLabels,
    ) : PlacementPhase

    data object Done : PlacementPhase
}

/** The server's counts can shrink while the plan is still being written: neither a question's number nor the bar goes back. */
internal data class Shown(
    val answered: Int = 0,
    val spent: Double = 0.0,
)

/** Questions already started, then the length choice until the learner taps Start ([started]). */
internal fun placementPhase(
    placement: LoadState<Placement>,
    started: Boolean,
    shown: Shown,
): PlacementPhase {
    if (placement.isPending) return PlacementPhase.Loading
    if (placement is LoadState.Failed) return PlacementPhase.LoadFailed

    val read = placement.value
    val ready = read?.takeIf { it.status == PlacementStatus.ASKING || it.status == PlacementStatus.DONE }

    return when {
        ready != null && (started || ready.started) -> {
            ready.phase(shown)
        }

        !started -> {
            PlacementPhase.ChooseLength
        }

        read?.status == PlacementStatus.UNAVAILABLE -> {
            PlacementPhase.Unavailable
        }

        else -> {
            PlacementPhase.Waiting
        }
    }
}

internal val LoadState<*>.isPending get() = this == LoadState.Idle || this == LoadState.Loading

private fun Placement.phase(shown: Shown): PlacementPhase {
    val answered = maxOf(answered.toInt(), shown.answered)
    val next = next

    return if (next != null && !complete) {
        PlacementPhase.Question(next.item(), number = answered + 1, spent = maxOf(dayBudgetSpent, shown.spent), labels = trueFalseLabels)
    } else {
        PlacementPhase.Done
    }
}

/** Placement asks by taps alone, in the runners' shape so their answer controls take it. */
internal fun PlacementQuestion.item(): Question = recode()
