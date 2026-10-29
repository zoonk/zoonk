package com.zoonk.android.feature.session

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.perform
import com.zoonk.api.models.OpenedStudyDay
import com.zoonk.api.models.StudyBlock
import com.zoonk.api.models.StudyBlockStart
import kotlinx.serialization.json.JsonObject
import java.util.UUID

class LiveStudyApi(
    private val api: ApiClients,
) : StudyApi {
    override suspend fun openDay(
        session: AuthenticatedSession,
        goalId: UUID,
        body: JsonObject,
    ): OpenedStudyDay = perform { api.clients(session).jsonBodies.openStudyDay(goalId, body) }

    override suspend fun addExtraBlock(
        session: AuthenticatedSession,
        sessionId: UUID,
    ): StudyBlock = perform { api.clients(session).studySessions.createStudyExtraBlock(sessionId) }

    override suspend fun startBlock(
        session: AuthenticatedSession,
        sessionId: UUID,
        blockId: UUID,
        timeZone: String,
    ) {
        perform { api.clients(session).studySessions.createStudyBlockStart(sessionId, blockId, StudyBlockStart(timeZone = timeZone)) }
    }
}
