package com.zoonk.android.feature.mistakes

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
import com.zoonk.api.apis.MistakesApi.StatusListCurrentUserMistakes
import com.zoonk.api.models.GoalMistakePattern
import com.zoonk.api.models.MistakeList
import java.util.UUID

data class NotebookKey(
    val goalId: UUID,
    val fixed: Boolean,
)

interface NotebookApi {
    suspend fun page(
        session: AuthenticatedSession,
        key: NotebookKey,
        cursor: String?,
        timeZone: String,
    ): MistakeList

    suspend fun pattern(
        session: AuthenticatedSession,
        goalId: UUID,
    ): GoalMistakePattern
}

class LiveNotebookApi(
    private val api: ApiClients,
) : NotebookApi {
    override suspend fun page(
        session: AuthenticatedSession,
        key: NotebookKey,
        cursor: String?,
        timeZone: String,
    ) = perform {
        api.clients(session).mistakes.listCurrentUserMistakes(
            goalId = key.goalId,
            limit = PAGE_SIZE,
            status = if (key.fixed) StatusListCurrentUserMistakes.FIXED else StatusListCurrentUserMistakes.OPEN,
            timeZone = timeZone,
            cursor = cursor,
        )
    }

    override suspend fun pattern(
        session: AuthenticatedSession,
        goalId: UUID,
    ) = perform { api.clients(session).language.getGoalMistakePattern(goalId) }

    private companion object {
        /** Main's page size: as many as the list allows, so a skill's mistakes are rarely split across pages. */
        const val PAGE_SIZE = 50L
    }
}

class MistakesNotebookStore(
    private val api: NotebookApi,
    cache: AppCache,
    private val sessions: SessionSource,
    private val timeZone: () -> String,
) {
    val notebooks =
        cache.keyed<NotebookKey, MistakeList>(Audience.SignedIn, DOMAINS) { session, key ->
            session?.let { api.page(it, key, cursor = null, timeZone()) }
        }

    val patterns =
        cache.keyed<UUID, GoalMistakePattern>(Audience.SignedIn, DOMAINS) { session, goalId ->
            session?.let { api.pattern(it, goalId) }
        }

    /**
     * Appends the next page, unless a refresh or another session replaced the list meanwhile.
     * False when it didn't load, so the page offers to try again.
     */
    suspend fun more(key: NotebookKey): Boolean {
        val notebook = notebooks[key]
        val cursor =
            notebook.state.value.value
                ?.pagination
                ?.nextCursor ?: return true
        val session = sessions.current ?: return true
        val revision = notebook.revision

        val next =
            try {
                api.page(session, key, cursor, timeZone())
            } catch (e: ApiException) {
                if (e.error == ApiError.Unauthorized) sessions.expire(session)
                return false
            }

        if (sessions.current == session && notebook.revision == revision) {
            notebook.update { shown ->
                val seen = shown.`data`.mapTo(HashSet()) { it.id }
                shown.copy(`data` = shown.`data` + next.`data`.filterNot { it.id in seen }, pagination = next.pagination)
            }
        }
        return true
    }

    private companion object {
        val DOMAINS = setOf(DataDomain.LearnerModel, DataDomain.UserProgress)
    }
}
