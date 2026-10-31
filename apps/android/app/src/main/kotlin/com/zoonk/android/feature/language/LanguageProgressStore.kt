package com.zoonk.android.feature.language

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.KeyedResources
import com.zoonk.android.data.perform
import com.zoonk.api.models.LanguageProgress
import java.util.UUID

fun interface LanguageProgressApi {
    suspend fun progress(
        session: AuthenticatedSession,
        goalId: UUID,
    ): LanguageProgress
}

class LiveLanguageProgressApi(
    private val api: ApiClients,
) : LanguageProgressApi {
    override suspend fun progress(
        session: AuthenticatedSession,
        goalId: UUID,
    ): LanguageProgress = perform { api.clients(session).language.getLanguageProgress(goalId) }
}

/**
 * A language goal's level, skill levels, can-dos and speaking practice. Its speaking parts follow
 * the learner's plan and call allowance, so it reads again when those change.
 */
class LanguageProgressStore(
    api: LanguageProgressApi,
    cache: AppCache,
) {
    val progress: KeyedResources<UUID, LanguageProgress> =
        cache.keyed(
            Audience.SignedIn,
            setOf(DataDomain.Allowance, DataDomain.Goals, DataDomain.LearnerModel, DataDomain.UserProgress, DataDomain.UserSubscription),
        ) { session, goalId -> session?.let { api.progress(it, goalId) } }
}
