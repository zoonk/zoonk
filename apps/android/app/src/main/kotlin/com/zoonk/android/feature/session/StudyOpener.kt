package com.zoonk.android.feature.session

import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.recode
import com.zoonk.android.navigation.AppRoute
import com.zoonk.api.models.OpenStudyDayRequest
import com.zoonk.api.models.OpenStudyDayRequestTarget
import com.zoonk.api.models.OpenStudyDayRequestTargetOneOf
import com.zoonk.api.models.OpenStudyDayRequestTargetOneOf1
import com.zoonk.api.models.OpenStudyDayRequestTargetOneOfShown
import com.zoonk.api.models.OpenStudyDayRequestTargetOneOfShownCheckpoint
import com.zoonk.api.models.OpenStudyDayRequestTargetOneOfShownFlags
import com.zoonk.api.models.OpenedStudyDay
import com.zoonk.api.models.StudyBlock
import com.zoonk.api.models.StudyCheckpoint
import com.zoonk.api.models.StudySession
import com.zoonk.api.models.StudySessionSummary
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import kotlinx.datetime.LocalDate
import java.util.UUID

/** The study reads, and the writes a tap makes; nothing here starts AI work. */
interface StudyApi {
    suspend fun openDay(
        session: AuthenticatedSession,
        goalId: UUID,
        body: OpenStudyDayRequest,
    ): OpenedStudyDay

    suspend fun session(
        session: AuthenticatedSession,
        sessionId: UUID,
        timeZone: String,
    ): StudySession

    suspend fun summary(
        session: AuthenticatedSession,
        sessionId: UUID,
        timeZone: String,
    ): StudySessionSummary

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

    suspend fun stop(
        session: AuthenticatedSession,
        sessionId: UUID,
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

    /** Stop for today: the session's summary says what's done so far and offers to keep going. */
    suspend fun stop(sessionId: UUID): MutationResult<AppRoute> =
        cache.mutate(invalidating = STOPPING) { session ->
            api.stop(session, sessionId, timeZone())
            AppRoute.Session(sessionId = sessionId.toString(), stopped = true)
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

        val waits = AppRoute.Session(blockId = blockId.toString(), sessionId = sessionId.toString())

        return when (step.screen) {
            StudyBlock.Screen.SESSION -> {
                if (step.kind == StudyBlock.Kind.LEARN) {
                    unstarted(session, sessionId, waits)
                } else {
                    started(session, sessionId, blockId) { AppRoute.QuestionBlock(sessionId.toString(), blockId.toString()) }
                }
            }

            StudyBlock.Screen.UNKNOWN -> {
                unstarted(session, sessionId, waits)
            }

            StudyBlock.Screen.LESSON -> {
                if (lessonId == null) {
                    unstarted(session, sessionId, waits)
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
                "BLOCK_FINISHED" -> AppRoute.Session(sessionId = sessionId.toString())

                "DAILY_LIMIT_REACHED", "EARLIER_FIRST" -> null

                else -> throw e
            }
        }

    private companion object {
        /** Opening saves the day's plan and session and starting marks a block begun; progress changes only as work finishes. */
        val OPENING = setOf(DataDomain.Goals, DataDomain.UserSession)

        /** As a finished block's, since stopping ends the session where it is. */
        val STOPPING = setOf(DataDomain.Goals, DataDomain.LearnerModel, DataDomain.UserProgress, DataDomain.UserSession)

        val STARTABLE = setOf(OpenedStudyDay.TargetStatus.NEXT, OpenedStudyDay.TargetStatus.RESOLVED)
    }
}

/** A lesson step whose lesson isn't made yet, which [StudyOpener] opens on the session screen to wait for it. */
internal fun DayStep.waitsForItsLesson(): Boolean =
    lessonId == null && (screen == StudyBlock.Screen.LESSON || (screen == StudyBlock.Screen.SESSION && kind == StudyBlock.Kind.LEARN))

/** Names the shown step by its work, never by position alone, so a changed day never opens other work. */
internal fun openDayBody(
    shownDate: LocalDate,
    step: DayStep?,
    next: Boolean,
    timeZone: String,
) = OpenStudyDayRequest(
    shownDate = shownDate,
    keepEmpty = true.takeIf { step == null },
    target =
        step?.shown()?.let { shown ->
            if (next) {
                OpenStudyDayRequestTarget.OpenStudyDayRequestTargetOneOfValue(
                    OpenStudyDayRequestTargetOneOf(OpenStudyDayRequestTargetOneOf.Kind.NEXT, shown),
                )
            } else {
                OpenStudyDayRequestTarget.OpenStudyDayRequestTargetOneOf1Value(
                    OpenStudyDayRequestTargetOneOf1(OpenStudyDayRequestTargetOneOf1.Kind.REF, shown.recode()),
                )
            }
        },
    timeZone = timeZone,
)

private fun DayStep.shown() =
    OpenStudyDayRequestTargetOneOfShown(
        areaId = areaId,
        chapterId = chapterId,
        checkpoint = checkpoint?.recode<StudyCheckpoint, OpenStudyDayRequestTargetOneOfShownCheckpoint>(),
        flags = OpenStudyDayRequestTargetOneOfShownFlags(extra, fullReview, mistakesOnly, refresh, reinforcement, weakest),
        kind = OpenStudyDayRequestTargetOneOfShown.Kind.valueOf(kind.name),
        lessonId = lessonId,
        planItemKey = planItemKey,
        position = position,
    )
