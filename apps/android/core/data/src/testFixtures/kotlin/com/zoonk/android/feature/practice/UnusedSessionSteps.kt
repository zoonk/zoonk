package com.zoonk.android.feature.practice

import com.zoonk.android.data.MutationResult
import com.zoonk.android.feature.player.SessionSteps
import com.zoonk.android.navigation.AppRoute
import java.util.UUID

object UnusedSessionSteps : SessionSteps {
    override suspend fun continueSession(sessionId: UUID): MutationResult<AppRoute> = error("Not used")

    override suspend fun stop(sessionId: UUID): MutationResult<AppRoute> = error("Not used")
}
