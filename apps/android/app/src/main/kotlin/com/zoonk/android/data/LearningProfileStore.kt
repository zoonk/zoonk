package com.zoonk.android.data

import com.zoonk.api.models.Buddy
import com.zoonk.api.models.LearningProfile
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonObject

interface LearningProfileApi {
    suspend fun profile(session: AuthenticatedSession): LearningProfile

    /** [change] sends only the fields it sets; an explicit null clears one. */
    suspend fun update(
        session: AuthenticatedSession,
        change: JsonObject,
    ): LearningProfile
}

class LiveLearningProfileApi(
    private val api: ApiClients,
) : LearningProfileApi {
    override suspend fun profile(session: AuthenticatedSession): LearningProfile =
        perform { api.clients(session).account.getCurrentUserLearningProfile() }.profile

    override suspend fun update(
        session: AuthenticatedSession,
        change: JsonObject,
    ): LearningProfile = perform { api.clients(session).account.updateCurrentUserLearningProfile(change) }.profile
}

/** The learner's preferences (sounds, buddy, daily limit, active goal): one read every screen shares. */
class LearningProfileStore(
    private val api: LearningProfileApi,
    private val cache: AppCache,
) {
    val profile: Resource<LearningProfile> =
        cache.resource(Audience.SignedIn, setOf(DataDomain.LearningProfile)) { session ->
            session?.let { api.profile(it) }
        }

    suspend fun setSoundsEnabled(enabled: Boolean): Boolean =
        update({ it.copy(soundsEnabled = enabled) }, buildJsonObject { put("soundsEnabled", enabled) })

    /** Null is no limit. */
    suspend fun setDailyLimit(minutes: Long?): Boolean =
        update({ it.copy(dailyLimitMinutes = minutes) }, buildJsonObject { put("dailyLimitMinutes", minutes) })

    /** [name] null keeps the buddy's own name. */
    suspend fun setBuddy(
        kind: Buddy.Kind,
        glasses: Buddy.Glasses,
        name: String?,
    ): Boolean =
        update(
            { it.copy(buddy = it.buddy.copy(kind = kind, glasses = glasses, name = name, picked = true)) },
            buildJsonObject {
                putJsonObject("buddy") {
                    put("kind", kind.value)
                    put("glasses", glasses.value)
                    put("name", name)
                }
            },
        )

    /**
     * Shows [optimistic] at once and keeps the server's answer; puts the old profile back only
     * when the write failed. Everything that shows the buddy or the day reads it again.
     */
    private suspend fun update(
        optimistic: (LearningProfile) -> LearningProfile,
        change: JsonObject,
    ): Boolean {
        val before = profile.state.value.value
        if (before != null) profile.update(optimistic)
        val result =
            cache.mutate(
                invalidating = setOf(DataDomain.LearningProfile),
                replacing = { saved: LearningProfile -> listOf(profile.replacing(saved)) },
            ) { session -> api.update(session, change) }
        if (result is MutationResult.Failed && before != null) profile.update { before }
        return result is MutationResult.Done
    }
}
