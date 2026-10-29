package com.zoonk.android.data

import com.zoonk.api.models.LearningProfile

fun interface LearningProfileApi {
    suspend fun profile(session: AuthenticatedSession): LearningProfile
}

/** The learner's preferences (sounds, buddy, daily limit, active goal): one read every screen shares. */
class LearningProfileStore(
    api: LearningProfileApi,
    cache: AppCache,
) {
    val profile: Resource<LearningProfile> =
        cache.resource(Audience.SignedIn, setOf(DataDomain.LearningProfile)) { session ->
            session?.let { api.profile(it) }
        }
}
