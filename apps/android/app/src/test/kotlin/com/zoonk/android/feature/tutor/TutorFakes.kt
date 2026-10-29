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
    )

    var thread: TutorThread? = null
    var earlier: TutorThread? = null
    var threadReads = 0
    var refusal: ApiException? = null
    var answers: (String) -> Flow<TutorAnswerEvent> = { flow { emit(TutorAnswerEvent.Finish) } }
    var question: (String) -> TutorTurn = { id -> turn(id, TutorTurn.Status.Completed, "") }
    val asked = mutableListOf<Ask>()

    /** Holds the next thread read until it completes. */
    var gate: kotlinx.coroutines.CompletableDeferred<Unit>? = null

    override suspend fun thread(
        key: TutorThreadKey,
        cursor: String?,
        session: AuthenticatedSession?,
    ): TutorThread? {
        if (cursor != null) return earlier
        threadReads++
        val read = thread
        gate?.await()
        return read
    }

    override suspend fun ask(
        scope: TutorScope,
        question: String,
        suggestion: String?,
        requestId: String,
        session: AuthenticatedSession,
    ): AskedQuestion {
        asked += Ask(question, requestId, scope)
        refusal?.let { throw it }
        return AskedQuestion(turn("q${asked.size}", TutorTurn.Status.Pending, null, question, scope.about), missionMoment = null)
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

internal fun turn(
    id: String,
    status: TutorTurn.Status,
    answer: String?,
    question: String = "Why?",
    about: TutorTurn.About = TutorTurn.About.Plan,
    toolOffer: TutorToolOffer? = null,
) = TutorTurn(id, question, answer, status, Instant.parse("2026-10-28T12:00:00Z"), about, toolOffer = toolOffer)

/** What the server labels a question asked in [this] scope. */
private val TutorScope.about: TutorTurn.About
    get() =
        when (this) {
            is TutorScope.Plan -> TutorTurn.About.Plan
            is TutorScope.Subject -> TutorTurn.About.Subject
            is TutorScope.Chapter -> TutorTurn.About.Chapter
            is TutorScope.Mock -> TutorTurn.About.Mock
            is TutorScope.Lesson -> TutorTurn.About.Lesson
            is TutorScope.Step -> TutorTurn.About.Step
            is TutorScope.Answer -> TutorTurn.About.Answer
            is TutorScope.Item -> if (answered) TutorTurn.About.Answer else TutorTurn.About.Item
        }
