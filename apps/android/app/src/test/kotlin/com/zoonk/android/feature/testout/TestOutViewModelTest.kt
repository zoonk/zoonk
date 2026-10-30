package com.zoonk.android.feature.testout

import androidx.lifecycle.SavedStateHandle
import com.zoonk.android.data.ANA
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.DraftsChange
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.GenerationEvent
import com.zoonk.android.data.GenerationSource
import com.zoonk.android.data.LoadState
import com.zoonk.android.feature.plan.FakePlanApi
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.feature.practice.AnswersDraft
import com.zoonk.android.feature.practice.GradedAnswer
import com.zoonk.android.feature.questions.Answer
import com.zoonk.android.feature.questions.Question
import com.zoonk.android.feature.questions.QuestionFormat
import com.zoonk.android.feature.questions.TrueFalseWords
import com.zoonk.android.ui.components.Limit
import com.zoonk.api.models.ChapterTestOutInput
import com.zoonk.api.models.ChapterTestOutRecord
import com.zoonk.api.models.ChapterTestOutResult
import com.zoonk.api.models.CreateChapterTestOutGeneration200Response
import com.zoonk.api.models.Generation
import com.zoonk.api.models.MistakePatternPracticeResultReached
import com.zoonk.api.models.PlanChangeDecisionInput
import com.zoonk.api.models.SubmitChapterTestOut200Response
import com.zoonk.api.models.TestOutGeneration
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.util.UUID

@OptIn(ExperimentalCoroutinesApi::class)
class TestOutViewModelTest {
    @get:Rule
    val folder = TemporaryFolder()

    private val dispatcher = StandardTestDispatcher()
    private val signedIn = AuthenticatedSession(ANA, "token", "local")
    private val key = TestOutKey(UUID.fromString(GOAL), UUID.fromString(CHAPTER))
    private val questions =
        List(3) { Question("00000000-0000-4000-8000-00000000000$it", QuestionFormat.MultipleChoice, "Q$it", listOf("a", "b")) }
    private var read: TestOutRead = TestOutRead.Ready(0.8, questions, TrueFalseWords.TrueFalse)
    private var write: () -> CreateChapterTestOutGeneration200Response = {
        CreateChapterTestOutGeneration200Response.TestOutGenerationValue(TestOutGeneration("gen-1", TestOutGeneration.Status.GENERATING))
    }
    private var submit: (ChapterTestOutInput) -> SubmitChapterTestOut200Response = { passed() }
    private var recorded: () -> ChapterTestOutRecord = { throw ApiException(ApiError.NotFound) }
    private val sent = mutableListOf<ChapterTestOutInput>()
    private var reads = 0
    private val plansApi = FakePlanApi()
    private var clock = 0L

    @Before
    fun main() = Dispatchers.setMain(dispatcher)

    @After
    fun reset() = Dispatchers.resetMain()

    private fun passed() =
        SubmitChapterTestOut200Response.ChapterTestOutResultValue(
            ChapterTestOutResult(
                ceremony = null,
                reached = MistakePatternPracticeResultReached(energy = null, level = null),
                changeId = UUID.fromString(CHANGE),
                correct = 3,
                lessonsSkipped = 4,
                passed = true,
                total = 3,
            ),
        )

    private fun record(canUndo: Boolean) =
        ChapterTestOutRecord(
            canUndo = canUndo,
            changeId = UUID.fromString(CHANGE),
            correct = 2,
            lessonsSkipped = 3,
            passed = true,
            total = 3,
            undone = false,
        )

    private fun TestScope.parts(): Triple<TestOutStore, PlanStore, DraftStore> {
        val scope = CoroutineScope(SupervisorJob() + dispatcher)
        val cache = AppCache(FakeSession(signedIn), scope)
        val drafts = DraftStore(folder.root, scope, io = dispatcher)
        val api =
            object : TestOutApi {
                override suspend fun testOut(
                    session: AuthenticatedSession,
                    key: TestOutKey,
                ) = read.also { reads++ }

                override suspend fun writeQuestions(
                    session: AuthenticatedSession,
                    key: TestOutKey,
                ) = write()

                override suspend fun submit(
                    session: AuthenticatedSession,
                    key: TestOutKey,
                    input: ChapterTestOutInput,
                ) = input.also(sent::add).let(submit)

                override suspend fun recorded(
                    session: AuthenticatedSession,
                    key: RecordKey,
                ) = recorded()
            }
        return Triple(TestOutStore(api, cache, drafts) { "UTC" }, PlanStore(plansApi, cache), drafts)
    }

