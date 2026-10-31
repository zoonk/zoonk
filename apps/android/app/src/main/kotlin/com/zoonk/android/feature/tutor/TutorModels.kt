package com.zoonk.android.feature.tutor

import androidx.compose.runtime.Immutable
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.MutationResult
import com.zoonk.android.feature.memory.MemoryChangeShown
import com.zoonk.android.ui.components.Limit
import com.zoonk.api.models.PlanChange
import com.zoonk.api.models.StudyMissionMoment
import com.zoonk.api.models.TutorToolOffer
import kotlinx.serialization.Contextual
import kotlinx.serialization.Serializable
import java.util.UUID
import kotlin.time.Instant

@Immutable
data class TutorTurn(
    val id: String,
    val question: String,
    val answer: String?,
    val status: Status,
    val createdAt: Instant,
    val about: About,
    val planChange: PlanChange? = null,
    val toolOffer: TutorToolOffer? = null,
) {
    enum class Status { Pending, Running, Completed, Failed }

    enum class About { Answer, Chapter, Item, Lesson, Mock, Plan, Step, Subject }

    val isInProgress: Boolean get() = status == Status.Pending || status == Status.Running
}

/** Oldest first; [nextCursor] reads the page before it. */
@Immutable
data class TutorThread(
    val turns: List<TutorTurn>,
    val hasMore: Boolean,
    val nextCursor: String?,
) {
    internal fun updating(
        id: String,
        change: (TutorTurn) -> TutorTurn,
    ) = copy(turns = turns.map { if (it.id == id) change(it) else it })

    companion object {
        val Empty = TutorThread(emptyList(), hasMore = false, nextCursor = null)
    }
}

internal class AskedQuestion(
    val turn: TutorTurn,
    val missionMoment: StudyMissionMoment?,
)

@Serializable
data class TutorMemoryChange(
    val action: Action,
    val fact: Fact? = null,
    val previous: Fact? = null,
) {
    @Serializable
    enum class Action {
        @kotlinx.serialization.SerialName("added")
        Added,

        @kotlinx.serialization.SerialName("removed")
        Removed,

        @kotlinx.serialization.SerialName("replaced")
        Replaced,
    }

    @Serializable
    data class Fact(
        @Contextual val id: UUID,
        val statement: String,
    )
}

internal val TutorMemoryChange.shown: MemoryChangeShown
    get() = MemoryChangeShown(fact?.id, fact?.statement, previous?.id, previous?.statement)

/** The AI SDK UI message stream's parts the conversation reads. */
internal sealed interface TutorAnswerEvent {
    data class Text(
        val delta: String,
    ) : TutorAnswerEvent

    /** Its links are checked; it replaces the streamed text. */
    data class SavedAnswer(
        val answer: String,
    ) : TutorAnswerEvent

    data class Proposed(
        val change: PlanChange,
    ) : TutorAnswerEvent

    /** Earlier proposals of the conversation the new one replaced. */
    data class Replaced(
        val ids: List<String>,
    ) : TutorAnswerEvent

    data class Offered(
        val offer: TutorToolOffer,
    ) : TutorAnswerEvent

    data class Remembered(
        val changes: List<TutorMemoryChange>,
    ) : TutorAnswerEvent

    /** The answer is saved; memory changes may still follow. */
    data object Finish : TutorAnswerEvent
}

@Immutable
sealed interface TutorFailure {
    /** A help limit takes the composer's place; a slow-down only asks to wait. */
    data class Refused(
        val limit: Limit,
    ) : TutorFailure

    data object PlusRequired : TutorFailure

    data object Gone : TutorFailure

    data object Invalid : TutorFailure

    data object SignedOut : TutorFailure

    data object Failed : TutorFailure
}

internal val TutorFailure.helpLimit: Limit?
    get() = (this as? TutorFailure.Refused)?.limit?.takeUnless { it is Limit.SlowDown }

internal fun ApiException.toTutorFailure(): TutorFailure = failure(Limit.of(this), error, status)

internal fun MutationResult.Failed.toTutorFailure(): TutorFailure = failure(Limit.of(this), error, status)

private fun failure(
    limit: Limit?,
    error: ApiError,
    status: Int?,
): TutorFailure =
    when {
        limit != null -> TutorFailure.Refused(limit)
        status == PAYMENT_REQUIRED -> TutorFailure.PlusRequired
        error == ApiError.Unauthorized -> TutorFailure.SignedOut
        error == ApiError.NotFound -> TutorFailure.Gone
        status == BAD_REQUEST || status == UNPROCESSABLE -> TutorFailure.Invalid
        else -> TutorFailure.Failed
    }

internal const val CONFLICT = 409
private const val BAD_REQUEST = 400
private const val PAYMENT_REQUIRED = 402
private const val UNPROCESSABLE = 422
