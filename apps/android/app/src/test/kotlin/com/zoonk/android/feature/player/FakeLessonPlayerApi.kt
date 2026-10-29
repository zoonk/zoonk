package com.zoonk.android.feature.player

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.feature.player.model.LessonLoad
import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.model.PlayableLesson
import com.zoonk.api.ApiJson
import com.zoonk.api.models.ChapterLesson
import com.zoonk.api.models.LessonFit
import com.zoonk.api.models.LessonGeneration
import com.zoonk.api.models.LessonReadiness
import com.zoonk.api.models.LessonStepCheckInput
import com.zoonk.api.models.LessonStepCheckResult
import com.zoonk.api.models.LibraryLessonCompletion
import com.zoonk.api.models.LibraryLessonRun
import kotlinx.coroutines.CompletableDeferred

const val LESSON_ID = "00000000-0000-4000-8000-0000000000aa"
const val RUN_ID = "00000000-0000-4000-8000-0000000000bb"
const val NEXT_LESSON_ID = "00000000-0000-4000-8000-0000000000cc"
const val CHAPTER_ID = "00000000-0000-4000-8000-0000000000dd"
const val DONE_LESSON_ID = "00000000-0000-4000-8000-0000000000ff"

fun playable(steps: List<LessonStep>) =
    PlayableLesson(
        id = LESSON_ID,
        title = "Why clouds float",
        description = "What keeps a cloud up.",
        estimatedMinutes = 5,
        language = "en",
        targetLanguage = null,
        chapterId = CHAPTER_ID,
        steps = steps,
        summaryIdeas = listOf("Clouds are tiny droplets."),
        tutorSuggestions = emptyList(),
    )

fun checkResult(
    isCorrect: Boolean,
    feedback: String? = null,
    keyPoints: String = "null",
    checked: Boolean = true,
): LessonStepCheckResult =
    ApiJson.decodeFromString(
        """
        {"checked":$checked,"correctAnswer":null,"corrections":[],"expected":null,"feedback":${feedback?.let { "\"$it\"" } ?: "null"},
         "isCorrect":$isCorrect,"keyPoints":$keyPoints,"nextReviewAt":"2026-10-30T09:00:00Z","savedMistake":false,"score":null,"spelling":null}
        """.trimIndent(),
    )

val COMPLETION =
    """
    {"ceremony":null,"reached":{"energy":null,"level":null},"brainPower":30,"correctCount":2,"energyDelta":0.5,
     "incorrectCount":0,"isFirstCompletion":true,"nextReviewAt":"2026-10-31T09:00:00Z","seconds":120,"studyBlock":null,
     "totalBrainPower":130}
    """.trimIndent()

/** Records what the player sent; [runAnswers] are the answers an open run resumes with. */
class FakeLessonPlayerApi(
    var load: LessonLoad,
) : LessonPlayerApi {
    val checks = mutableListOf<Pair<String, LessonStepCheckInput>>()
    val completions = mutableListOf<String>()
    var runAnswers = "[]"
    var optionalStepIds = "[]"
    var startError: ApiException? = null
    var checkFailures = 0
    var grade: (String, LessonStepCheckInput) -> LessonStepCheckResult = { _, _ -> checkResult(isCorrect = true) }
    var completeFails = false
    var gate: CompletableDeferred<Unit>? = null
    val readinessStates = ArrayDeque<String>()
    var writes = 0
    var writeResponse: suspend () -> LessonGeneration = { ApiJson.decodeFromString("""{"generationId":"gen-1","status":"generating"}""") }

    override suspend fun lesson(
        session: AuthenticatedSession?,
        lessonId: String,
    ) = load

    override suspend fun challengeTeam(
        session: AuthenticatedSession,
        lessonId: String,
    ) = emptyList<String>()

    override suspend fun start(
        session: AuthenticatedSession,
        lessonId: String,
        studySessionId: String?,
        runId: String?,
    ): LibraryLessonRun {
        startError?.let { throw it }
        return ApiJson.decodeFromString(
            """
            {"answers":$runAnswers,"hyperdrive":{"knownStepIds":[],"streak":0},"optionalStepIds":$optionalStepIds,"runId":"$RUN_ID",
             "startedAt":"2026-10-28T10:00:00Z","support":null}
            """.trimIndent(),
        )
    }

    override suspend fun check(
        session: AuthenticatedSession,
        stepId: String,
        input: LessonStepCheckInput,
    ): LessonStepCheckResult {
        checks += stepId to input
        gate?.await()
        if (checkFailures > 0) {
            checkFailures--
            throw ApiException(ApiError.Network)
        }
        return grade(stepId, input)
    }

    override suspend fun complete(
        session: AuthenticatedSession,
        lessonId: String,
        runId: String,
        skippedWritingStepIds: List<String>,
    ): LibraryLessonCompletion {
        completions += runId
        if (completeFails) throw ApiException(ApiError.Unavailable)
        return ApiJson.decodeFromString(COMPLETION)
    }

    override suspend fun readiness(
        session: AuthenticatedSession,
        lessonId: String,
    ): LessonReadiness {
        val status = readinessStates.removeFirstOrNull() ?: throw ApiException(ApiError.Network)
        return ApiJson.decodeFromString("""{"alternative":null,"generationId":"gen-1","status":"$status"}""")
    }

    override suspend fun write(
        session: AuthenticatedSession,
        lessonId: String,
    ): LessonGeneration {
        writes++
        return writeResponse()
    }

    override suspend fun chapterLessons(
        session: AuthenticatedSession,
        goalId: String,
        chapterId: String,
    ): List<ChapterLesson> =
        listOf(LESSON_ID to "done", DONE_LESSON_ID to "done", NEXT_LESSON_ID to "upcoming").map { (id, state) ->
            ApiJson.decodeFromString(
                ChapterLesson.serializer(),
                """{"lessonId":"$id","minutes":5,"plusRequired":false,"skillIds":[],"state":"$state","title":"Lesson","written":true}""",
            )
        }

    var fit: LessonFit? = null

    override suspend fun fit(
        session: AuthenticatedSession,
        lessonId: String,
    ) = fit

    override suspend fun createGuest() = "guest-token"
}