    private val generations =
        object : GenerationSource {
            override fun events(id: String): Flow<GenerationEvent> =
                flowOf(
                    GenerationEvent(status = "completed", step = "writeTestOutQuestions"),
                    GenerationEvent(status = "completed", step = "testOutQuestionsReady"),
                )

            override suspend fun status(id: String) = Generation.Status.COMPLETED
        }

    private suspend fun TestScope.viewModel(
        saved: SavedStateHandle = SavedStateHandle(),
        parts: Triple<TestOutStore, PlanStore, DraftStore> = parts(),
    ): TestOutViewModel {
        val (store, plans, drafts) = parts
        drafts.follow { DraftsChange(signedIn.accountId) }
        return TestOutViewModel(key, store, plans, store.answers(signedIn, key), generations, saved) { clock }
    }

    private suspend fun TestScope.started(viewModel: TestOutViewModel) {
        viewModel.testOut.load()
        viewModel.begin(questions)
        advanceUntilIdle()
    }

    @Test
    fun startWritesTheQuestionsAndTheTestOpensWhenTheyAreReady() =
        runTest(dispatcher) {
            read = TestOutRead.Ready(0.8, emptyList(), TrueFalseWords.TrueFalse)
            val viewModel = viewModel()
            viewModel.testOut.load()
            assertEquals(1, reads)

            read = TestOutRead.Ready(0.8, questions, TrueFalseWords.TrueFalse)
            viewModel.start()
            advanceUntilIdle()

            assertEquals(2, reads)
            assertEquals(false, viewModel.ui.value.writing)
            val shown = viewModel.testOut.state.value as LoadState.Loaded<*>
            assertEquals(questions, (shown.value as TestOutRead.Ready).questions)
        }

    @Test
    fun aRefusedStartSaysWhatRanOutAndPlusRequiredSaysSo() =
        runTest(dispatcher) {
            val viewModel = viewModel()
            write = { throw ApiException(ApiError.Unavailable, "SIGN_UP_REQUIRED", status = 403) }
            viewModel.start()
            advanceUntilIdle()
            assertEquals(Limit.SignUpRequired, viewModel.ui.value.refused)

            write = { throw ApiException(ApiError.Unavailable, "PLUS_REQUIRED", status = 402) }
            viewModel.start()
            advanceUntilIdle()
            assertTrue(viewModel.ui.value.plusRequired)
        }

    @Test
    fun theLastAnswerSendsThemAllAndShowsTheResult() =
        runTest(dispatcher) {
            val viewModel = viewModel()
            started(viewModel)

            questions.forEachIndexed { index, question ->
                clock += 1_000L * (index + 1)
                viewModel.answer(questions, question, if (index == 1) Answer.DontKnow else Answer.Choice(0))
            }
            advanceUntilIdle()

            val input = sent.single()
            assertEquals(questions.map { UUID.fromString(it.itemId) }, input.answers.map { it.itemId })
            assertEquals(listOf(1_000L, 2_000L, 3_000L), input.answers.map { it.durationMs })
            val outcome = viewModel.ui.value.outcome
            assertEquals(4, outcome?.skippedLessons)
            assertEquals(UUID.fromString(CHANGE), outcome?.changeId)
            assertTrue(viewModel.ui.value.celebrate)
        }

    @Test
    fun aFailedSendKeepsTheAnswersAndTryAgainSendsTheSameTest() =
        runTest(dispatcher) {
            val viewModel = viewModel()
            started(viewModel)
            submit = { throw ApiException(ApiError.Network) }

            questions.forEach { viewModel.answer(questions, it, Answer.Choice(1)) }
            advanceUntilIdle()
            assertTrue(viewModel.ui.value.sendFailed)
            assertEquals(
                3,
                viewModel.ui.value.answers
                    ?.size,
            )

            submit = { passed() }
            viewModel.retrySend()
            advanceUntilIdle()

            assertEquals(2, sent.size)
            assertEquals(sent[0].requestId, sent[1].requestId)
            assertEquals(
                true,
                viewModel.ui.value.outcome
                    ?.passed,
            )
        }

    @Test
    fun reopenedTheTestGoesOnFromTheKeptAnswersShortOfTheLast() =
        runTest(dispatcher) {
            val parts = parts()
            val first = viewModel(parts = parts)
            started(first)
            questions.forEach { first.answer(questions, it, Answer.Choice(0)) }
            submit = { throw ApiException(ApiError.Network) }
            advanceUntilIdle()

            val again = viewModel(parts = parts)
            started(again)

            assertEquals(
                2,
                again.ui.value.answers
                    ?.size,
            )
        }

