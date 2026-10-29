package com.zoonk.android.feature.practice

import com.zoonk.android.data.ANA
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.practice.block.BlockKey
import com.zoonk.android.feature.practice.block.BlockPhase
import com.zoonk.android.feature.practice.block.QuestionBlockApi
import com.zoonk.android.feature.practice.block.QuestionBlockStore
import com.zoonk.android.feature.practice.block.QuestionBlockViewModel
import com.zoonk.android.feature.questions.Answer
import com.zoonk.android.feature.questions.Drill
import com.zoonk.android.feature.session.fixture
import com.zoonk.api.ApiJson
import com.zoonk.api.models.StudyAnswerFeedback
import com.zoonk.api.models.StudyAnswerInput
import com.zoonk.api.models.StudyBlockCompletion
import com.zoonk.api.models.StudyBlockDetail
import com.zoonk.api.models.StudySessionSummary
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.decodeFromJsonElement
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.util.UUID

@OptIn(ExperimentalCoroutinesApi::class)
class QuestionBlockViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val session = FakeSession(AuthenticatedSession(ANA, "token", "local"))
    private val key = BlockKey(UUID.fromString(SESSION), UUID.fromString(BLOCK))
    private val sent = mutableListOf<StudyAnswerInput>()
    private var answered = setOf<String>()
    private var status = "active"
    private var answer: () -> StudyAnswerFeedback = { feedback(isCorrect = true) }
    private var finish: () -> StudyBlockCompletion = { throw ApiException(ApiError.Network) }

    @Before
    fun main() = Dispatchers.setMain(dispatcher)

    @After
    fun reset() = Dispatchers.resetMain()

    private fun question(
        id: String,
        drill: JsonObject? = null,
    ) = fixture(
        "checkpoint-question",
        "itemId" to id,
        "answered" to if (id in answered) JsonObject(mapOf("blank" to JsonPrimitive(false), "isCorrect" to JsonPrimitive(true))) else null,
        "drill" to drill,
    )

    private fun detail(drill: JsonObject? = null): StudyBlockDetail =
        ApiJson.decodeFromJsonElement(
            JsonObject(
                mapOf(
                    "block" to fixture("study-block", "id" to BLOCK, "status" to status),
                    "hints" to JsonPrimitive(true),
                    "questions" to JsonArray(listOf(question(FIRST, drill), question(SECOND))),
                    "trueFalseLabels" to JsonPrimitive("trueFalse"),
                ),
            ),
        )

    private fun TestScope.viewModel(
        drill: JsonObject? = null,
        clock: () -> Long = { 0L },
    ): QuestionBlockViewModel {
        val cache = AppCache(session, CoroutineScope(SupervisorJob() + dispatcher))
        val api =
            object : QuestionBlockApi {
                override suspend fun block(
                    session: AuthenticatedSession,
                    key: BlockKey,
                ) = detail(drill)

                override suspend fun answer(
                    session: AuthenticatedSession,
                    key: BlockKey,
                    input: StudyAnswerInput,
                ) = answer().also { sent += input }

                override suspend fun finish(
                    session: AuthenticatedSession,
                    key: BlockKey,
                    timeZone: String,
                ) = finish()

                override suspend fun stop(
                    session: AuthenticatedSession,
                    sessionId: UUID,
                    timeZone: String,
                ): StudySessionSummary = error("Not used")
            }
        return QuestionBlockViewModel(key, QuestionBlockStore(api, cache) { "UTC" }, clock)
    }

    private suspend fun TestScope.started(viewModel: QuestionBlockViewModel) =
        viewModel.block.load().let {
            advanceUntilIdle()
            val read =
                viewModel.questions(
                    requireNotNull(
                        viewModel.block.state.value
                            .let { (it as com.zoonk.android.data.LoadState.Loaded).value },
                    ),
                )
            viewModel.begin(read.questions)
            read
        }

    @Test
    fun aCheckedAnswerShowsItsFeedbackInTheKitsWords() =
        runTest(dispatcher) {
            val viewModel = viewModel()
            val read = started(viewModel)

            viewModel.submit(read.questions.first(), Answer.Choice(1))
            advanceUntilIdle()

            val phase = viewModel.state.value?.phase as BlockPhase.Checked
            assertEquals(Answer.Choice(1), phase.answer)
            assertEquals(Answer.Choice(0), phase.feedback.correctAnswer)
            assertEquals(
                """{"selectedIndex":1}""",
                ApiJson.encodeToString(
                    com.zoonk.api.models.StudyAnswerInputAnswer
                        .serializer(),
                    sent.single().answer,
                ),
            )
        }

    @Test
    fun anAnswerSavedElsewhereReadsTheBlockAgainAndGoesOnFromThere() =
        runTest(dispatcher) {
            val viewModel = viewModel()
            val read = started(viewModel)
            answer = { throw ApiException(ApiError.Unavailable, "ALREADY_ANSWERED", status = 409) }

            viewModel.submit(read.questions.first(), Answer.Choice(0))
            advanceUntilIdle()
            assertEquals(BlockPhase.AlreadyAnswered, viewModel.state.value?.phase)

            answered = setOf(FIRST)
            viewModel.reread()
            advanceUntilIdle()
            assertEquals(1, viewModel.state.value?.index)
            assertEquals(BlockPhase.Answering, viewModel.state.value?.phase)
        }

    @Test
    fun aBlockThatIsNoLongerOpenClosesTheScreen() =
        runTest(dispatcher) {
            val viewModel = viewModel()
            val read = started(viewModel)
            answer = { throw ApiException(ApiError.Unavailable, "BLOCK_NOT_ACTIVE", status = 409) }
            status = "completed"

            viewModel.submit(read.questions.first(), Answer.Choice(0))
            advanceUntilIdle()

            assertTrue(viewModel.closed.value)
        }

    @Test
    fun aFinishThatFailsCanBeTriedAgain() =
        runTest(dispatcher) {
            val viewModel = viewModel()
            val read = started(viewModel)

            viewModel.submit(read.questions[0], Answer.Choice(0))
            advanceUntilIdle()
            viewModel.next(read.questions)
            viewModel.submit(read.questions[1], Answer.Choice(0))
            advanceUntilIdle()
            viewModel.next(read.questions)
            advanceUntilIdle()

            assertEquals(BlockPhase.FinishFailed, viewModel.state.value?.phase)
        }

    @Test
    fun aTimedDrillThatRunsOutSendsNotSureWithItsWholeTime() =
        runTest(dispatcher) {
            val timed =
                JsonObject(
                    mapOf(
                        "kind" to JsonPrimitive("timed"),
                        "lesson" to kotlinx.serialization.json.JsonNull,
                        "timeLimitSeconds" to JsonPrimitive(45),
                    ),
                )
            val viewModel = viewModel(drill = timed) { 3_000L }
            val read = started(viewModel)
            assertEquals(
                Drill.Kind.Timed,
                read.questions
                    .first()
                    .drill
                    ?.kind,
            )

            viewModel.timeUp(read.questions.first(), 45)
            advanceUntilIdle()

            assertEquals(45_000L, sent.single().durationMs)
            assertEquals(
                """{"dontKnow":true}""",
                ApiJson.encodeToString(
                    com.zoonk.api.models.StudyAnswerInputAnswer
                        .serializer(),
                    sent.single().answer,
                ),
            )
            assertTrue(viewModel.state.value?.timedOut == true)
        }

    private companion object {
        const val SESSION = "1b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b"
        const val BLOCK = "2b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b"
        const val FIRST = "3b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b"
        const val SECOND = "4b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b"

        fun feedback(isCorrect: Boolean): StudyAnswerFeedback =
            ApiJson.decodeFromString(
                StudyAnswerFeedback.serializer(),
                """{"blank":false,"correctAnswer":{"selectedIndex":0},"explanation":null,"hyperdrive":{"level":1,"streak":0},"isCorrect":$isCorrect,
                |"mistakeFixed":false,"pauseSuggested":false,"reinforcementLessons":null,"savedToNotebook":false,"transcript":null,"trap":null,"workedSteps":[]}
                """.trimMargin(),
            )
    }
}
