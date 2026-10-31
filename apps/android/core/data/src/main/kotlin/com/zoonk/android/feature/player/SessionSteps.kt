package com.zoonk.android.feature.player

import com.zoonk.android.data.MutationResult
import com.zoonk.android.navigation.AppRoute
import java.util.UUID

/** A session block's Continue and Stop for today (main's `useStudyNavigation`). */
interface SessionSteps {
    /** The session's next step, its summary once nothing is left, or Today when the day is over. */
    suspend fun continueSession(sessionId: UUID): MutationResult<AppRoute>

    /** The stopped session's summary. */
    suspend fun stop(sessionId: UUID): MutationResult<AppRoute>
}
