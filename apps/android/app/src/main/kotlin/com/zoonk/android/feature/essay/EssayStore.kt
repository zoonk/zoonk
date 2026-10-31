package com.zoonk.android.feature.essay

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.DraftHandle
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.perform
import com.zoonk.api.models.Essay
import com.zoonk.api.models.EssayDraftsInner
import com.zoonk.api.models.EssayGrade
import com.zoonk.api.models.EssaySubmissionInput
import com.zoonk.api.models.StudyBlockCompletion
import com.zoonk.api.models.StudySessionTimeZone
import java.util.UUID
import kotlin.time.Clock

interface EssayApi {
    suspend fun essay(
        session: AuthenticatedSession,
        blockId: UUID,
        timeZone: String,
    ): Essay

    suspend fun submit(
        session: AuthenticatedSession,
        blockId: UUID,
        input: EssaySubmissionInput,
    ): EssayGrade

    suspend fun finish(
        session: AuthenticatedSession,
        sessionId: UUID,
        blockId: UUID,
        timeZone: String,
    ): StudyBlockCompletion
}

class LiveEssayApi(
    private val api: ApiClients,
) : EssayApi {
    override suspend fun essay(
        session: AuthenticatedSession,
        blockId: UUID,
        timeZone: String,
    ) = perform { api.clients(session).exams.getEssay(blockId, timeZone) }

    /** Grading takes up to half a minute, past the regular read timeout. */
    override suspend fun submit(
        session: AuthenticatedSession,
        blockId: UUID,
        input: EssaySubmissionInput,
    ) = perform { api.streamingClients(session).exams.submitEssay(blockId, input) }

    override suspend fun finish(
        session: AuthenticatedSession,
        sessionId: UUID,
        blockId: UUID,
        timeZone: String,
    ) = perform {
        api.streamingClients(session).studySessions.createStudyBlockCompletion(sessionId, blockId, StudySessionTimeZone(timeZone))
    }
}

class EssayStore(
    private val api: EssayApi,
    private val cache: AppCache,
    private val drafts: DraftStore,
    private val timeZone: () -> String,
) {
    val essays =
        cache.keyed<UUID, Essay>(Audience.SignedIn, READ_DOMAINS) { session, blockId ->
            session?.let { api.essay(it, blockId, timeZone()) }
        }

    /** One grade per [attemptId]: the same draft sent again is graded once, so its grade joins the essay's drafts once. */
    suspend fun submit(
        blockId: UUID,
        attemptId: UUID,
        text: String,
        durationMs: Long,
    ): MutationResult<EssayGrade> =
        cache
            .mutate { session -> api.submit(session, blockId, EssaySubmissionInput(durationMs, text, attemptId, timeZone())) }
            .also { result ->
                if (result !is MutationResult.Done) return@also
                essays[blockId].update { essay ->
                    if (essay.drafts.firstOrNull()?.grade == result.value) {
                        essay
                    } else {
                        essay.copy(
                            drafts = listOf(EssayDraftsInner(result.value, Clock.System.now(), text)) + essay.drafts,
                            gradesLeft = maxOf(0, essay.gradesLeft - 1),
                        )
                    }
                }
            }

    suspend fun finish(
        sessionId: UUID,
        blockId: UUID,
    ): MutationResult<StudyBlockCompletion> =
        cache.mutate(invalidating = FINISHED) { session -> api.finish(session, sessionId, blockId, timeZone()) }

    fun unsentText(
        session: AuthenticatedSession,
        blockId: UUID,
    ): DraftHandle<UnsentEssay> = drafts.open(session, "essay:$blockId", UnsentEssay.serializer())

    private companion object {
        val READ_DOMAINS = setOf(DataDomain.UserSession)
        val FINISHED = setOf(DataDomain.Goals, DataDomain.LearnerModel, DataDomain.UserProgress, DataDomain.UserSession)
    }
}
