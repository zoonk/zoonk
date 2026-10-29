package com.zoonk.android.feature.player

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.perform
import com.zoonk.android.feature.player.engine.LessonRefusal
import com.zoonk.android.feature.player.model.LessonLoad
import com.zoonk.android.feature.player.model.toLessonLoad
import com.zoonk.android.ui.components.Limit
import com.zoonk.api.models.LessonFit
import com.zoonk.api.models.LessonGeneration
import com.zoonk.api.models.LessonReadiness
import com.zoonk.api.models.LessonStepCheckInput
import com.zoonk.api.models.LessonStepCheckResult
import com.zoonk.api.models.LibraryLessonCompletion
import com.zoonk.api.models.LibraryLessonCompletionInput
import com.zoonk.api.models.LibraryLessonRun
import com.zoonk.api.models.LibraryLessonStartInput
import com.zoonk.api.models.NextLessonResponse
import java.time.ZoneId
import java.util.UUID

/** The public API's lesson operations, as the player calls them. */
interface LessonPlayerApi {
    suspend fun lesson(
        session: AuthenticatedSession?,
        lessonId: String,
    ): LessonLoad

    suspend fun challengeTeam(
        session: AuthenticatedSession,
        lessonId: String,
    ): List<String>

    suspend fun start(
        session: AuthenticatedSession,
        lessonId: String,
        studySessionId: String?,
        runId: String?,
    ): LibraryLessonRun

    suspend fun check(
        session: AuthenticatedSession,
        stepId: String,
        input: LessonStepCheckInput,
    ): LessonStepCheckResult

    suspend fun complete(
        session: AuthenticatedSession,
        lessonId: String,
        runId: String,
        skippedWritingStepIds: List<String>,
    ): LibraryLessonCompletion

    suspend fun readiness(
        session: AuthenticatedSession,
        lessonId: String,
    ): LessonReadiness

    /** Writes the lesson now: it runs AI, so only on the learner's tap. */
    suspend fun write(
        session: AuthenticatedSession,
        lessonId: String,
    ): LessonGeneration

    /** The lesson's chapter's first lesson the learner hasn't finished. */
    suspend fun nextLesson(
        session: AuthenticatedSession,
        chapterId: String,
    ): NextLessonResponse

    /** Null outside a public chapter. */
    suspend fun fit(
        session: AuthenticatedSession,
        lessonId: String,
    ): LessonFit?

    /** Returns the new guest's token. */
    suspend fun createGuest(): String
}

class LiveLessonPlayerApi(
    private val api: ApiClients,
) : LessonPlayerApi {
    override suspend fun lesson(
        session: AuthenticatedSession?,
        lessonId: String,
    ) = perform { api.clients(session).libraryLessons.getLibraryLesson(UUID.fromString(lessonId)) }.toLessonLoad()

    override suspend fun challengeTeam(
        session: AuthenticatedSession,
        lessonId: String,
    ) = perform { api.clients(session).libraryLessons.getChallengeTeam(UUID.fromString(lessonId)) }.members.map { it.name }

    override suspend fun start(
        session: AuthenticatedSession,
        lessonId: String,
        studySessionId: String?,
        runId: String?,
    ) = perform {
        api.clients(session).libraryLessons.createLibraryLessonStart(
            UUID.fromString(lessonId),
            LibraryLessonStartInput(runId?.let(UUID::fromString), studySessionId?.let(UUID::fromString), timeZone()),
        )
    }

    override suspend fun check(
        session: AuthenticatedSession,
        stepId: String,
        input: LessonStepCheckInput,
    ) = perform { api.streamingClients(session).libraryLessons.createStepCheck(UUID.fromString(stepId), input) }

    override suspend fun complete(
        session: AuthenticatedSession,
        lessonId: String,
        runId: String,
        skippedWritingStepIds: List<String>,
    ) = perform {
        api.clients(session).libraryLessons.createLibraryLessonCompletion(
            UUID.fromString(lessonId),
            LibraryLessonCompletionInput(
                UUID.fromString(runId),
                skippedWritingStepIds.map(UUID::fromString).takeIf { it.isNotEmpty() },
                timeZone(),
            ),
        )
    }

    override suspend fun readiness(
        session: AuthenticatedSession,
        lessonId: String,
    ) = perform { api.clients(session).contentGeneration.getLibraryLessonReadiness(UUID.fromString(lessonId)) }

    override suspend fun write(
        session: AuthenticatedSession,
        lessonId: String,
    ) = perform { api.clients(session).contentGeneration.createLibraryLessonGeneration(UUID.fromString(lessonId)) }

    override suspend fun nextLesson(
        session: AuthenticatedSession,
        chapterId: String,
    ) = perform { api.clients(session).progress.getChapterNextLesson(UUID.fromString(chapterId)) }

    override suspend fun fit(
        session: AuthenticatedSession,
        lessonId: String,
    ): LessonFit? =
        try {
            perform { api.clients(session).libraryLessons.getLibraryLessonFit(UUID.fromString(lessonId)) }
        } catch (e: ApiException) {
            if (e.error == ApiError.NotFound) null else throw e
        }

    override suspend fun createGuest() = perform { api.clients(null).sessions.createGuestSession() }.token
}

/** Lessons by id, kept across opening and closing the player; each read follows the session. */
class LessonPlayerStore(
    val api: LessonPlayerApi,
    cache: AppCache,
) {
    private val lessons = cache.keyed<String, LessonLoad>(Audience.Viewer) { session, id -> api.lesson(session, id) }

    private val teams =
        cache.keyed<String, List<String>>(Audience.SignedIn) { session, id ->
            session?.let { api.challengeTeam(it, id) }
        }

    fun lesson(id: String) = lessons[id]

    /** The colleagues' names a challenge's `{{slot}}`s stand for, in slot order. */
    fun challengeTeam(lessonId: String) = teams[lessonId]
}

fun timeZone(): String = ZoneId.systemDefault().id

/** The API's refusals main's access screens tell apart; null for anything worth retrying. */
fun ApiException.toLessonRefusal(): LessonRefusal? =
    when {
        code == "PLUS_REQUIRED" -> LessonRefusal.PlusRequired
        error == ApiError.NotFound -> LessonRefusal.NotFound
        else -> Limit.of(this)?.let(LessonRefusal::Limited)
    }
