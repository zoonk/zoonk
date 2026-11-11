package com.zoonk.android.feature.session

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.ApiException
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
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
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
        timeZone: String,
    ): StudyBlock? =
        try {
            perform { api.clients(session).studySessions.createStudyExtraBlock(sessionId, StudySessionTimeZone(timeZone)) }
        } catch (e: ApiException) {
            if (e.isDayOver()) null else throw e
        }

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

/** `EXTRA_TIME_UNAVAILABLE` says why in `details.reason`. */
private fun ApiException.isDayOver(): Boolean =
    code == "EXTRA_TIME_UNAVAILABLE" && ((details as? JsonObject)?.get("reason") as? JsonPrimitive)?.contentOrNull == "dayOver"
