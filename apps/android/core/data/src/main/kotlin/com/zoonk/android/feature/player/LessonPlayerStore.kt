package com.zoonk.android.feature.player

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.perform
import com.zoonk.android.feature.audio.VoiceRecording
import com.zoonk.android.feature.player.engine.LessonRefusal
import com.zoonk.android.feature.player.model.LessonLoad
import com.zoonk.android.feature.player.model.toLessonLoad
import com.zoonk.android.ui.components.Limit
import com.zoonk.api.models.AnswerExplanationRequest
import com.zoonk.api.models.LessonFit
import com.zoonk.api.models.LessonGeneration
import com.zoonk.api.models.LessonReadiness
import com.zoonk.api.models.LessonStepCheckInput
import com.zoonk.api.models.LessonStepCheckResult
import com.zoonk.api.models.LibraryLessonCompletion
import com.zoonk.api.models.LibraryLessonCompletionInput
import com.zoonk.api.models.LibraryLessonRun
import com.zoonk.api.models.LibraryLessonStartInput
import com.zoonk.api.models.SpokenAnswerGrade
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

    /** "Explain my answer" on a wrong typed answer: only on the learner's tap, since it may run AI. */
    suspend fun explainAnswer(
        session: AuthenticatedSession,
        stepId: String,
        answer: String,
    ): String

    /** A spoken screen's take, graded by the server. */
    suspend fun speak(
        session: AuthenticatedSession,
        stepId: String,
        recording: VoiceRecording,
        studySessionId: String?,
    ): SpokenAnswerGrade

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

    /** Null outside a public chapter. */
    suspend fun fit(
        session: AuthenticatedSession,
        lessonId: String,
    ): LessonFit?

    /** The learner's saved example on an explanation screen; null when none fits. Reading never writes one. */
    suspend fun exampleLine(
        session: AuthenticatedSession,
        stepId: String,
    ): String?

    /** Writes the lesson's example lines, every screen's in one call: it runs AI, so only from the learner's move. */
    suspend fun writeExampleLines(
        session: AuthenticatedSession,
        stepId: String,
    )
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

    override suspend fun explainAnswer(
        session: AuthenticatedSession,
        stepId: String,
        answer: String,
    ) = perform {
        api.streamingClients(session).libraryLessons.createStepAnswerExplanation(UUID.fromString(stepId), AnswerExplanationRequest(answer))
    }.explanation

    override suspend fun speak(
        session: AuthenticatedSession,
        stepId: String,
        recording: VoiceRecording,
        studySessionId: String?,
    ) = perform {
        api.streamingClients(session).language.createSpokenAnswer(
            UUID.fromString(stepId),
            recording.durationMs,
            recording.part(),
            studySessionId?.let(UUID::fromString),
            timeZone(),
        )
    }

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

    override suspend fun fit(
        session: AuthenticatedSession,
        lessonId: String,
    ): LessonFit? =
        try {
            perform { api.clients(session).libraryLessons.getLibraryLessonFit(UUID.fromString(lessonId)) }
        } catch (e: ApiException) {
            if (e.error == ApiError.NotFound) null else throw e
        }

    override suspend fun exampleLine(
        session: AuthenticatedSession,
        stepId: String,
    ) = perform { api.clients(session).lessons.getCurrentUserStepExampleLine(UUID.fromString(stepId)) }.line

    override suspend fun writeExampleLines(
        session: AuthenticatedSession,
        stepId: String,
    ) {
        perform { api.streamingClients(session).lessons.requestCurrentUserStepExampleLine(UUID.fromString(stepId)) }
    }
}

/** Lessons by id, kept across opening and closing the player; each read follows the session. */
class LessonPlayerStore(
    val api: LessonPlayerApi,
    cache: AppCache,
) {
    // A language lesson leaves out the activities its goal's plan skips, so it follows the learner's goals.
    private val lessons =
        cache.keyed<String, LessonLoad>(Audience.Viewer, setOf(DataDomain.Goals)) { session, id -> api.lesson(session, id) }

    private val teams =
        cache.keyed<String, List<String>>(Audience.SignedIn) { session, id ->
            session?.let { api.challengeTeam(it, id) }
        }

    // A line is built from the facts the learner shared and their goal, so it follows them.
    private val exampleLines =
        cache.keyed<String, String>(
            Audience.SignedIn,
            setOf(DataDomain.Memory, DataDomain.Goals, DataDomain.LearningProfile),
        ) { session, stepId ->
            session?.let { api.exampleLine(it, stepId) }
        }

    fun lesson(id: String) = lessons[id]

    /** The learner's own example on an explanation screen; empty when none fits or none is written yet. */
    fun exampleLine(stepId: String) = exampleLines[stepId]

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
