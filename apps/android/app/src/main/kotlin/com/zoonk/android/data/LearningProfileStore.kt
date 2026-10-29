package com.zoonk.android.data

import com.zoonk.api.models.Buddy
import com.zoonk.api.models.LearningProfile
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonObject
import java.util.UUID
import kotlin.coroutines.cancellation.CancellationException

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

    suspend fun setActiveGoal(goalId: UUID): Boolean =
        update({ it.copy(activeGoalId = goalId) }, buildJsonObject { put("activeGoalId", goalId.toString()) })

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

    private val writing = Mutex()
    private var pending = 0

    /**
     * Shows [optimistic] at once. Writes go out one at a time, in the order they were made. The
     * last one's answer has every earlier change, so it's shown as saved; a refused or abandoned
     * last write reads the profile again rather than restoring an older copy over later changes.
     */
    private suspend fun update(
        optimistic: (LearningProfile) -> LearningProfile,
        change: JsonObject,
    ): Boolean {
        if (profile.state.value.value != null) profile.update(optimistic)
        pending++
        val result =
            try {
                writing.withLock {
                    cache.mutate(
                        invalidating = setOf(DataDomain.LearningProfile),
                        replacing = { saved: LearningProfile -> if (pending == 1) listOf(profile.replacing(saved)) else emptyList() },
                    ) { session -> api.update(session, change) }
                }
            } catch (e: CancellationException) {
                profile.invalidate()
                throw e
            } finally {
                pending--
            }
        if (result is MutationResult.Failed) profile.invalidate()
        return result is MutationResult.Done
    }
}
