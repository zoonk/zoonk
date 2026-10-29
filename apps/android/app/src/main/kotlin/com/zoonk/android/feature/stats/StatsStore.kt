package com.zoonk.android.feature.stats

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.Resource
import com.zoonk.android.data.perform
import com.zoonk.api.models.CurrentUserActivityResponseActivity
import com.zoonk.api.models.CurrentUserEnergyResponseEnergy
import com.zoonk.api.models.CurrentUserProgressResponse
import com.zoonk.api.models.CurrentUserScorePatternsResponsePatterns
import com.zoonk.api.models.CurrentUserScoreResponseScore

interface StatsApi {
    suspend fun progress(session: AuthenticatedSession): CurrentUserProgressResponse

    suspend fun energy(session: AuthenticatedSession): CurrentUserEnergyResponseEnergy?

    suspend fun activity(session: AuthenticatedSession): CurrentUserActivityResponseActivity

    suspend fun score(session: AuthenticatedSession): CurrentUserScoreResponseScore?

    suspend fun patterns(session: AuthenticatedSession): CurrentUserScorePatternsResponsePatterns?
}

class LiveStatsApi(
    private val api: ApiClients,
) : StatsApi {
    override suspend fun progress(session: AuthenticatedSession) = perform { api.clients(session).progress.getCurrentUserProgress() }

    override suspend fun energy(session: AuthenticatedSession) = perform { api.clients(session).progress.getCurrentUserEnergy() }.energy

    override suspend fun activity(session: AuthenticatedSession) =
        perform { api.clients(session).progress.getCurrentUserActivity() }.activity

    override suspend fun score(session: AuthenticatedSession) = perform { api.clients(session).progress.getCurrentUserScore() }.score

    override suspend fun patterns(session: AuthenticatedSession) =
        perform { api.clients(session).progress.getCurrentUserScorePatterns() }.patterns
}

/**
 * Every number covers all of the learner's goals and changes only as they study, so each read
 * follows `UserProgress`. The Level page reads the overview's progress, which carries the level.
 */
class StatsStore(
    api: StatsApi,
    cache: AppCache,
) {
    val progress: Resource<CurrentUserProgressResponse> = read(cache) { api.progress(it) }

    val energy: Resource<CurrentUserEnergyResponseEnergy> = read(cache) { api.energy(it) }

    val activity: Resource<CurrentUserActivityResponseActivity> = read(cache) { api.activity(it) }

    val score: Resource<CurrentUserScoreResponseScore> = read(cache) { api.score(it) }

    val patterns: Resource<CurrentUserScorePatternsResponsePatterns> = read(cache) { api.patterns(it) }

    private fun <T : Any> read(
        cache: AppCache,
        fetch: suspend (AuthenticatedSession) -> T?,
    ): Resource<T> = cache.resource(Audience.SignedIn, setOf(DataDomain.UserProgress)) { session -> session?.let { fetch(it) } }
}
