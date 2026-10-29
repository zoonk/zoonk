package com.zoonk.android.feature.session

import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.MutationResult
import com.zoonk.android.navigation.AppRoute
import com.zoonk.api.models.OpenedStudyDay
import com.zoonk.api.models.StudyBlock
import com.zoonk.api.models.StudySession
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import kotlinx.datetime.LocalDate
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonObject
import java.util.UUID

/** The study writes a tap makes; nothing here starts AI work. */
interface StudyApi {
    suspend fun openDay(
        session: AuthenticatedSession,
        goalId: UUID,
        body: JsonObject,
    ): OpenedStudyDay

    suspend fun session(
        session: AuthenticatedSession,
        sessionId: UUID,
        timeZone: String,
    ): StudySession

    /** A "10 more minutes" block after the day's session. */
    suspend fun addExtraBlock(
        session: AuthenticatedSession,
        sessionId: UUID,
    ): StudyBlock

    /** Moves the lessons left to catch up into today. */
    suspend fun catchUp(
        session: AuthenticatedSession,
        sessionId: UUID,
        timeZone: String,
    )

    /** Throws [ApiException] with `DAILY_LIMIT_REACHED`, `BLOCK_FINISHED` or `EARLIER_FIRST` when it can't start. */
    suspend fun startBlock(
        session: AuthenticatedSession,
        sessionId: UUID,
        blockId: UUID,
        timeZone: String,
    )

    /** Starts writing the session's coming lessons, so they're ready when the learner gets there. */
    suspend fun prepare(
        session: AuthenticatedSession,
        sessionId: UUID,
    )
}

/**
 * Opens a tapped step where its block says it plays (`screen`), saving the day first when it isn't
 * yet. A null route means the day changed meanwhile: the screen reads it again so the learner sees
 * the change before anything opens.
 */
class StudyOpener(
    private val api: StudyApi,
    private val cache: AppCache,
    private val timeZone: () -> String,
    private val scope: CoroutineScope,
) {
    suspend fun open(
        day: DayView,
        step: DayStep,
        next: Boolean,
        goalId: UUID,
    ): MutationResult<AppRoute?> =
        cache.mutate(invalidating = OPENING) { session ->
            val sessionId = day.sessionId
            if (sessionId != null && step.id != null) {
                route(session, sessionId, step)
            } else {
                val opened = api.openDay(session, day.goalId ?: goalId, openDayBody(day.localDate, step, next, timeZone()))
                val target = opened.target?.takeIf { opened.targetStatus in STARTABLE }
                target?.let { route(session, opened.sessionId, it.toDayStep()) }
            }
        }

    /**
     * A block end's Continue (main's `continueSession`): the session's next step, opened as Today
     * opens it, or the session's summary once nothing is left. Today when the day is over or the
     * step can't start, so Today says why.
     */
    suspend fun continueSession(sessionId: UUID): MutationResult<AppRoute> =
        cache.mutate(invalidating = OPENING) { session ->
            val read = api.session(session, sessionId, timeZone())
            val goalId = read.goalId
            // Opening saves what the queue gained since (a lapsed Plus block's replacement, lessons just written), as main's Continue does.
            val opened =
                if (read.current && goalId != null) {
                    api.openDay(session, goalId, openDayBody(read.localDate, null, next = false, timeZone())).session.takeIf {
                        it.id ==
                            sessionId
                    }
                } else {
                    null
                }
            val next = opened?.blocks?.firstOrNull { it.id == opened.nextBlockId }
            when {
                opened == null -> AppRoute.Today
                next == null -> AppRoute.Session(sessionId = sessionId.toString())
                else -> route(session, sessionId, next.toDayStep()) ?: AppRoute.Today
            }
        }

    /** Saves an unopened day first, keeping it even with nothing in it. */
    suspend fun addExtraTime(
        day: DayView,
        goalId: UUID,
    ): MutationResult<AppRoute?> =
        cache.mutate(invalidating = OPENING) { session ->
            val sessionId =
                day.sessionId
                    ?: api.openDay(session, day.goalId ?: goalId, openDayBody(day.localDate, null, next = false, timeZone())).sessionId
            route(session, sessionId, api.addExtraBlock(session, sessionId).toDayStep())
        }

    /** Saves an unopened day first, keeping it even with nothing in it. */
    suspend fun catchUp(
        day: DayView,
        goalId: UUID,
    ): MutationResult<Unit> =
        cache.mutate(invalidating = setOf(DataDomain.Goals, DataDomain.UserSession)) { session ->
            val sessionId =
                day.sessionId
                    ?: api.openDay(session, day.goalId ?: goalId, openDayBody(day.localDate, null, next = false, timeZone())).sessionId
            api.catchUp(session, sessionId, timeZone())
        }

    private suspend fun route(
        session: AuthenticatedSession,
        sessionId: UUID,
        step: DayStep,
    ): AppRoute? {
        val blockId = step.id ?: return null
        val lessonId = step.lessonId

        // The lesson's page writes it with its own wait and retry; preparing too would compete with that request.
        if (step.kind == StudyBlock.Kind.LEARN && step.screen == StudyBlock.Screen.SESSION && lessonId != null) {
            return AppRoute.Lesson(lessonId.toString(), sessionId.toString())
        }

        return when (step.screen) {
            StudyBlock.Screen.SESSION -> {
                if (step.kind == StudyBlock.Kind.LEARN) {
                    unstarted(session, sessionId, AppRoute.Session(blockId = blockId.toString()))
                } else {
                    started(session, sessionId, blockId) { AppRoute.QuestionBlock(sessionId.toString(), blockId.toString()) }
                }
            }

            StudyBlock.Screen.UNKNOWN -> {
                unstarted(session, sessionId, AppRoute.Session(blockId = blockId.toString()))
            }

            StudyBlock.Screen.LESSON -> {
                if (lessonId == null) {
                    unstarted(session, sessionId, AppRoute.Session(blockId = blockId.toString()))
                } else {
                    started(session, sessionId, blockId) { AppRoute.Lesson(lessonId.toString(), sessionId.toString()) }
                }
            }

            StudyBlock.Screen.ESSAY -> {
                started(session, sessionId, blockId) { AppRoute.Essay(blockId.toString()) }
            }

            StudyBlock.Screen.CHALLENGE -> {
                val planItemId = step.planItemId

                // A challenge not begun yet opens on its intro, which starts it.
                if (step.status != StudyBlock.Status.ACTIVE && planItemId != null) {
                    unstarted(session, sessionId, AppRoute.Challenge(planItemId.toString(), sessionId.toString()))
                } else {
                    started(session, sessionId, blockId) {
                        if (step.checkpointFacts?.mock == true) {
                            AppRoute.Mock(blockId.toString(), sessionId.toString())
                        } else {
                            AppRoute.Checkpoint(blockId.toString(), sessionId.toString())
                        }
                    }
                }
            }
        }
    }

    /**
     * Opens without starting a block, so it asks the session to write its coming lessons, as a
     * block's start does on the server. Not awaited, so the screen opens at once; a failed request
     * only means the next open asks again.
     */
    private fun unstarted(
        session: AuthenticatedSession,
        sessionId: UUID,
        route: AppRoute,
    ): AppRoute {
        scope.launch {
            try {
                api.prepare(session, sessionId)
            } catch (_: ApiException) {
            }
        }
        return route
    }

    private suspend fun started(
        session: AuthenticatedSession,
        sessionId: UUID,
        blockId: UUID,
        route: () -> AppRoute,
    ): AppRoute? =
        try {
            api.startBlock(session, sessionId, blockId, timeZone())
            route()
        } catch (e: ApiException) {
            when (e.code) {
                // Finished meanwhile, on another device: the session says what's next.
                "BLOCK_FINISHED" -> AppRoute.Session()

                "DAILY_LIMIT_REACHED", "EARLIER_FIRST" -> null

                else -> throw e
            }
        }

    private companion object {
        /** Opening saves the day's plan and session and starting marks a block begun; progress changes only as work finishes. */
        val OPENING = setOf(DataDomain.Goals, DataDomain.UserSession)

        val STARTABLE = setOf(OpenedStudyDay.TargetStatus.NEXT, OpenedStudyDay.TargetStatus.RESOLVED)
    }
}

