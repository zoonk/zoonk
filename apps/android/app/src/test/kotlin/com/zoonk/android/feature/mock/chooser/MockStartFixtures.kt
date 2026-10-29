package com.zoonk.android.feature.mock.chooser

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.GenerationEvent
import com.zoonk.android.data.GenerationSource
import com.zoonk.api.ApiJson
import com.zoonk.api.models.AnytimeMock
import com.zoonk.api.models.Generation
import com.zoonk.api.models.MockQuestionsGeneration
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf
import java.util.UUID

internal const val STARTED = "6f1c2c1e-1b8a-4d8e-9a77-2d8f4b0f1a05"

internal fun started(status: AnytimeMock.Status = AnytimeMock.Status.STARTED) = AnytimeMock(UUID.fromString(STARTED), status)

internal fun short(limit: AnytimeMock.Limit? = AnytimeMock.Limit.DAY) =
    AnytimeMock(id = null, status = AnytimeMock.Status.SHORT, examQuestions = 90, limit = limit, minutes = 130, questions = 40)

internal val NEEDS_QUESTIONS = AnytimeMock(id = null, status = AnytimeMock.Status.NEEDS_QUESTIONS)

internal fun writing(
    status: MockQuestionsGeneration.Status,
    generationId: String? = null,
) = MockQuestionsGeneration(generationId, status)

internal fun refusal(code: String) = ApiException(ApiError.Unavailable, code, status = 422)

/** Fair use for new questions used for the day, as the API refuses a Free learner. */
internal fun usageLimit() =
    ApiException(
        ApiError.Unavailable,
        "USAGE_LIMIT_REACHED",
        status = 402,
        details = ApiJson.parseToJsonElement("""{"limit":{"tier":"free","period":"day"}}"""),
    )

/** Each start answers [starts]'s next answer (the last one again once they run out), and the same for [writes]. */
internal class FakeMockStartApi(
    var starts: List<() -> AnytimeMock> = listOf { started() },
    var writes: List<() -> MockQuestionsGeneration> = listOf { writing(MockQuestionsGeneration.Status.READY) },
) : MockStartApi {
    val started = mutableListOf<Pair<MockChoice, Boolean>>()
    val asked = mutableListOf<MockChoice>()

    override suspend fun start(
        session: AuthenticatedSession,
        goalId: UUID,
        choice: MockChoice,
        acceptFewer: Boolean,
    ): AnytimeMock {
        started += choice to acceptFewer
        return starts[minOf(started.size, starts.size) - 1]()
    }

    override suspend fun writeQuestions(
        session: AuthenticatedSession,
        goalId: UUID,
        choice: MockChoice,
    ): MockQuestionsGeneration {
        asked += choice
        return writes[minOf(asked.size, writes.size) - 1]()
    }
}

/** A run that writes the questions and says they're ready. */
internal class ReadyRuns : GenerationSource {
    val followed = mutableListOf<String>()

    override fun events(id: String): Flow<GenerationEvent> =
        flowOf(
            GenerationEvent(status = "started", step = "writeMockQuestions"),
            GenerationEvent(status = "completed", step = "writeMockQuestions"),
            GenerationEvent(status = "completed", step = "mockQuestionsReady"),
        ).also { followed += id }

    override suspend fun status(id: String) = Generation.Status.COMPLETED
}
