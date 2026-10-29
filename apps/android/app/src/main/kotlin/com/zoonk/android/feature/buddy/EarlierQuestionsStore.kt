package com.zoonk.android.feature.buddy

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.Resource
import com.zoonk.android.data.SessionSource
import com.zoonk.android.data.value
import com.zoonk.api.models.EarlierQuestions
import java.util.UUID

fun interface EarlierQuestionsApi {
    suspend fun page(
        session: AuthenticatedSession,
        cursor: UUID?,
    ): EarlierQuestions
}

/** What the learner asked about lessons from before every course was rewritten: read-only history, newest first. */
class EarlierQuestionsStore(
    private val api: EarlierQuestionsApi,
    cache: AppCache,
    private val sessions: SessionSource,
) {
    val questions: Resource<EarlierQuestions> =
        cache.resource(Audience.SignedIn, isEmpty = { it.questions.isEmpty() }) { session -> session?.let { api.page(it, cursor = null) } }

    /**
     * Appends the older page, unless a refresh or another session replaced the list meanwhile.
     * False when it didn't load, so the page offers to try again.
     */
    suspend fun loadOlder(): Boolean {
        val cursor =
            questions.state.value.value
                ?.nextCursor ?: return true
        val session = sessions.current ?: return true
        val revision = questions.revision

        val older =
            try {
                api.page(session, cursor)
            } catch (e: ApiException) {
                if (e.error == ApiError.Unauthorized) sessions.expire(session)
                return false
            }

        if (sessions.current == session && questions.revision == revision) {
            questions.update { shown ->
                val seen = shown.questions.mapTo(HashSet()) { it.id }
                EarlierQuestions(nextCursor = older.nextCursor, questions = shown.questions + older.questions.filterNot { it.id in seen })
            }
        }

        return true
    }
}
