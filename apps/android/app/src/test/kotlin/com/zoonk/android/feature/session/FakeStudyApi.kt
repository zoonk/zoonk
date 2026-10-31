package com.zoonk.android.feature.session

import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.api.ApiJson
import com.zoonk.api.models.LessonGeneration
import com.zoonk.api.models.OpenStudyDayRequest
import com.zoonk.api.models.OpenedStudyDay
import com.zoonk.api.models.StudyBlock
import com.zoonk.api.models.StudyBlockOpening
import com.zoonk.api.models.StudyBlockOpeningTarget
import com.zoonk.api.models.StudySession
import com.zoonk.api.models.StudySessionSummary
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import java.util.UUID

internal fun opening(
    kind: String,
    vararg fields: Pair<String, Any?>,
): JsonObject = JsonObject(mapOf("kind" to JsonPrimitive(kind)) + fields.associate { (key, value) -> key to value.toJson() })

internal class FakeStudyApi : StudyApi {
    val opened = mutableListOf<OpenStudyDayRequest>()
    val targets = mutableListOf<StudyBlockOpeningTarget>()
    val added = mutableListOf<UUID>()
    val stopped = mutableListOf<UUID>()
    val written = mutableListOf<String>()
    var sessionReads = 0
    var summaryReads = 0
    var target: JsonObject? = null
    var targetStatus = "resolved"
    var dayOpening: JsonObject? = null

    /** The answer to each block opening, in order; the last one answers the rest. */
    var openings = listOf(opening("session", "blockId" to null))

    /** Thrown by the next requests, one each, before they answer. */
    val failures = ArrayDeque<ApiException>()
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
        failures.removeFirstOrNull()?.let { throw it }
        val day = openedSession
        return decodeFixture(
            "opened-study-day",
            "session" to (day ?: fixture("study-session")),
            *listOfNotNull(day?.let { "sessionId" to it.getValue("id") }).toTypedArray(),
            "target" to target,
            "targetStatus" to targetStatus,
            "opening" to dayOpening,
        )
    }

    override suspend fun openBlock(
        session: AuthenticatedSession,
        target: StudyBlockOpeningTarget,
        timeZone: String,
    ): StudyBlockOpening {
        targets += target
        failures.removeFirstOrNull()?.let { throw it }
        return ApiJson.decodeFromJsonElement(StudyBlockOpening.serializer(), openings[minOf(targets.size, openings.size) - 1])
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
    ): StudyBlock {
        added += sessionId
        return decodeFixture("study-block", "id" to EXTRA_BLOCK.toString(), "extra" to true)
    }

    override suspend fun catchUp(
        session: AuthenticatedSession,
        sessionId: UUID,
        timeZone: String,
    ) = Unit

    suspend fun writeLesson(
        session: AuthenticatedSession,
        lessonId: String,
    ): LessonGeneration {
        written += lessonId
        writeError?.let { throw it }
        return generation
    }

    companion object {
        val EXTRA_BLOCK: UUID = UUID.fromString("5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2eff")
    }
}
