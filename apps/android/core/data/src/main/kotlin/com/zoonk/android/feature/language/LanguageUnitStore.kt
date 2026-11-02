package com.zoonk.android.feature.language

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.perform
import com.zoonk.api.models.LanguageUnit
import java.util.UUID

fun interface LanguageUnitApi {
    suspend fun unit(
        session: AuthenticatedSession?,
        chapterId: UUID,
    ): LanguageUnit
}

class LiveLanguageUnitApi(
    private val api: ApiClients,
) : LanguageUnitApi {
    override suspend fun unit(
        session: AuthenticatedSession?,
        chapterId: UUID,
    ): LanguageUnit = perform { api.clients(session).language.getLanguageUnit(chapterId) }
}

/** Core reads the unit fresh from the plan, today's session, mistakes and call allowance, so it follows all of them. */
class LanguageUnitStore(
    api: LanguageUnitApi,
    cache: AppCache,
) {
    private val units =
        cache.keyed<UUID, LanguageUnit>(
            Audience.SignedIn,
            setOf(
                DataDomain.Allowance,
                DataDomain.Goals,
                DataDomain.LearnerModel,
                DataDomain.UserProgress,
                DataDomain.UserSession,
                DataDomain.UserSubscription,
            ),
        ) { session, chapterId ->
            api.unit(session, chapterId)
        }

    fun unit(chapterId: UUID) = units[chapterId]
}
