package com.zoonk.android.feature.tutor

import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.SessionSource
import com.zoonk.api.models.TutorToolOffer
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlin.time.Instant

class FakeTutorApi : TutorApi {
    class Ask(
        val question: String,
        val requestId: String,
        val scope: TutorScope,
        val suggestion: String?,
    )

    var thread: TutorThread? = null
    var earlier: TutorThread? = null
    var threadReads = 0
    var refusal: ApiException? = null
    var threadFailure: ApiException? = null
    var answers: (String) -> Flow<TutorAnswerEvent> = { flow { emit(TutorAnswerEvent.Finish) } }
    var question: (String) -> TutorTurn = { id -> turn(id, TutorTurn.Status.Completed, "") }
    val asked = mutableListOf<Ask>()

    /** Holds the next thread read until it completes. */
    var gate: kotlinx.coroutines.CompletableDeferred<Unit>? = null

    /** Holds every ask until it completes. */
    var askGate: kotlinx.coroutines.CompletableDeferred<Unit>? = null

    /** Each goal's pages of conversations, by the cursor that reads them (null for the first). */
    var conversationPages: Map<String?, BuddyConversationList> = emptyMap()
    var conversationsFailure: ApiException? = null
    val conversationReads = mutableListOf<String?>()

    /** Holds every conversations read, which answers with the page as it was when asked. */
    var conversationsGate: kotlinx.coroutines.CompletableDeferred<Unit>? = null

    override suspend fun conversations(
        goalId: String,
        cursor: String?,
        session: AuthenticatedSession,
    ): BuddyConversationList {
        conversationReads += cursor
        val page = conversationPages[cursor] ?: BuddyConversationList(emptyList(), currentId = null, nextCursor = null)
        conversationsGate?.await()
        conversationsFailure?.let { throw it }
        return page
    }

    override suspend fun thread(
        key: TutorThreadKey,
        cursor: String?,
        session: AuthenticatedSession?,
    ): TutorThread? {
        if (cursor != null) return earlier
        threadReads++
        val read = thread
        gate?.await()
        threadFailure?.let { throw it }
        return read
    }

    override suspend fun ask(
        scope: TutorScope,
        question: String,
        suggestion: String?,
        requestId: String,
        session: AuthenticatedSession,
    ): AskedQuestion {
        asked += Ask(question, requestId, scope, suggestion)
        askGate?.await()
        refusal?.let { throw it }
        return AskedQuestion(turn("q${asked.size}", TutorTurn.Status.Pending, null, question, scope.about), null)
    }

    override fun answer(
        questionId: String,
        session: AuthenticatedSession,
    ) = answers(questionId)

    override suspend fun question(
        id: String,
        session: AuthenticatedSession,
    ) = question.invoke(id)
}

/** A store whose writes all succeed, over [api]. */
fun tutorStore(
    api: TutorApi,
    cache: AppCache,
    sessions: SessionSource,
) = TutorStore(
    api,
    cache,
    sessions,
    { MutationResult.Done(Unit) },
    { _, _ -> MutationResult.Done(Unit) },
    { _, _ -> MutationResult.Done(Unit) },
    { true },
) { _, change, _ -> MutationResult.Done(change) }

fun turn(
    id: String,
    status: TutorTurn.Status,
    answer: String?,
    question: String = "Why?",
    about: TutorTurn.About = TutorTurn.About.Plan,
    toolOffer: TutorToolOffer? = null,
) = TutorTurn(id, question, answer, status, Instant.parse("2026-10-28T12:00:00Z"), about, toolOffer = toolOffer)
