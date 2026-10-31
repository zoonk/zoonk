package com.zoonk.android.feature.session

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.perform
import com.zoonk.api.models.OpenStudyDayRequest
import com.zoonk.api.models.OpenedStudyDay
import com.zoonk.api.models.StudyBlock
import com.zoonk.api.models.StudyBlockOpening
import com.zoonk.api.models.StudyBlockOpeningInput
import com.zoonk.api.models.StudyBlockOpeningTarget
import com.zoonk.api.models.StudySession
import com.zoonk.api.models.StudySessionSummary
import com.zoonk.api.models.StudySessionTimeZone
import java.util.UUID

class LiveStudyApi(
    private val api: ApiClients,
) : StudyApi {
    override suspend fun openDay(
        session: AuthenticatedSession,
        goalId: UUID,
        body: OpenStudyDayRequest,
    ): OpenedStudyDay = perform { api.clients(session).studySessions.openStudyDay(goalId, body) }

    override suspend fun openBlock(
        session: AuthenticatedSession,
        target: StudyBlockOpeningTarget,
        timeZone: String,
    ): StudyBlockOpening = perform { api.clients(session).studySessions.openStudyBlock(StudyBlockOpeningInput(target, timeZone)) }

    override suspend fun session(
        session: AuthenticatedSession,
        sessionId: UUID,
        timeZone: String,
    ): StudySession = perform { api.clients(session).studySessions.getStudySession(sessionId, timeZone) }

    override suspend fun summary(
        session: AuthenticatedSession,
        sessionId: UUID,
        timeZone: String,
    ): StudySessionSummary = perform { api.clients(session).studySessions.getStudySessionSummary(sessionId, timeZone) }

    override suspend fun addExtraBlock(
        session: AuthenticatedSession,
        sessionId: UUID,
    ): StudyBlock = perform { api.clients(session).studySessions.createStudyExtraBlock(sessionId) }

    override suspend fun catchUp(
        session: AuthenticatedSession,
        sessionId: UUID,
        timeZone: String,
    ) {
        perform { api.clients(session).studySessions.createStudyCatchUpBlocks(sessionId, StudySessionTimeZone(timeZone)) }
    }

    override suspend fun stop(
        session: AuthenticatedSession,
        sessionId: UUID,
        timeZone: String,
    ) {
        perform { api.clients(session).studySessions.createStudySessionStop(sessionId, StudySessionTimeZone(timeZone)) }
    }
}
