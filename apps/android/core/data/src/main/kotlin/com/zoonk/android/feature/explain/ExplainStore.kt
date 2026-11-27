package com.zoonk.android.feature.explain

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.perform
import com.zoonk.android.feature.player.model.PlayableLesson
import com.zoonk.android.feature.player.model.toPlayableLesson
import com.zoonk.api.models.Explanation
import java.util.UUID

interface ExplainApi {
    suspend fun explanation(
        session: AuthenticatedSession,
        goalId: String,
    ): Explanation

    /** Starts writing it again and gives its run. */
    suspend fun writeAgain(
        session: AuthenticatedSession,
        goalId: String,
    ): String
}

class LiveExplainApi(
    private val api: ApiClients,
) : ExplainApi {
    override suspend fun explanation(
        session: AuthenticatedSession,
        goalId: String,
    ) = perform { api.clients(session).onboarding.getExplanation(UUID.fromString(goalId)) }

    override suspend fun writeAgain(
        session: AuthenticatedSession,
        goalId: String,
    ) = perform { api.clients(session).contentGeneration.createGoalGeneration(UUID.fromString(goalId)) }.generationId
}

data class LoadedExplanation(
    val explanation: Explanation,
    val lesson: PlayableLesson?,
)

/** Quick explanations by goal id, kept across opening and closing them. */
class ExplainStore(
    val api: ExplainApi,
    cache: AppCache,
) {
    private val explanations =
        cache.keyed<String, LoadedExplanation>(Audience.SignedIn, setOf(DataDomain.Goals)) { session, goalId ->
            session?.let {
                val explanation = api.explanation(it, goalId)
                LoadedExplanation(explanation, explanation.lesson?.toPlayableLesson()?.copy(title = explanation.title))
            }
        }

    fun explanation(goalId: String) = explanations[goalId]
}
