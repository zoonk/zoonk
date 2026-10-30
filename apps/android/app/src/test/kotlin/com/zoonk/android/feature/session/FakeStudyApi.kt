package com.zoonk.android.feature.session

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.api.models.LessonGeneration
import com.zoonk.api.models.OpenStudyDayRequest
import com.zoonk.api.models.OpenedStudyDay
import com.zoonk.api.models.StudyBlock
import com.zoonk.api.models.StudySession
import com.zoonk.api.models.StudySessionSummary
import kotlinx.serialization.json.JsonObject
import java.util.UUID

internal class FakeStudyApi : StudyApi {
    val opened = mutableListOf<OpenStudyDayRequest>()
    val started = mutableListOf<UUID>()
    val prepared = mutableListOf<UUID>()
    val stopped = mutableListOf<UUID>()
    val written = mutableListOf<String>()
    var sessionReads = 0
    var summaryReads = 0
    var target: JsonObject? = null
    var targetStatus = "resolved"
    var startError: String? = null
    var writeError: ApiException? = null
    var generation = LessonGeneration(generationId = "run-1", status = LessonGeneration.Status.GENERATING)
    var session: StudySession = decodeFixture("study-session")
    var studySummary: StudySessionSummary = decodeFixture("study-session-summary")
    var openedSession: JsonObject? = null

    override suspend fun openDay(
        session: AuthenticatedSession,
        goalId: UUID,
        body: OpenStudyDayRequest,
    ): OpenedStudyDay {
        opened += body
        val day = openedSession
        return decodeFixture(
            "opened-study-day",
            "session" to (day ?: fixture("study-session")),
            *listOfNotNull(day?.let { "sessionId" to it.getValue("id") }).toTypedArray(),
            "target" to target,
            "targetStatus" to targetStatus,
        )
    }

    override suspend fun session(
        session: AuthenticatedSession,
        sessionId: UUID,
        timeZone: String,
    ): StudySession {
        sessionReads++
        return this.session
    }

    override suspend fun stop(
        session: AuthenticatedSession,
        sessionId: UUID,
        timeZone: String,
    ) {
        stopped += sessionId
    }

    override suspend fun summary(
        session: AuthenticatedSession,
        sessionId: UUID,
        timeZone: String,
    ): StudySessionSummary {
        summaryReads++
        return studySummary
    }

    override suspend fun addExtraBlock(
        session: AuthenticatedSession,
        sessionId: UUID,
    ): StudyBlock = error("Not used")

    override suspend fun catchUp(
        session: AuthenticatedSession,
        sessionId: UUID,
        timeZone: String,
    ) = Unit

    override suspend fun startBlock(
        session: AuthenticatedSession,
        sessionId: UUID,
        blockId: UUID,
        timeZone: String,
    ) {
        startError?.let { throw ApiException(ApiError.Unavailable, it) }
        started += blockId
    }

    override suspend fun prepare(
        session: AuthenticatedSession,
        sessionId: UUID,
    ) {
        prepared += sessionId
    }

    suspend fun writeLesson(
        session: AuthenticatedSession,
        lessonId: String,
    ): LessonGeneration {
        written += lessonId
        writeError?.let { throw it }
        return generation
    }
}