/**
 * Names the shown step by its work, never by position alone, so a changed day never opens other
 * work; core needs the ref's `null`s, which generated bodies leave out.
 */
internal fun openDayBody(
    shownDate: LocalDate,
    step: DayStep?,
    next: Boolean,
    timeZone: String,
): JsonObject =
    buildJsonObject {
        put("shownDate", shownDate.toString())
        put("timeZone", timeZone)

        if (step == null) {
            put("keepEmpty", true)
        } else if (next) {
            putJsonObject("target") {
                put("kind", "next")
                put("shown", step.ref())
            }
        } else {
            putJsonObject("target") {
                put("kind", "ref")
                put("ref", step.ref())
            }
        }
    }

private fun DayStep.ref(): JsonObject =
    buildJsonObject {
        put("areaId", areaId)
        put("chapterId", chapterId?.toString())
        put("checkpoint", checkpointRef())
        putJsonObject("flags") {
            put("extra", extra)
            put("fullReview", fullReview)
            put("mistakesOnly", mistakesOnly)
            put("refresh", refresh)
            put("reinforcement", reinforcement)
            put("weakest", weakest)
        }
        put("kind", kind.value)
        put("lessonId", lessonId?.toString())
        put("planItemKey", planItemKey)
        put("position", position)
    }

private fun DayStep.checkpointRef() =
    when (val checkpoint = checkpoint) {
        null -> {
            JsonNull
        }

        is com.zoonk.api.models.StudyCheckpoint.StudyCheckpointOneOfValue -> {
            buildJsonObject {
                put("kind", checkpoint.value.kind.value)
                put("mock", true)
                putJsonObject("mockIdentity") {
                    put("day", checkpoint.value.mockIdentity.day)
                    put("fullLength", checkpoint.value.mockIdentity.fullLength)
                }
                put("phase", checkpoint.value.phase)
                put("rematch", checkpoint.value.rematch)
            }
        }

        is com.zoonk.api.models.StudyCheckpoint.StudyCheckpointOneOf1Value -> {
            buildJsonObject {
                put("kind", checkpoint.value.kind.value)
                put("mock", false)
                put("phase", checkpoint.value.phase)
                put("rematch", checkpoint.value.rematch)
            }
        }
    }
