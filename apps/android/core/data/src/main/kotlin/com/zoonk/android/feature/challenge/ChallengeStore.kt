package com.zoonk.android.feature.challenge

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.perform
import com.zoonk.api.models.Challenge
import com.zoonk.api.models.ChallengeGeneration
import com.zoonk.api.models.ChallengeMove
import com.zoonk.api.models.ChallengeMoveUndo
import com.zoonk.api.models.ChallengeStart
import com.zoonk.api.models.StudyBlockStart
import com.zoonk.api.models.StudySessionTimeZone
import java.util.UUID

interface ChallengeApi {
    suspend fun challenge(
        session: AuthenticatedSession,
        planItemId: UUID,
        timeZone: String,
    ): Challenge

    suspend fun start(
        session: AuthenticatedSession,
        planItemId: UUID,
        input: StudyBlockStart,
    ): ChallengeStart

    suspend fun writeQuestions(
        session: AuthenticatedSession,
        planItemId: UUID,
    ): ChallengeGeneration

    suspend fun move(
        session: AuthenticatedSession,
        planItemId: UUID,
        timeZone: String,
    ): ChallengeMove

    suspend fun undoMove(
        session: AuthenticatedSession,
        planItemId: UUID,
        changeId: UUID,
        timeZone: String,
    ): ChallengeMoveUndo
}

class LiveChallengeApi(
    private val api: ApiClients,
) : ChallengeApi {
    override suspend fun challenge(
        session: AuthenticatedSession,
        planItemId: UUID,
        timeZone: String,
    ) = perform { api.clients(session).studySessions.getChallenge(planItemId, timeZone) }

    override suspend fun start(
        session: AuthenticatedSession,
        planItemId: UUID,
        input: StudyBlockStart,
    ) = perform { api.streamingClients(session).studySessions.startChallenge(planItemId, input) }

    override suspend fun writeQuestions(
        session: AuthenticatedSession,
        planItemId: UUID,
    ) = perform { api.clients(session).studySessions.createChallengeGeneration(planItemId) }

    override suspend fun move(
        session: AuthenticatedSession,
        planItemId: UUID,
        timeZone: String,
    ) = perform { api.clients(session).studySessions.moveChallenge(planItemId, StudySessionTimeZone(timeZone)) }

    override suspend fun undoMove(
        session: AuthenticatedSession,
        planItemId: UUID,
        changeId: UUID,
        timeZone: String,
    ) = perform { api.clients(session).studySessions.undoChallengeMove(planItemId, changeId, timeZone) }
}

/** A plan's challenges before they're played: the intro, its start and its move to Monday. */
class ChallengeStore(
    private val api: ChallengeApi,
    private val cache: AppCache,
    private val timeZone: () -> String,
) {
    val challenges =
        cache.keyed<UUID, Challenge>(Audience.SignedIn, setOf(DataDomain.Goals, DataDomain.UserSession)) { session, planItemId ->
            session?.let { api.challenge(it, planItemId, timeZone()) }
        }

    suspend fun start(
        planItemId: UUID,
        afterWriting: Boolean,
    ): MutationResult<ChallengeStart> =
        cache.mutate(invalidating = OPENED) { session -> api.start(session, planItemId, StudyBlockStart(afterWriting, timeZone())) }

    suspend fun writeQuestions(planItemId: UUID): MutationResult<ChallengeGeneration> =
        cache.mutate(invalidating = emptySet()) { session -> api.writeQuestions(session, planItemId) }

    suspend fun move(planItemId: UUID): MutationResult<ChallengeMove> =
        cache.mutate(invalidating = PLAN_CHANGED) { session -> api.move(session, planItemId, timeZone()) }

    suspend fun undoMove(
        planItemId: UUID,
        changeId: UUID,
    ): MutationResult<ChallengeMoveUndo> =
        cache.mutate(invalidating = PLAN_CHANGED) { session -> api.undoMove(session, planItemId, changeId, timeZone()) }

    private companion object {
        val OPENED = setOf(DataDomain.Goals, DataDomain.UserSession)
        val PLAN_CHANGED = setOf(DataDomain.Goals, DataDomain.LearnerModel, DataDomain.UserSession)
    }
}
