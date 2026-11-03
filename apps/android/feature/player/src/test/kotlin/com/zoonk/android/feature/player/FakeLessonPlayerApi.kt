package com.zoonk.android.feature.player

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.feature.audio.VoiceRecording
import com.zoonk.android.feature.goalcontent.ChapterKey
import com.zoonk.android.feature.goalcontent.GoalContentApi
import com.zoonk.android.feature.goalcontent.goalChapter
import com.zoonk.android.feature.player.model.LessonLoad
import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.model.PlayableLesson
import com.zoonk.api.ApiJson
import com.zoonk.api.models.ActivityExpected
import com.zoonk.api.models.AreaPractice
import com.zoonk.api.models.AreaPracticeInput
import com.zoonk.api.models.ChapterLesson
import com.zoonk.api.models.GoalChapter
import com.zoonk.api.models.LessonFit
import com.zoonk.api.models.LessonGeneration
import com.zoonk.api.models.LessonMap
import com.zoonk.api.models.LessonReadiness
import com.zoonk.api.models.LessonStepCheckInput
import com.zoonk.api.models.LessonStepCheckResult
import com.zoonk.api.models.LibraryLessonCompletion
import com.zoonk.api.models.LibraryLessonRun
import com.zoonk.api.models.SpokenAnswerGrade
import kotlinx.coroutines.CompletableDeferred
import java.util.UUID

const val LESSON_ID = "00000000-0000-4000-8000-0000000000aa"
const val RUN_ID = "00000000-0000-4000-8000-0000000000bb"
private const val NEXT_LESSON_ID = "00000000-0000-4000-8000-0000000000cc"
const val CHAPTER_ID = "00000000-0000-4000-8000-0000000000dd"
private const val DONE_LESSON_ID = "00000000-0000-4000-8000-0000000000ff"

fun playable(
    steps: List<LessonStep>,
    map: LessonMap? = null,
) = PlayableLesson(
    id = LESSON_ID,
    title = "Why clouds float",
    description = "What keeps a cloud up.",
    estimatedMinutes = 5,
    language = "en",
    targetLanguage = null,
    chapterId = CHAPTER_ID,
    steps = steps,
    map = map,
    tutorSuggestions = emptyList(),
)

fun checkResult(
    isCorrect: Boolean,
    feedback: String? = null,
    keyPoints: String = "null",
    checked: Boolean = true,
    expected: ActivityExpected? = null,
): LessonStepCheckResult =
    ApiJson.decodeFromString(
        """
        {"checked":$checked,"correctAnswer":null,"corrections":[],"expected":${expected?.let {
            ApiJson.encodeToString(
                ActivityExpected.serializer(),
                it,
            )
        }},"feedback":${feedback?.let { "\"$it\"" } ?: "null"},
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
    var optionalStepIds = "[]"
    var runAnswers = "[]"

    /** The lesson opening an older server sent with the run, which the player ignores. */
    var support = "null"
    var startFailures = 0
    var checkFailures = 0
    var grade: (String, LessonStepCheckInput) -> LessonStepCheckResult = { _, _ -> checkResult(isCorrect = true) }
    var gate: CompletableDeferred<Unit>? = null
    val readinessStates = ArrayDeque<String>()
    var warmUpId: String? = null
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
        if (startFailures > 0) {
            startFailures--
            throw ApiException(ApiError.Network)
        }
        return ApiJson.decodeFromString(
            """
            {"answers":$runAnswers,"hyperdrive":{"knownStepIds":[],"streak":0},"optionalStepIds":$optionalStepIds,"runId":"$RUN_ID",
             "replay":false,"startedAt":"2026-10-28T10:00:00Z","support":$support}
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

    override suspend fun explainAnswer(
        session: AuthenticatedSession,
        stepId: String,
        answer: String,
    ) = "It names the droplets, not why they float."

    var spokenGrade: suspend () -> SpokenAnswerGrade = { throw ApiException(ApiError.Unavailable) }

    override suspend fun speak(
        session: AuthenticatedSession,
        stepId: String,
        recording: VoiceRecording,
        studySessionId: String?,
    ) = spokenGrade()

    override suspend fun complete(
        session: AuthenticatedSession,
        lessonId: String,
        runId: String,
        skippedWritingStepIds: List<String>,
    ): LibraryLessonCompletion {
        completions += runId
        return ApiJson.decodeFromString(COMPLETION)
    }

    override suspend fun readiness(
        session: AuthenticatedSession,
        lessonId: String,
    ): LessonReadiness {
        val status = readinessStates.removeFirstOrNull() ?: throw ApiException(ApiError.Network)
        val warmUp = warmUpId?.let { "\"$it\"" } ?: "null"
        return ApiJson.decodeFromString(
            """{"alternative":null,"generationId":"gen-1","setAside":false,"status":"$status","warmUpId":$warmUp}""",
        )
    }

    override suspend fun write(
        session: AuthenticatedSession,
        lessonId: String,
    ): LessonGeneration {
        writes++
        return writeResponse()
    }

    /**
     * The example lines the server has saved, by screen; [linesToWrite] are the ones the lesson's
     * first move saves, its response lost when [linesResponseLost].
     */
    private var savedLines = mapOf<String, String>()
    var linesToWrite = mapOf<String, String>()
    var linesGate: CompletableDeferred<Unit>? = null
    var linesResponseLost = false
    val lineReads = mutableListOf<String>()
    val lineWrites = mutableListOf<String>()

    override suspend fun exampleLine(
        session: AuthenticatedSession,
        stepId: String,
    ): String? {
        lineReads += stepId
        return savedLines[stepId]
    }

    override suspend fun writeExampleLines(
        session: AuthenticatedSession,
        stepId: String,
    ) {
        lineWrites += stepId
        linesGate?.await()
        savedLines = savedLines + linesToWrite
        if (linesResponseLost) throw ApiException(ApiError.Network)
    }

    override suspend fun fit(
        session: AuthenticatedSession,
        lessonId: String,
    ): LessonFit? = null
}

private fun chapterLessons(): List<ChapterLesson> =
    listOf(LESSON_ID to "done", DONE_LESSON_ID to "done", NEXT_LESSON_ID to "upcoming").map { (id, state) ->
        ApiJson.decodeFromString(
            ChapterLesson.serializer(),
            """{"lessonId":"$id","minutes":5,"plusRequired":false,"skillIds":[],"state":"$state","title":"Lesson","written":true}""",
        )
    }

class FakeChapterApi : GoalContentApi {
    var reads = 0
    var gate: CompletableDeferred<Unit>? = null

    override suspend fun chapter(
        session: AuthenticatedSession,
        key: ChapterKey,
    ): GoalChapter {
        reads++
        gate?.await()
        return goalChapter().copy(lessons = chapterLessons())
    }

    override suspend fun practiceArea(
        session: AuthenticatedSession,
        goalId: UUID,
        input: AreaPracticeInput,
    ): AreaPractice = error("Not used")
}
