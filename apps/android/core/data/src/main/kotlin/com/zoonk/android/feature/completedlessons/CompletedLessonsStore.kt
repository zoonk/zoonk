package com.zoonk.android.feature.completedlessons

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.KeyedResources
import com.zoonk.android.data.SessionSource
import com.zoonk.android.data.perform
import com.zoonk.android.data.value
import com.zoonk.api.models.CompletedLessonList
import kotlinx.coroutines.flow.first
import java.util.UUID

/** A goal's completed lessons, or only those of one of its plan's groups (a `key` of the list's filter). */
data class CompletedLessonsQuery(
    val goalId: UUID,
    val group: String? = null,
)

fun interface CompletedLessonsApi {
    suspend fun page(
        session: AuthenticatedSession,
        query: CompletedLessonsQuery,
        cursor: String?,
        limit: Long,
    ): CompletedLessonList
}

class LiveCompletedLessonsApi(
    private val api: ApiClients,
) : CompletedLessonsApi {
    override suspend fun page(
        session: AuthenticatedSession,
        query: CompletedLessonsQuery,
        cursor: String?,
        limit: Long,
    ) = perform {
        api.clients(session).libraryLessons.listCurrentUserCompletedLessons(
            goalId = query.goalId,
            group = query.group,
            limit = limit,
            cursor = cursor,
        )
    }
}

class CompletedLessonsStore(
    private val api: CompletedLessonsApi,
    cache: AppCache,
    private val sessions: SessionSource,
) {
    /** Main's tags for the list: a save reads it again too, since a read out as it lands predates it. */
    val lessons: KeyedResources<CompletedLessonsQuery, CompletedLessonList> =
        cache.keyed(Audience.SignedIn, setOf(DataDomain.UserProgress, DataDomain.Goals, DataDomain.SavedLessons)) { session, query ->
            session?.let { api.page(it, query, cursor = null, limit = readLimit(query)) }
        }

    /** Read again, a list keeps every page it shows, so no row leaves from under the learner's thumb. */
    private fun readLimit(query: CompletedLessonsQuery): Long {
        val shown =
            lessons[query]
                .state.value.value
                ?.`data`
                ?.size ?: 0
        return shown.toLong().coerceIn(PAGE_SIZE, MAX_PAGE_SIZE)
    }

    /**
     * Appends the next page; a list read again or changed meanwhile is asked for its next page again, from where it
     * ends now. A lesson already shown is left out: a replay moves it to the top and shifts the pages after it.
     * False when it didn't load, so the page offers to try again.
     */
    suspend fun more(query: CompletedLessonsQuery): Boolean {
        val list = lessons[query]
        while (true) {
            val cursor =
                list.state.value.value
                    ?.pagination
                    ?.nextCursor ?: return true
            val session = sessions.current ?: return true
            val revision = list.revision

            val next =
                try {
                    api.page(session, query, cursor, PAGE_SIZE)
                } catch (e: ApiException) {
                    if (e.error == ApiError.Unauthorized) sessions.expire(session)
                    return false
                }

            if (sessions.current != session) return true
            // A read of the list on its way would land without this page, so the page waits for it.
            list.isRefreshing.first { !it }
            if (list.revision == revision) {
                list.update { shown ->
                    val seen = shown.`data`.mapTo(HashSet()) { it.lessonId }
                    shown.copy(`data` = shown.`data` + next.`data`.filterNot { it.lessonId in seen }, pagination = next.pagination)
                }
                return true
            }
        }
    }

    private companion object {
        const val PAGE_SIZE = 50L
        const val MAX_PAGE_SIZE = 1000L
    }
}
