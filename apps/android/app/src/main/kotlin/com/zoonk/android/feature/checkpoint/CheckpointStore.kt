package com.zoonk.android.feature.checkpoint

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.perform
import com.zoonk.android.data.recode
import com.zoonk.android.feature.questions.Answer
import com.zoonk.api.models.Checkpoint
import com.zoonk.api.models.StudyAnswerFeedback
import com.zoonk.api.models.StudyAnswerInput
import com.zoonk.api.models.StudyAnswerInputAnswer
import com.zoonk.api.models.StudyBlockCompletion
import com.zoonk.api.models.StudySessionTimeZone
import java.util.UUID

interface CheckpointApi {
    suspend fun checkpoint(
        session: AuthenticatedSession,
        blockId: UUID,
    ): Checkpoint

    suspend fun answer(
        session: AuthenticatedSession,
        checkpoint: Checkpoint,
        input: StudyAnswerInput,
    ): StudyAnswerFeedback

    suspend fun finish(
        session: AuthenticatedSession,
        checkpoint: Checkpoint,
        timeZone: String,
    ): StudyBlockCompletion
}

class LiveCheckpointApi(
    private val api: ApiClients,
) : CheckpointApi {
    override suspend fun checkpoint(
        session: AuthenticatedSession,
        blockId: UUID,
    ) = perform { api.clients(session).studySessions.getCheckpoint(blockId) }

    override suspend fun answer(
        session: AuthenticatedSession,
        checkpoint: Checkpoint,
        input: StudyAnswerInput,
    ) = perform { api.streamingClients(session).studySessions.createStudyAnswer(checkpoint.sessionId, checkpoint.blockId, input) }

    override suspend fun finish(
        session: AuthenticatedSession,
        checkpoint: Checkpoint,
        timeZone: String,
    ) = perform {
        api
            .streamingClients(session)
            .studySessions
            .createStudyBlockCompletion(checkpoint.sessionId, checkpoint.blockId, StudySessionTimeZone(timeZone))
    }
}

/** A session's checkpoints: the duel against the Trickster and the week's challenge. */
class CheckpointStore(
    private val api: CheckpointApi,
    private val cache: AppCache,
    private val timeZone: () -> String,
) {
    val checkpoints =
        cache.keyed<UUID, Checkpoint>(Audience.SignedIn, setOf(DataDomain.UserSession)) { session, blockId ->
            session?.let { api.checkpoint(it, blockId) }
        }

    suspend fun answer(
        checkpoint: Checkpoint,
        itemId: String,
        answer: Answer,
        durationMs: Long,
    ): MutationResult<StudyAnswerFeedback> =
        cache.mutate(invalidating = ANSWERED) { session ->
            api.answer(
                session,
                checkpoint,
                StudyAnswerInput(answer.recode<Answer, StudyAnswerInputAnswer>(), durationMs, UUID.fromString(itemId), timeZone()),
            )
        }

    suspend fun finish(checkpoint: Checkpoint): MutationResult<StudyBlockCompletion> =
        cache.mutate(invalidating = FINISHED) { session -> api.finish(session, checkpoint, timeZone()) }

    private companion object {
        val ANSWERED = setOf(DataDomain.LearnerModel, DataDomain.UserProgress, DataDomain.UserSession)
        val FINISHED = setOf(DataDomain.Goals, DataDomain.LearnerModel, DataDomain.UserProgress, DataDomain.UserSession)
    }
}
