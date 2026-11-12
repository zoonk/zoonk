package com.zoonk.android.feature.onboarding.setup

import com.zoonk.android.data.LoadState
import com.zoonk.android.data.value
import com.zoonk.api.models.LessonVisual
import com.zoonk.api.models.Placement
import com.zoonk.api.models.PlacementQuestion
import com.zoonk.api.models.PlacementStatus
import com.zoonk.api.models.QuestionImage
import com.zoonk.api.models.TrueFalseLabels

internal sealed interface PlacementFormat {
    data class Choice(
        val options: List<String>,
    ) : PlacementFormat

    data object TrueFalse : PlacementFormat

    data object Typed : PlacementFormat
}

internal data class PlacementItem(
    val itemId: String,
    val question: String,
    val context: String?,
    val image: QuestionImage?,
    val visual: LessonVisual?,
    val format: PlacementFormat,
)

internal sealed interface PlacementPhase {
    data object Loading : PlacementPhase

    data object LoadFailed : PlacementPhase

    data object Intro : PlacementPhase

    data object Waiting : PlacementPhase

    data object Unavailable : PlacementPhase

    data class Question(
        val item: PlacementItem,
        val number: Int,
        /** 0 to 1: how much of today's few minutes of questions the answers used. */
        val spent: Double,
        val labels: TrueFalseLabels,
    ) : PlacementPhase

    data class Done(
        val answered: Int,
        val forToday: Boolean,
    ) : PlacementPhase
}

/** The server's counts can shrink while the plan is still being written: neither a question's number nor the bar goes back. */
internal data class Shown(
    val answered: Int = 0,
    val spent: Double = 0.0,
)

/** Questions already started, then the intro until the learner taps Start ([started]). */
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
            PlacementPhase.Intro
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
        PlacementPhase.Done(answered, forToday = dayBudgetUsed)
    }
}

internal fun PlacementQuestion.item(): PlacementItem =
    when (this) {
        is PlacementQuestion.BankQuestionOneOfValue -> {
            PlacementItem(
                value.itemId.toString(),
                value.question,
                value.context,
                value.image,
                value.visual,
                PlacementFormat.Choice(value.options),
            )
        }

        is PlacementQuestion.BankQuestionOneOf1Value -> {
            PlacementItem(value.itemId.toString(), value.question, value.context, value.image, value.visual, PlacementFormat.TrueFalse)
        }

        is PlacementQuestion.PlacementQuestionOneOfValue -> {
            PlacementItem(value.itemId.toString(), value.question, value.context, value.image, value.visual, PlacementFormat.Typed)
        }
    }
