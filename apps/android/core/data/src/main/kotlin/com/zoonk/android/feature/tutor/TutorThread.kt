package com.zoonk.android.feature.tutor

import androidx.compose.runtime.Immutable
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
    fun updating(
        id: String,
        change: (TutorTurn) -> TutorTurn,
    ) = copy(turns = turns.map { if (it.id == id) change(it) else it })

    companion object {
        val Empty = TutorThread(emptyList(), hasMore = false, nextCursor = null)
    }
}

class AskedQuestion(
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

/** The AI SDK UI message stream's parts the conversation reads. */
sealed interface TutorAnswerEvent {
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
