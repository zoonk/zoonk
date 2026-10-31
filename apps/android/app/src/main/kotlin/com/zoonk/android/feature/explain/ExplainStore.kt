package com.zoonk.android.feature.explain

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.perform
import com.zoonk.api.models.Explanation
import com.zoonk.api.models.GenerationWaitInput
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

    suspend fun recordWait(
        session: AuthenticatedSession,
        milliseconds: Long,
    )
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

    override suspend fun recordWait(
        session: AuthenticatedSession,
        milliseconds: Long,
    ) {
        perform {
            api.clients(session).contentGeneration.createGenerationWait(
                GenerationWaitInput(
                    contentKind = GenerationWaitInput.ContentKind.EXPLANATION,
                    milliseconds = milliseconds,
                    platform = GenerationWaitInput.Platform.ANDROID,
                ),
            )
        }
    }
}

/** Quick explanations by goal id, kept across opening and closing them. */
class ExplainStore(
    val api: ExplainApi,
    cache: AppCache,
) {
    private val explanations =
        cache.keyed<String, Explanation>(Audience.SignedIn, setOf(DataDomain.Goals)) { session, goalId ->
            session?.let { api.explanation(it, goalId) }
        }

    fun explanation(goalId: String) = explanations[goalId]
}
