package com.zoonk.android.feature.session

import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.KeyedResources
import com.zoonk.api.models.StudySession
import com.zoonk.api.models.StudySessionSummary
import java.util.UUID

class StudySessionStore(
    private val api: StudyApi,
    private val cache: AppCache,
    timeZone: () -> String,
) {
    val day: KeyedResources<UUID, StudySession> =
        cache.keyed(Audience.SignedIn, DOMAINS) { session, sessionId -> session?.let { api.session(it, sessionId, timeZone()) } }

    val summary: KeyedResources<UUID, StudySessionSummary> =
        cache.keyed(Audience.SignedIn, DOMAINS) { session, sessionId -> session?.let { api.summary(it, sessionId, timeZone()) } }

    suspend fun recordSummaryVisit(
        sessionId: UUID,
        visitId: UUID,
    ) = cache.mutate { api.recordSummaryVisit(it, sessionId, visitId) }

    private companion object {
        val DOMAINS = setOf(DataDomain.Goals, DataDomain.UserProgress, DataDomain.UserSession)
    }
}
