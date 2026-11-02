package com.zoonk.android.feature.pattern

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.perform
import com.zoonk.api.models.MistakePattern
import com.zoonk.api.models.MistakePatternPracticeInput
import com.zoonk.api.models.MistakePatternPracticeResult
import java.util.UUID

interface PatternApi {
    suspend fun pattern(
        session: AuthenticatedSession,
        patternId: UUID,
    ): MistakePattern

    suspend fun practice(
        session: AuthenticatedSession,
        patternId: UUID,
        input: MistakePatternPracticeInput,
    ): MistakePatternPracticeResult

    suspend fun dismiss(
        session: AuthenticatedSession,
        patternId: UUID,
    )
}

class LivePatternApi(
    private val api: ApiClients,
) : PatternApi {
    override suspend fun pattern(
        session: AuthenticatedSession,
        patternId: UUID,
    ) = perform { api.clients(session).language.getMistakePattern(patternId) }

    override suspend fun practice(
        session: AuthenticatedSession,
        patternId: UUID,
        input: MistakePatternPracticeInput,
    ) = perform { api.clients(session).language.practiceMistakePattern(patternId, input) }

    override suspend fun dismiss(
        session: AuthenticatedSession,
        patternId: UUID,
    ) = perform { api.clients(session).language.dismissMistakePattern(patternId) }
}

class PatternStore(
    private val api: PatternApi,
    private val cache: AppCache,
    private val timeZone: () -> String,
) {
    val patterns =
        cache.keyed<UUID, MistakePattern>(Audience.SignedIn, setOf(DataDomain.UserProgress)) { session, patternId ->
            session?.let { api.pattern(it, patternId) }
        }

    /** Sending the same [requestId] again returns what the drill already counted. */
    suspend fun practice(
        patternId: UUID,
        answers: List<String>,
        requestId: UUID,
    ): MutationResult<MistakePatternPracticeResult> =
        cache.mutate(invalidating = setOf(DataDomain.UserProgress, DataDomain.UserSession)) { session ->
            api.practice(session, patternId, MistakePatternPracticeInput(answers, requestId, timeZone()))
        }

    suspend fun dismiss(patternId: UUID): MutationResult<Unit> =
        cache.mutate(invalidating = setOf(DataDomain.UserProgress)) { api.dismiss(it, patternId) }
}
