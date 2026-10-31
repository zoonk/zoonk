package com.zoonk.android.feature.session

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.recode
import com.zoonk.android.feature.player.LessonWriting
import com.zoonk.android.feature.player.SessionSteps
import com.zoonk.android.feature.player.engine.LessonRefusal
import com.zoonk.android.feature.player.toNotWritten
import com.zoonk.android.navigation.AppRoute
import com.zoonk.api.models.LessonGeneration
import com.zoonk.api.models.OpenStudyDayRequest
import com.zoonk.api.models.OpenStudyDayRequestTarget
import com.zoonk.api.models.OpenStudyDayRequestTargetOneOf
import com.zoonk.api.models.OpenStudyDayRequestTargetOneOf1
import com.zoonk.api.models.OpenStudyDayRequestTargetOneOfShown
import com.zoonk.api.models.OpenStudyDayRequestTargetOneOfShownCheckpoint
import com.zoonk.api.models.OpenStudyDayRequestTargetOneOfShownFlags
import com.zoonk.api.models.OpenedStudyDay
import com.zoonk.api.models.StudyBlock
import com.zoonk.api.models.StudyBlockOpening
import com.zoonk.api.models.StudyBlockOpeningBlock
import com.zoonk.api.models.StudyBlockOpeningMission
import com.zoonk.api.models.StudyBlockOpeningNext
import com.zoonk.api.models.StudyBlockOpeningTarget
import com.zoonk.api.models.StudyBlockOpeningUnwrittenLesson
import com.zoonk.api.models.StudyCheckpoint
import com.zoonk.api.models.StudySession
import com.zoonk.api.models.StudySessionSummary
import kotlinx.datetime.LocalDate
import java.util.UUID

/** The study reads, and the writes a tap makes; nothing here starts AI work. */
interface StudyApi {
    suspend fun openDay(
        session: AuthenticatedSession,
        goalId: UUID,
        body: OpenStudyDayRequest,
    ): OpenedStudyDay

    /** Where a block of a saved day opens; the server starts it when its screen doesn't. */
    suspend fun openBlock(
        session: AuthenticatedSession,
        target: StudyBlockOpeningTarget,
        timeZone: String,
    ): StudyBlockOpening

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

    suspend fun stop(
        session: AuthenticatedSession,
        sessionId: UUID,
        timeZone: String,
    )
}

/**
 * Opens what the learner chose where the server says it opens, saving the day first when it isn't
 * yet. A null route means nothing opened (the day changed meanwhile): the screen reads it again so
 * the learner sees the change first.
 */
class StudyOpener(
    private val api: StudyApi,
    private val writeLesson: suspend (AuthenticatedSession, String) -> LessonGeneration,
    private val cache: AppCache,
    private val timeZone: () -> String,
) : SessionSteps {
    private val refusals = mutableMapOf<UUID, LessonWriting>()

    /** Why the API wouldn't write the lesson a tap asked for on this block, for the session's step to say. */
    fun notWritten(blockId: UUID): LessonWriting? = refusals[blockId]

    /** [next] is Continue on the step the learner saw as next; otherwise the tap opens that step. */
    suspend fun open(
        day: DayView,
        step: DayStep,
        next: Boolean,
        goalId: UUID,
    ): MutationResult<AppRoute?> =
        cache.mutate(invalidating = OPENING) { session ->
            val sessionId = day.sessionId
            val blockId = step.id
            if (sessionId != null && blockId != null) {
                follow(session, openBlock(session, if (next) nextTarget(sessionId, blockId) else blockTarget(blockId)), sessionId)
            } else {
                val opened = retryingOnce { api.openDay(session, day.goalId ?: goalId, openDayBody(day.localDate, step, next, timeZone())) }
                opened.opening?.let { follow(session, it, opened.sessionId) }
            }
        }

    /** A mission card's block, which opens only while it's still free to start; one gone meanwhile opens nothing either. */
    suspend fun openMission(
        blockId: UUID,
        sessionId: UUID,
    ): MutationResult<AppRoute?> =
        cache.mutate(invalidating = OPENING) { session ->
            val target = StudyBlockOpeningTarget.MissionWrapper(StudyBlockOpeningMission(blockId, StudyBlockOpeningMission.Kind.MISSION))
            val opening =
                try {
                    openBlock(session, target)
                } catch (e: ApiException) {
                    if (e.error == ApiError.NotFound) return@mutate null else throw e
                }
            follow(session, opening, sessionId)
        }

    override suspend fun continueSession(sessionId: UUID): MutationResult<AppRoute> =
        cache.mutate(invalidating = OPENING) { session ->
            val target = StudyBlockOpeningTarget.NextWrapper(StudyBlockOpeningNext(StudyBlockOpeningNext.Kind.NEXT, sessionId))
            follow(session, openBlock(session, target), sessionId) ?: AppRoute.Today
        }

    /** Stop for today: the session's summary says what's done so far and offers to keep going. */
    override suspend fun stop(sessionId: UUID): MutationResult<AppRoute> =
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
            val sessionId = day.sessionId ?: keep(session, day, goalId)
            val added = api.addExtraBlock(session, sessionId)
            follow(session, openBlock(session, blockTarget(added.id)), sessionId)
        }

    /** Saves an unopened day first, keeping it even with nothing in it. */
    suspend fun catchUp(
        day: DayView,
        goalId: UUID,
    ): MutationResult<Unit> =
        cache.mutate(invalidating = setOf(DataDomain.Goals, DataDomain.UserSession)) { session ->
            api.catchUp(session, day.sessionId ?: keep(session, day, goalId), timeZone())
        }

    private suspend fun keep(
        session: AuthenticatedSession,
        day: DayView,
        goalId: UUID,
    ): UUID =
        retryingOnce { api.openDay(session, day.goalId ?: goalId, openDayBody(day.localDate, null, next = false, timeZone())) }.sessionId

    private suspend fun openBlock(
        session: AuthenticatedSession,
        target: StudyBlockOpeningTarget,
    ): StudyBlockOpening = retryingOnce { api.openBlock(session, target, timeZone()) }

    private suspend fun follow(
        session: AuthenticatedSession,
        opening: StudyBlockOpening,
        sessionId: UUID,
    ): AppRoute? = if (opening is StudyBlockOpening.UnwrittenlessonWrapper) unwritten(session, opening.value) else opening.route(sessionId)

    /**
     * Main's `useOpenUnwrittenLesson`: the tap asks once for the lesson, and the session waits on the
     * block while it's written; one written already opens its block again, which starts it.
     */
    private suspend fun unwritten(
        session: AuthenticatedSession,
        opening: StudyBlockOpeningUnwrittenLesson,
    ): AppRoute? {
        val blockId = opening.blockId
        val waiting = AppRoute.Session(blockId = blockId.toString(), sessionId = opening.sessionId.toString())
        val generation =
            try {
                writeLesson(session, opening.lessonId.toString())
            } catch (e: ApiException) {
                refusals[blockId] = e.toNotWritten()?.takeUnless { it == LessonWriting.Refused(LessonRefusal.NotFound) } ?: throw e
                return waiting
            }

        refusals -= blockId
        return if (generation.status ==
            LessonGeneration.Status.READY
        ) {
            openBlock(session, blockTarget(blockId)).route(opening.sessionId)
        } else {
            waiting
        }
    }

    private companion object {
        /** Opening saves the day's plan and session and starting marks a block begun; progress changes only as work finishes. */
        val OPENING = setOf(DataDomain.Goals, DataDomain.UserSession)

        /** As a finished block's, since stopping ends the session where it is. */
        val STOPPING = setOf(DataDomain.Goals, DataDomain.LearnerModel, DataDomain.UserProgress, DataDomain.UserSession)
    }
}

