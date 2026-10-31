package com.zoonk.android.feature.language

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.KeyedResources
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.perform
import com.zoonk.api.models.LanguageUnits
import java.util.UUID

interface AlphabetApi {
    suspend fun units(
        session: AuthenticatedSession,
        goalId: UUID,
    ): LanguageUnits

    suspend fun skipAlphabet(
        session: AuthenticatedSession,
        goalId: UUID,
    )
}

class LiveAlphabetApi(
    private val api: ApiClients,
) : AlphabetApi {
    override suspend fun units(
        session: AuthenticatedSession,
        goalId: UUID,
    ) = perform { api.clients(session).language.getLanguageUnits(goalId) }

    override suspend fun skipAlphabet(
        session: AuthenticatedSession,
        goalId: UUID,
    ) = perform { api.clients(session).language.skipAlphabetIntro(goalId) }
}

/** A language goal's alphabet lesson, for a script the learner's language doesn't use, read with the goal's units. */
class AlphabetStore(
    private val api: AlphabetApi,
    private val cache: AppCache,
) {
    val units: KeyedResources<UUID, LanguageUnits> =
        cache.keyed(Audience.SignedIn, setOf(DataDomain.Goals, DataDomain.LearnerModel, DataDomain.UserProgress)) { session, goalId ->
            session?.let { api.units(it, goalId) }
        }

    suspend fun skipAlphabet(goalId: UUID): MutationResult<Unit> = cache.mutate(setOf(DataDomain.Goals)) { api.skipAlphabet(it, goalId) }
}
