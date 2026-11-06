package com.zoonk.android.feature.tutor

import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.api.models.TutorToolOffer
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlin.time.Instant

internal class FakeTutorApi : TutorApi {
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

fun turn(
    id: String,
    status: TutorTurn.Status,
    answer: String?,
    question: String = "Why?",
    about: TutorTurn.About = TutorTurn.About.Plan,
    toolOffer: TutorToolOffer? = null,
) = TutorTurn(id, question, answer, status, Instant.parse("2026-10-28T12:00:00Z"), about, toolOffer = toolOffer)
