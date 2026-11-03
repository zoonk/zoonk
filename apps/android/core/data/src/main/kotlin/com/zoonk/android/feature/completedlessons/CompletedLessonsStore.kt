package com.zoonk.android.feature.completedlessons

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.SessionSource
import com.zoonk.android.data.perform
import com.zoonk.android.data.value
import com.zoonk.api.models.CompletedLessonList
import java.util.UUID

fun interface CompletedLessonsApi {
    suspend fun page(
        session: AuthenticatedSession,
        goalId: UUID,
        cursor: String?,
    ): CompletedLessonList
}

class LiveCompletedLessonsApi(
    private val api: ApiClients,
) : CompletedLessonsApi {
    override suspend fun page(
        session: AuthenticatedSession,
        goalId: UUID,
        cursor: String?,
    ) = perform { api.clients(session).libraryLessons.listCurrentUserCompletedLessons(goalId, PAGE_SIZE, cursor) }

    private companion object {
        const val PAGE_SIZE = 50L
    }
}

class CompletedLessonsStore(
    private val api: CompletedLessonsApi,
    cache: AppCache,
    private val sessions: SessionSource,
) {
    val lessons =
        cache.keyed<UUID, CompletedLessonList>(Audience.SignedIn, setOf(DataDomain.UserProgress)) { session, goalId ->
            session?.let { api.page(it, goalId, cursor = null) }
        }

    /**
     * Appends the next page, unless a refresh or another session replaced the list meanwhile. A
     * lesson already shown is left out: a replay moves it to the top and shifts the pages after it.
     * False when it didn't load, so the page offers to try again.
     */
    suspend fun more(goalId: UUID): Boolean {
        val list = lessons[goalId]
        val cursor =
            list.state.value.value
                ?.pagination
                ?.nextCursor ?: return true
        val session = sessions.current ?: return true
        val revision = list.revision

        val next =
            try {
                api.page(session, goalId, cursor)
            } catch (e: ApiException) {
                if (e.error == ApiError.Unauthorized) sessions.expire(session)
                return false
            }

        if (sessions.current == session && list.revision == revision) {
            list.update { shown ->
                val seen = shown.`data`.mapTo(HashSet()) { it.lessonId }
                shown.copy(`data` = shown.`data` + next.`data`.filterNot { it.lessonId in seen }, pagination = next.pagination)
            }
        }
        return true
    }
}
