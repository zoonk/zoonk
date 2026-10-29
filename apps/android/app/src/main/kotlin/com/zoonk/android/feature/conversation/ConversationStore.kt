package com.zoonk.android.feature.conversation

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.perform
import com.zoonk.android.data.recode
import com.zoonk.android.feature.livecall.CallReservation
import com.zoonk.android.ui.components.Limit
import com.zoonk.api.models.CompletedLanguageConversation
import com.zoonk.api.models.LanguageCheckpointCall
import com.zoonk.api.models.LanguageConversation
import com.zoonk.api.models.LanguageConversationCompletionInput
import com.zoonk.api.models.LanguageConversationStartInput
import com.zoonk.api.models.LanguageConversationStartInputOneOf
import com.zoonk.api.models.LanguageConversationStartInputOneOf1
import com.zoonk.api.models.LanguageConversationStartInputOneOf2
import com.zoonk.api.models.LanguageConversationStartInputOneOf3
import java.util.UUID

/** The calls a learner starts, each from a tap: a unit's practice call, a checkpoint's, a speaking mock and an exam task. */
sealed interface CallRequest {
    val input: LanguageConversationStartInput

    data class Practice(
        val chapterId: UUID,
        val goalId: UUID?,
        val minutes: Long,
    ) : CallRequest {
        override val input
            get() =
                LanguageConversationStartInput.LanguageConversationStartInputOneOfValue(
                    LanguageConversationStartInputOneOf(
                        chapterId = chapterId,
                        kind = LanguageConversationStartInputOneOf.Kind.PRACTICE,
                        minutes = LanguageConversationStartInputOneOf.Minutes.entries.first { it.value == minutes.toDouble() },
                        goalId = goalId,
                    ),
                )
    }

    data class Checkpoint(
        val blockId: UUID,
    ) : CallRequest {
        override val input
            get() =
                LanguageConversationStartInput.LanguageConversationStartInputOneOf1Value(
                    LanguageConversationStartInputOneOf1(blockId, LanguageConversationStartInputOneOf1.Kind.CHECKPOINT),
                )
    }

    data class SpeakingMock(
        val goalId: UUID,
    ) : CallRequest {
        override val input
            get() =
                LanguageConversationStartInput.LanguageConversationStartInputOneOf2Value(
                    LanguageConversationStartInputOneOf2(goalId, LanguageConversationStartInputOneOf2.Kind.SPEAKING_MOCK),
                )
    }

    data class ExamSpeaking(
        val goalId: UUID,
        val task: String,
    ) : CallRequest {
        override val input
            get() =
                LanguageConversationStartInput.LanguageConversationStartInputOneOf3Value(
                    LanguageConversationStartInputOneOf3(goalId, LanguageConversationStartInputOneOf3.Kind.EXAM_SPEAKING, task),
                )
    }
}

sealed interface CallStart {
    data class Started(
        val conversationId: UUID,
    ) : CallStart

    data class Limited(
        val limit: Limit.Reached,
    ) : CallStart

    data object Failed : CallStart
}

/** A checkpoint call's start, read as main's `startCheckpointCallAction` reads it: only [Failed] is worth another try. */
sealed interface CheckpointStart {
    data class Started(
        val conversationId: UUID,
    ) : CheckpointStart

    data object PlusRequired : CheckpointStart

    /** The day moved on meanwhile (done, earlier blocks first, time used up): read the checkpoint again. */
    data object Changed : CheckpointStart

    data object Failed : CheckpointStart
}

sealed interface CallCompletion {
    data class Completed(
        val conversation: CompletedLanguageConversation,
    ) : CallCompletion

    data object Ended : CallCompletion

    data object TakenOver : CallCompletion

    data object Failed : CallCompletion
}

/** The public API's conversation operations. */
interface ConversationApi {
    /** Null when there's no call to show (main's not-found). */
    suspend fun conversation(
        session: AuthenticatedSession?,
        id: UUID,
    ): LanguageConversation?

    /** What a checkpoint's call is now: its intro, being prepared, ready, or not a call at all. */
    suspend fun checkpointCall(
        session: AuthenticatedSession?,
        blockId: UUID,
    ): LanguageCheckpointCall