    @Test
    fun aTestSentBeforeTheProcessEndedShowsItsRecordedResultWithoutCelebrating() =
        runTest(dispatcher) {
            val saved = SavedStateHandle(mapOf("sentRequestId" to REQUEST))
            recorded = { record(canUndo = false) }
            val viewModel = viewModel(saved)
            assertEquals(REQUEST, viewModel.ui.value.sent)

            val record = viewModel.record(REQUEST)
            record.load()
            viewModel.showRecorded(record.state.value)

            assertEquals(
                3,
                viewModel.ui.value.outcome
                    ?.skippedLessons,
            )
            assertNull(
                viewModel.ui.value.outcome
                    ?.changeId,
            )
            assertEquals(false, viewModel.ui.value.celebrate)
        }

    @Test
    fun aSendThatNeverReachedTheServerOpensTheTestAgain() =
        runTest(dispatcher) {
            val viewModel = viewModel(SavedStateHandle(mapOf("sentRequestId" to REQUEST)))

            val record = viewModel.record(REQUEST)
            record.load()
            viewModel.showRecorded(record.state.value)

            assertNull(viewModel.ui.value.sent)
            assertNull(viewModel.ui.value.outcome)
        }

    @Test
    fun aRecordThatCouldNotBeReadKeepsTheSentTestToTryAgain() =
        runTest(dispatcher) {
            recorded = { throw ApiException(ApiError.Network) }
            val viewModel = viewModel(SavedStateHandle(mapOf("sentRequestId" to REQUEST)))

            val record = viewModel.record(REQUEST)
            record.load()
            viewModel.showRecorded(record.state.value)

            assertEquals(REQUEST, viewModel.ui.value.sent)
        }

    @Test
    fun aShownRecordClearsTheAnswersKeptOnTheDevice() =
        runTest(dispatcher) {
            val parts = parts()
            val first = viewModel(parts = parts)
            started(first)
            submit = { throw ApiException(ApiError.Network) }
            questions.forEach { first.answer(questions, it, Answer.Choice(0)) }
            advanceUntilIdle()

            recorded = { record(canUndo = true) }
            val again = viewModel(SavedStateHandle(mapOf("sentRequestId" to sent[0].requestId.toString())), parts)
            val record = again.record(sent[0].requestId.toString())
            record.load()
            again.showRecorded(record.state.value)
            advanceUntilIdle()

            assertNull(
                parts.first
                    .answers(signedIn, key)
                    .value
                    .first(),
            )
        }

    @Test
    fun aTestWithNothingToResumeIsSentAsANewOne() =
        runTest(dispatcher) {
            val parts = parts()
            parts.third.follow { DraftsChange(signedIn.accountId) }
            parts.first.answers(signedIn, key).save(AnswersDraft(REQUEST, listOf(GradedAnswer("another-question", Answer.Choice(1), 500))))
            val viewModel = viewModel(parts = parts)
            started(viewModel)

            questions.forEach { viewModel.answer(questions, it, Answer.Choice(0)) }
            advanceUntilIdle()

            assertTrue(sent.single().requestId != UUID.fromString(REQUEST))
        }

    @Test
    fun undoPutsTheLessonsBack() =
        runTest(dispatcher) {
            val viewModel = viewModel()
            started(viewModel)
            questions.forEach { viewModel.answer(questions, it, Answer.Choice(0)) }
            advanceUntilIdle()

            viewModel.undo()
            advanceUntilIdle()

            assertEquals(listOf(PlanChangeDecisionInput.Status.UNDONE), plansApi.decisions)
            assertEquals(UndoState.Done, viewModel.ui.value.undo)
        }

    @Test
    fun aSentTestClearsTheAnswersKeptOnTheDevice() =
        runTest(dispatcher) {
            val parts = parts()
            val viewModel = viewModel(parts = parts)
            started(viewModel)
            questions.forEach { viewModel.answer(questions, it, Answer.Choice(0)) }
            advanceUntilIdle()

            assertNull(
                parts.first
                    .answers(signedIn, key)
                    .value
                    .first(),
            )
        }

    private companion object {
        const val GOAL = "00000000-0000-4000-8000-0000000000a1"
        const val CHAPTER = "00000000-0000-4000-8000-0000000000b1"
        const val CHANGE = "00000000-0000-4000-8000-0000000000c1"
        const val REQUEST = "00000000-0000-4000-8000-0000000000d1"
    }
}
