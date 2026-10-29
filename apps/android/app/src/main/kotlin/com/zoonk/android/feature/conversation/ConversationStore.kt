package com.zoonk.android.feature.conversation

import com.zoonk.android.data.ApiClients
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
import com.zoonk.api.models.LanguageConversation
import com.zoonk.api.models.LanguageConversationCompletionInput
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import java.util.UUID

/** The calls a learner starts, each from a tap: a unit's practice call, a checkpoint's, a speaking mock and an exam task. */
sealed interface CallRequest {
    val body: JsonObject

    data class Practice(
        val chapterId: UUID,
        val goalId: UUID?,
        val minutes: Long,
    ) : CallRequest {
        override val body
            get() =
                buildJsonObject {
                    put("kind", JsonPrimitive("practice"))
                    put("chapterId", JsonPrimitive(chapterId.toString()))
                    goalId?.let { put("goalId", JsonPrimitive(it.toString())) }
                    put("minutes", JsonPrimitive(minutes))
                }
    }

    data class Checkpoint(
        val blockId: UUID,
    ) : CallRequest {
        override val body
            get() =
                buildJsonObject {
                    put("kind", JsonPrimitive("checkpoint"))
                    put("blockId", JsonPrimitive(blockId.toString()))
                }
    }

    data class SpeakingMock(
        val goalId: UUID,
    ) : CallRequest {
        override val body
            get() =
                buildJsonObject {
                    put("kind", JsonPrimitive("speakingMock"))
                    put("goalId", JsonPrimitive(goalId.toString()))
                }
    }

    data class ExamSpeaking(
        val goalId: UUID,
        val task: String,
    ) : CallRequest {
        override val body
            get() =
                buildJsonObject {
                    put("kind", JsonPrimitive("examSpeaking"))
                    put("goalId", JsonPrimitive(goalId.toString()))
                    put("task", JsonPrimitive(task))
                }
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

    override suspend fun start(
        session: AuthenticatedSession,
        request: CallRequest,
    ) = perform { api.streamingClients(session).language.startLanguageConversation(request.body) }.conversationId

    override suspend fun complete(
        session: AuthenticatedSession,
        id: UUID,
        input: LanguageConversationCompletionInput,
    ) = perform { api.streamingClients(session).language.completeLanguageConversation(id, input) }

    private companion object {
        const val UNPROCESSABLE = 422
    }
}

class ConversationStore(
    private val api: ConversationApi,
    private val cache: AppCache,
) {
    private val conversations =
        cache.keyed<UUID, LanguageConversation>(Audience.SignedIn, setOf(DataDomain.UserProgress)) { session, id ->
            api.conversation(session, id)
        }

    fun conversation(id: UUID) = conversations[id]

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
