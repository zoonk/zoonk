package com.zoonk.android.feature.practice.block

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.perform
import com.zoonk.android.data.recode
import com.zoonk.android.feature.questions.Answer
import com.zoonk.api.models.CheckpointQuestionsInnerAnswered
import com.zoonk.api.models.StudyAnswerFeedback
import com.zoonk.api.models.StudyAnswerInput
import com.zoonk.api.models.StudyAnswerInputAnswer
import com.zoonk.api.models.StudyBlockCompletion
import com.zoonk.api.models.StudyBlockDetail
import com.zoonk.api.models.StudySessionSummary
import com.zoonk.api.models.StudySessionTimeZone
import java.util.UUID

data class BlockKey(
    val sessionId: UUID,
    val blockId: UUID,
)

interface QuestionBlockApi {
    suspend fun block(
        session: AuthenticatedSession,
        key: BlockKey,
    ): StudyBlockDetail

    suspend fun answer(
        session: AuthenticatedSession,
        key: BlockKey,
        input: StudyAnswerInput,
    ): StudyAnswerFeedback

    suspend fun finish(
        session: AuthenticatedSession,
        key: BlockKey,
        timeZone: String,
    ): StudyBlockCompletion

    suspend fun stop(
        session: AuthenticatedSession,
        sessionId: UUID,
        timeZone: String,
    ): StudySessionSummary
}

class LiveQuestionBlockApi(
    private val api: ApiClients,
) : QuestionBlockApi {
    override suspend fun block(
        session: AuthenticatedSession,
        key: BlockKey,
    ) = perform { api.clients(session).studySessions.getStudyBlock(key.sessionId, key.blockId) }

    override suspend fun answer(
        session: AuthenticatedSession,
        key: BlockKey,
        input: StudyAnswerInput,
    ) = perform { api.streamingClients(session).studySessions.createStudyAnswer(key.sessionId, key.blockId, input) }

    override suspend fun finish(
        session: AuthenticatedSession,
        key: BlockKey,
        timeZone: String,
    ) = perform {
        api
            .streamingClients(session)
            .studySessions
            .createStudyBlockCompletion(key.sessionId, key.blockId, StudySessionTimeZone(timeZone))
    }

    override suspend fun stop(
        session: AuthenticatedSession,
        sessionId: UUID,
        timeZone: String,
    ) = perform { api.clients(session).studySessions.createStudySessionStop(sessionId, StudySessionTimeZone(timeZone)) }
}

/** A session's question blocks: each block's questions by [BlockKey], and the writes that play them. */
class QuestionBlockStore(
    private val api: QuestionBlockApi,
    private val cache: AppCache,
    private val timeZone: () -> String,
) {
    val blocks =
        cache.keyed<BlockKey, StudyBlockDetail>(Audience.SignedIn, setOf(DataDomain.UserSession)) { session, key ->
            session?.let {
                api.block(it, key)
            }
        }

    suspend fun answer(
        key: BlockKey,
        itemId: String,
        answer: Answer,
        durationMs: Long,
    ): MutationResult<StudyAnswerFeedback> =
        cache.mutate(
            invalidating = ANSWERED,
            // The block keeps its own read, marked answered, so reopening it resumes past this question.
            replacing = { feedback ->
                val block = blocks[key]
                listOfNotNull((block.state.value as? LoadState.Loaded)?.value?.let { block.replacing(it.answered(itemId, feedback)) })
            },
        ) { session ->
            api.answer(
                session,
                key,
                StudyAnswerInput(answer.recode<Answer, StudyAnswerInputAnswer>(), durationMs, UUID.fromString(itemId), timeZone()),
            )
        }

    suspend fun finish(key: BlockKey): MutationResult<StudyBlockCompletion> =
        cache.mutate(invalidating = FINISHED) { session -> api.finish(session, key, timeZone()) }

    suspend fun stop(sessionId: UUID): MutationResult<StudySessionSummary> =
        cache.mutate(invalidating = FINISHED) { session -> api.stop(session, sessionId, timeZone()) }

    private companion object {
        val ANSWERED = setOf(DataDomain.LearnerModel, DataDomain.UserProgress, DataDomain.UserSession)
        val FINISHED = setOf(DataDomain.Goals, DataDomain.LearnerModel, DataDomain.UserProgress, DataDomain.UserSession)
    }
}

private fun StudyBlockDetail.answered(
    itemId: String,
    feedback: StudyAnswerFeedback,
) = copy(
    questions =
        questions.map { question ->
            if (question.itemId.toString() ==
                itemId
            ) {
                question.copy(answered = CheckpointQuestionsInnerAnswered(feedback.blank, feedback.isCorrect))
            } else {
                question
            }
        },
)
