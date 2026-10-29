package com.zoonk.android.feature.buddy

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.Resource
import com.zoonk.android.data.perform
import com.zoonk.api.models.BuddyStatus

interface BuddyApi {
    suspend fun status(
        session: AuthenticatedSession,
        timeZone: String,
    ): BuddyStatus
}

class LiveBuddyApi(
    private val api: ApiClients,
) : BuddyApi {
    override suspend fun status(
        session: AuthenticatedSession,
        timeZone: String,
    ) = perform { api.clients(session).milestones.getCurrentUserBuddy(timeZone) }
}

/** The buddy tab's read: the buddy, its Energy, belt and growth, glasses, today's missions and first steps. */
class BuddyStore(
    private val api: BuddyApi,
    cache: AppCache,
    private val timeZone: () -> String,
) {
    val status: Resource<BuddyStatus> =
        cache.resource(Audience.SignedIn, DOMAINS) { session -> session?.let { api.status(it, timeZone()) } }

    private companion object {
        val DOMAINS = setOf(DataDomain.Goals, DataDomain.LearningProfile, DataDomain.UserProgress, DataDomain.UserSession)
    }
}