    /** Writes the call when it isn't written yet: it runs AI, so only on the learner's tap. */
    suspend fun start(
        session: AuthenticatedSession,
        request: CallRequest,
    ): UUID

    suspend fun complete(
        session: AuthenticatedSession,
        id: UUID,
        input: LanguageConversationCompletionInput,
    ): CompletedLanguageConversation
}

class LiveConversationApi(
    private val api: ApiClients,
) : ConversationApi {
    override suspend fun conversation(
        session: AuthenticatedSession?,
        id: UUID,
    ): LanguageConversation? =
        try {
            perform { api.clients(session).language.getLanguageConversation(id) }
        } catch (e: ApiException) {
            // A conversation that isn't a call (422) is as missing as one that isn't there.
            if (e.status == UNPROCESSABLE) null else throw e
        }

    override suspend fun checkpointCall(
        session: AuthenticatedSession?,
        blockId: UUID,
    ) = perform { api.clients(session).language.getLanguageCheckpointCall(blockId) }

    override suspend fun start(
        session: AuthenticatedSession,
        request: CallRequest,
    ) = perform { api.streamingClients(session).language.startLanguageConversation(request.input) }.conversationId

    override suspend fun complete(
        session: AuthenticatedSession,
        id: UUID,
        input: LanguageConversationCompletionInput,
    ) = perform { api.streamingClients(session).language.completeLanguageConversation(id, input) }

    private companion object {
        const val UNPROCESSABLE = 422
    }
}

private val CHANGED = setOf("BLOCK_FINISHED", "DAILY_LIMIT_REACHED", "EARLIER_FIRST", "NOT_LANGUAGE")

class ConversationStore(
    private val api: ConversationApi,
    private val cache: AppCache,
) {
    private val conversations =
        cache.keyed<UUID, LanguageConversation>(Audience.SignedIn, setOf(DataDomain.UserProgress)) { session, id ->
            api.conversation(session, id)
        }

    private val checkpointCalls =
        cache.keyed<UUID, LanguageCheckpointCall>(Audience.SignedIn, setOf(DataDomain.UserProgress)) { session, blockId ->
            api.checkpointCall(session, blockId)
        }

    fun conversation(id: UUID) = conversations[id]

    fun checkpointCall(blockId: UUID) = checkpointCalls[blockId]

    suspend fun startCheckpoint(blockId: UUID): CheckpointStart =
        when (val started = cache.mutate { session -> api.start(session, CallRequest.Checkpoint(blockId)) }) {
            is MutationResult.Done -> CheckpointStart.Started(started.value)
            is MutationResult.Failed if started.code == "PLUS_REQUIRED" -> CheckpointStart.PlusRequired
            is MutationResult.Failed if started.code in CHANGED || started.error == ApiError.NotFound -> CheckpointStart.Changed
            else -> CheckpointStart.Failed
        }

    suspend fun start(request: CallRequest): CallStart =
        when (val started = cache.mutate { session -> api.start(session, request) }) {
            is MutationResult.Done -> {
                CallStart.Started(started.value)
            }

            is MutationResult.Failed -> {
                (CallReservation.refused(started.code, started.details) as? CallReservation.Limited)?.let { CallStart.Limited(it.limit) }
                    ?: CallStart.Failed
            }

            MutationResult.Obsolete -> {
                CallStart.Failed
            }
        }

    /** The call's result replaces the conversation read, so coming back to it shows the result without a request. */
    suspend fun complete(
        id: UUID,
        input: LanguageConversationCompletionInput,
    ): CallCompletion {
        val completed =
            cache.mutate(
                invalidating = setOf(DataDomain.UserProgress, DataDomain.Allowance),
                replacing = { listOf(conversation(id).replacing(it.recode<CompletedLanguageConversation, LanguageConversation>())) },
            ) { session -> api.complete(session, id, input) }
        return when (completed) {
            is MutationResult.Done -> CallCompletion.Completed(completed.value)
            is MutationResult.Failed if completed.code == "CALL_TAKEN_OVER" -> CallCompletion.TakenOver
            is MutationResult.Failed if completed.code == "CONVERSATION_ENDED" -> CallCompletion.Ended
            else -> CallCompletion.Failed
        }
    }
}
