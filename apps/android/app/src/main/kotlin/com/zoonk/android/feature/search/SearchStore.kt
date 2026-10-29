package com.zoonk.android.feature.search

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.KeyedResources
import com.zoonk.android.data.perform
import com.zoonk.api.models.ExamMockSummary
import java.util.TimeZone
import java.util.UUID

fun interface SearchApi {
    suspend fun mocks(
        session: AuthenticatedSession,
        goalId: UUID,
    ): List<ExamMockSummary>
}

class LiveSearchApi(
    private val api: ApiClients,
) : SearchApi {
    override suspend fun mocks(
        session: AuthenticatedSession,
        goalId: UUID,
    ) = perform { api.clients(session).exams.getExam(goalId, TimeZone.getDefault().id) }.mocks
}

/** The exam goal's finished mocks, which main's search finds by their names; read only once a search starts. */
class SearchStore(
    api: SearchApi,
    cache: AppCache,
) {
    val mocks: KeyedResources<UUID, List<ExamMockSummary>> =
        cache.keyed(Audience.SignedIn, setOf(DataDomain.Goals, DataDomain.UserProgress)) { session, goalId ->
            session?.let { api.mocks(it, goalId) }
        }
}
