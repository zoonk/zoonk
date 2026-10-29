package com.zoonk.android.feature.practice

import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.LoadState
import com.zoonk.android.feature.practice.block.BlockKey
import com.zoonk.android.feature.practice.block.QuestionBlockApi
import com.zoonk.android.feature.practice.block.QuestionBlockStore
import com.zoonk.android.feature.practice.block.QuestionBlockViewModel
import com.zoonk.android.feature.session.fixture
import com.zoonk.api.ApiJson
import com.zoonk.api.models.StudyAnswerFeedback
import com.zoonk.api.models.StudyAnswerInput
import com.zoonk.api.models.StudyBlockCompletion
import com.zoonk.api.models.StudyBlockDetail
import com.zoonk.api.models.StudySessionSummary
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.decodeFromJsonElement
import java.util.UUID

internal const val PRACTICE_SESSION = "1b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b"
internal const val PRACTICE_BLOCK = "2b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b"

internal fun strings(vararg values: String) = JsonArray(values.map(::JsonPrimitive))

internal fun blockQuestion(
    itemId: String,
    vararg fields: Pair<String, Any?>,
) = fixture("checkpoint-question", "itemId" to itemId, *fields)

internal fun blockDetail(
    questions: List<JsonObject>,
    vararg blockFields: Pair<String, Any?>,
): StudyBlockDetail =
    ApiJson.decodeFromJsonElement(
        JsonObject(
            mapOf(
                "block" to fixture("study-block", "id" to PRACTICE_BLOCK, "status" to "active", "kind" to "practice", *blockFields),
                "hints" to JsonPrimitive(true),
                "questions" to JsonArray(questions),
                "trueFalseLabels" to JsonPrimitive("trueFalse"),
            ),
        ),
    )

internal fun studyFeedback(
    isCorrect: Boolean,
    correctAnswer: String = """{"selectedIndex":0}""",
    explanation: String? = null,
    workedSteps: List<String> = emptyList(),
    streak: Int = 0,
): StudyAnswerFeedback =
    ApiJson.decodeFromString(
        StudyAnswerFeedback.serializer(),
        """{"blank":false,"correctAnswer":$correctAnswer,"explanation":${explanation?.let {
            ApiJson.encodeToString(
                JsonElement.serializer(),
                JsonPrimitive(it),
            )
        } ?: "null"},
        |"hyperdrive":{"level":1,"streak":$streak},"isCorrect":$isCorrect,"mistakeFixed":false,"pauseSuggested":false,"reinforcementLessons":null,
        |"savedToNotebook":${!isCorrect},"transcript":null,"trap":null,"workedSteps":${ApiJson.encodeToString(
            JsonElement.serializer(),
            JsonArray(workedSteps.map(::JsonPrimitive)),
        )}}
        """.trimMargin(),
    )

/** A runner over [detail] whose answers get [feedback]; finishing and stopping fail. */
internal fun practiceViewModel(
    cache: AppCache,
    detail: StudyBlockDetail,
    feedback: (StudyAnswerInput) -> StudyAnswerFeedback = { studyFeedback(isCorrect = true) },
): QuestionBlockViewModel {
    val api =
        object : QuestionBlockApi {
            override suspend fun block(
                session: AuthenticatedSession,
                key: BlockKey,
            ) = detail

            override suspend fun answer(
                session: AuthenticatedSession,
                key: BlockKey,
                input: StudyAnswerInput,
            ) = feedback(input)

            override suspend fun finish(
                session: AuthenticatedSession,
                key: BlockKey,
                timeZone: String,
            ): StudyBlockCompletion = error("Not used")

            override suspend fun stop(
                session: AuthenticatedSession,
                sessionId: UUID,
                timeZone: String,
            ): StudySessionSummary = error("Not used")
        }
    return QuestionBlockViewModel(
        BlockKey(
            UUID.fromString(PRACTICE_SESSION),
            UUID.fromString(PRACTICE_BLOCK),
        ),
        QuestionBlockStore(api, cache) {
            "UTC"
        },
    )
}

/** Loads the block and starts its run, as the screen does once its questions show. */
internal fun QuestionBlockViewModel.started() =
    runBlocking { block.load() }.let {
        questions((block.state.value as LoadState.Loaded).value).also { begin(it.questions) }
    }
