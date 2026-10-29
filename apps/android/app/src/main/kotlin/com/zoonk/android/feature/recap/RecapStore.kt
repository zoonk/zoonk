package com.zoonk.android.feature.recap

import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.api.models.WeeklyRecap
import java.util.UUID

fun interface RecapApi {
    /** The last full week of [goalId], in the device's [timeZone]. */
    suspend fun weeklyRecap(
        session: AuthenticatedSession,
        goalId: UUID,
        timeZone: String,
    ): WeeklyRecap
}

class RecapStore(
    api: RecapApi,
    cache: AppCache,
    timeZone: () -> String,
) {
    /** By goal: the recap is the active goal's week. */
    val weeklyRecap =
        cache.keyed<UUID, WeeklyRecap>(Audience.SignedIn, setOf(DataDomain.UserProgress, DataDomain.Goals)) { session, goalId ->
            session?.let { api.weeklyRecap(it, goalId, timeZone()) }
        }
}
