package com.zoonk.android.feature.session

import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.KeyedResources
import com.zoonk.api.models.StudySession
import com.zoonk.api.models.StudySessionSummary
import java.util.UUID

/** The session screen's reads, which never write: a screen opening changes nothing. */
class StudySessionStore(
    api: StudyApi,
    cache: AppCache,
    timeZone: () -> String,
) {
    val day: KeyedResources<UUID, StudySession> =
        cache.keyed(Audience.SignedIn, DOMAINS) { session, sessionId -> session?.let { api.session(it, sessionId, timeZone()) } }

    val summary: KeyedResources<UUID, StudySessionSummary> =
        cache.keyed(Audience.SignedIn, DOMAINS) { session, sessionId -> session?.let { api.summary(it, sessionId, timeZone()) } }

    private val celebrated = mutableSetOf<Pair<UUID, Long>>()

    /** A summary celebrates once per session and Brain Power, so reopening it shows it still; more Brain Power celebrates again. */
    fun firstVisit(
        sessionId: UUID,
        brainPower: Long,
    ): Boolean = celebrated.add(sessionId to brainPower)

    private companion object {
        val DOMAINS = setOf(DataDomain.Goals, DataDomain.UserProgress, DataDomain.UserSession)
    }
}