/** The contract asks for a request that lost a race with a plan change to be sent once more, on its own. */
private suspend fun <T> retryingOnce(request: suspend () -> T): T =
    try {
        request()
    } catch (e: ApiException) {
        if (e.code == "STUDY_DAY_RETRYABLE") request() else throw e
    }

private fun nextTarget(
    sessionId: UUID,
    shown: UUID,
) = StudyBlockOpeningTarget.NextWrapper(StudyBlockOpeningNext(StudyBlockOpeningNext.Kind.NEXT, sessionId, expectedBlockId = shown))

private fun blockTarget(blockId: UUID) =
    StudyBlockOpeningTarget.BlockWrapper(StudyBlockOpeningBlock(blockId, StudyBlockOpeningBlock.Kind.BLOCK))

/** The screen an opening shows, in the session the caller opened it in when the opening doesn't say. */
internal fun StudyBlockOpening.route(sessionId: UUID): AppRoute? =
    when (this) {
        is StudyBlockOpening.LessonWrapper -> {
            AppRoute.Lesson(value.lessonId.toString(), value.sessionId.toString())
        }

        is StudyBlockOpening.UnwrittenlessonWrapper -> {
            AppRoute.Session(blockId = value.blockId.toString(), sessionId = value.sessionId.toString())
        }

        is StudyBlockOpening.PreparinglessonWrapper -> {
            AppRoute.Session(blockId = value.blockId.toString(), sessionId = sessionId.toString())
        }

        is StudyBlockOpening.EssayWrapper -> {
            AppRoute.Essay(value.blockId.toString())
        }

        is StudyBlockOpening.CheckpointWrapper -> {
            AppRoute.Checkpoint(value.blockId.toString(), value.sessionId.toString())
        }

        is StudyBlockOpening.MockWrapper -> {
            AppRoute.Mock(value.blockId.toString(), value.sessionId.toString())
        }

        is StudyBlockOpening.ChallengeWrapper -> {
            AppRoute.Challenge(value.planItemId.toString(), value.sessionId.toString())
        }

        is StudyBlockOpening.SessionWrapper -> {
            value.blockId?.let { AppRoute.QuestionBlock(sessionId.toString(), it.toString()) }
                ?: AppRoute.Session(sessionId = sessionId.toString())
        }

        is StudyBlockOpening.TodayWrapper -> {
            AppRoute.Today
        }

        is StudyBlockOpening.ChangedWrapper -> {
            null
        }
    }

/** A lesson step whose lesson is picked but not written, which a tap asks [StudyOpener] to write. */
internal fun DayStep.isUnwrittenLesson(): Boolean = kind == StudyBlock.Kind.LEARN && screen == StudyBlock.Screen.SESSION && lessonId != null

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
