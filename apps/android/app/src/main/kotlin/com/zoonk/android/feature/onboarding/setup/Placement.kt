package com.zoonk.android.feature.onboarding.setup

import com.zoonk.android.data.LoadState
import com.zoonk.android.data.value
import com.zoonk.api.models.LessonVisual
import com.zoonk.api.models.MockOptions
import com.zoonk.api.models.MockOptionsPlacementMock
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

internal data class MockOffer(
    val shortestMinutes: Long,
    val longestMinutes: Long,
    val plusRequired: Boolean,
)

internal sealed interface PlacementPhase {
    data object Loading : PlacementPhase

    data class Intro(
        val mock: MockOffer?,
    ) : PlacementPhase

    data object Waiting : PlacementPhase

    data object Unavailable : PlacementPhase

    data class Question(
        val item: PlacementItem,
        val number: Int,
        /** 0 to 1: how much of today's few minutes of questions the answers used. */
        val spent: Double,
        val labels: TrueFalseLabels,
    ) : PlacementPhase

    data class MockRunning(
        val mockId: String,
    ) : PlacementPhase

    data class Done(
        val answered: Int,
        val forToday: Boolean,
        val fromMock: Boolean,
    ) : PlacementPhase
}

/** The server's counts can shrink while the plan is still being written: neither a question's number nor the bar goes back. */
internal data class Shown(
    val answered: Int = 0,
    val spent: Double = 0.0,
)

/**
 * Main's `toResumedPhase`: a mock exam taken instead of the questions wins, then questions already
 * started, then the intro until the learner taps Start ([started]).
 */
internal fun placementPhase(
    placement: LoadState<Placement>,
    mocks: LoadState<MockOptions>,
    started: Boolean,
    shown: Shown,
): PlacementPhase {
    if (placement.isPending || mocks.isPending) return PlacementPhase.Loading

    val options = mocks.value
    val mock = options?.placement?.mock
    val read = placement.value
    val ready = read?.takeIf { it.status == PlacementStatus.ASKING || it.status == PlacementStatus.DONE }

    return when {
        mock?.status == MockOptionsPlacementMock.Status.RUNNING -> {
            PlacementPhase.MockRunning(mock.id.toString())
        }

        mock?.status == MockOptionsPlacementMock.Status.FINISHED -> {
            PlacementPhase.Done(answered = ready?.answered?.toInt() ?: 0, forToday = false, fromMock = true)
        }

        ready != null && (started || ready.started) -> {
            ready.phase(shown)
        }

        !started -> {
            PlacementPhase.Intro(options?.mockOffer())
        }

        read?.status == PlacementStatus.UNAVAILABLE -> {
            PlacementPhase.Unavailable
        }

        else -> {
            PlacementPhase.Waiting
        }
    }
}

private val LoadState<*>.isPending get() = this == LoadState.Idle || this == LoadState.Loading

private fun Placement.phase(shown: Shown): PlacementPhase {
    val answered = maxOf(answered.toInt(), shown.answered)
    val next = next

    return if (next != null && !complete) {
        PlacementPhase.Question(next.item(), number = answered + 1, spent = maxOf(dayBudgetSpent, shown.spent), labels = trueFalseLabels)
    } else {
        PlacementPhase.Done(answered, forToday = dayBudgetUsed, fromMock = false)
    }
}

private fun MockOptions.mockOffer(): MockOffer? {
    val lengths = placement?.options.orEmpty()
    val shortest = lengths.firstOrNull() ?: return null
    val longest = lengths.last()
    return MockOffer(shortest.estimatedMinutes, longest.estimatedMinutes, plusRequired = access == MockOptions.Access.PLUS_REQUIRED)
}

private fun PlacementQuestion.item(): PlacementItem =
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
