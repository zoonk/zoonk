package com.zoonk.android.feature.focustest

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.zoonk.android.data.ANA
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.DraftsChange
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.GenerationEvent
import com.zoonk.android.data.GenerationFailure
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.GenerationSource
import com.zoonk.android.data.LoadState
import com.zoonk.android.feature.plan.FakePlanApi
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.feature.practice.UndoState
import com.zoonk.android.feature.questions.Answer
import com.zoonk.android.ui.components.Limit
import com.zoonk.api.ApiJson
import com.zoonk.api.models.FocusTest
import com.zoonk.api.models.FocusTestGeneration
import com.zoonk.api.models.FocusTestInput
import com.zoonk.api.models.FocusTestResult
import com.zoonk.api.models.Generation
import com.zoonk.api.models.PlanChangeDecisionInput
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
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
class FocusTestViewModelTest {
    @get:Rule
    val folder = TemporaryFolder()

    private val dispatcher = StandardTestDispatcher()
    private val signedIn = AuthenticatedSession(ANA, "token", "local")
    private val goalId = UUID.fromString("00000000-0000-4000-8000-0000000000a1")
    private val ids = List(4) { "00000000-0000-4000-8000-00000000000$it" }
    private var written = 1
    private var writes = 0
    private var write: () -> FocusTestGeneration = { FocusTestGeneration("gen-1", FocusTestGeneration.Status.GENERATING) }
    private var writing = CompletableDeferred(Unit)
    private var writingEnds = Generation.Status.COMPLETED
    private var reading = CompletableDeferred(Unit)
    private var readFails = false
    private var clock = 0L
    private val sent = mutableListOf<FocusTestInput>()
    private val plansApi = FakePlanApi()

    @Before
    fun main() = Dispatchers.setMain(dispatcher)

    @After
    fun reset() = Dispatchers.resetMain()

    /** Two subjects of two questions; [written] of them exist. */
    private fun focusTest(): FocusTest {
        val questions =
            ids.take(written).mapIndexed { index, id ->
                """{"itemId":"$id","skillId":"$id","format":"multipleChoice","question":"Q$index","options":["a","b"],
                "select":1,"context":null,"image":null,"visual":null,"area":"${if (index < 2) "Math" else "History"}"}"""
            }
        return ApiJson.decodeFromString(
            FocusTest.serializer(),
            """{"areas":["Math","History"],"needsItems":[],"questions":[${questions.joinToString(",")}],"questionsPerArea":2,
            "trueFalseLabels":"trueFalse"}""",
        )
    }

    private fun result(): FocusTestResult =
        ApiJson.decodeFromString(
            FocusTestResult.serializer(),
            """{"ceremony":null,"reached":{"energy":null,"level":null},"changeId":"00000000-0000-4000-8000-0000000000c1",
            "focusAreas":["History"],"areas":[
              {"answers":[true,true],"chosen":false,"correct":2,"label":"Math","name":"math","total":2},
              {"answers":[false,true],"chosen":true,"correct":1,"label":"History","name":"history","total":2}]}""",
        )

    private fun TestScope.parts(): Triple<FocusTestStore, PlanStore, DraftStore> {
        val scope = CoroutineScope(SupervisorJob() + dispatcher)
        val cache = AppCache(FakeSession(signedIn), scope)
        val drafts = DraftStore(folder.root, scope, io = dispatcher)
        val api =
            object : FocusTestApi {
                override suspend fun focusTest(
                    session: AuthenticatedSession,
                    goalId: UUID,
                ): FocusTest {
                    val snapshot = focusTest()
                    reading.await()
                    if (readFails) throw ApiException(ApiError.Network)
                    return snapshot
                }

                override suspend fun writeQuestions(
                    session: AuthenticatedSession,
                    goalId: UUID,
                ) = write().also { writes++ }

                override suspend fun submit(
                    session: AuthenticatedSession,
                    goalId: UUID,
                    input: FocusTestInput,
                ) = result().also { sent += input }
            }
        return Triple(FocusTestStore(api, cache, drafts) { "UTC" }, PlanStore(plansApi, cache), drafts)
    }

    private val generations =
        object : GenerationSource {
            override fun events(id: String): Flow<GenerationEvent> =
                flow {
                    writing.await()
                    if (writingEnds != Generation.Status.COMPLETED) return@flow
                    written = 4
                    emit(GenerationEvent(status = "completed", step = "writeFocusTestQuestions"))
                    emit(GenerationEvent(status = "completed", step = "focusTestQuestionsReady"))
                }

            override suspend fun status(id: String) = writingEnds
        }

    private suspend fun TestScope.viewModel(
        saved: SavedStateHandle = SavedStateHandle(),
        parts: Triple<FocusTestStore, PlanStore, DraftStore> = parts(),
    ): FocusTestViewModel {
        val (store, plans, drafts) = parts
        drafts.follow { DraftsChange(signedIn.accountId) }
        return FocusTestViewModel(goalId, store, plans, generations, store.answersDraft(signedIn, goalId), saved) { clock }
    }

    private suspend fun TestScope.read(viewModel: FocusTestViewModel): FocusTestRead {
        viewModel.test.refresh()
        advanceUntilIdle()
        val read = (viewModel.test.state.value as LoadState.Loaded<*>).value as FocusTestRead
        viewModel.arrive(read)
        advanceUntilIdle()
        return read
    }

    /** Not [advanceUntilIdle]: a generation being followed checks its status on a timer. */
    private suspend fun TestScope.started(viewModel: FocusTestViewModel) {
        viewModel.start(read(viewModel))
        runCurrent()
    }

    @Test
    fun aTestWithEveryQuestionStartsWithoutWritingAny() =
        runTest(dispatcher) {
            written = 4
            val viewModel = viewModel()

            started(viewModel)

            assertTrue(viewModel.ui.value.started)
            assertEquals(0, writes)
        }

    @Test
    fun startWritesTheMissingQuestionsWhileTheOnesThereAreGetAnswered() =
        runTest(dispatcher) {
            writing = CompletableDeferred()
            val viewModel = viewModel()
            started(viewModel)

            viewModel.answer(viewModel.ui.value.questions[0], Answer.Choice(0))
            writing.complete(Unit)
            advanceUntilIdle()

            assertEquals(1, writes)
            assertEquals(
                ids,
                viewModel.ui.value.questions
                    .map { it.itemId },
            )
            assertEquals(
                listOf(ids[0]),
                viewModel.ui.value.answers
                    .map { it.itemId },
            )
        }

    @Test
    fun theRunStaysFollowingUntilItsQuestionsAreRead() =
        runTest(dispatcher) {
            writing = CompletableDeferred()
            val viewModel = viewModel()
            started(viewModel)
            reading = CompletableDeferred()

            writing.complete(Unit)
            advanceUntilIdle()

            assertEquals(GenerationRun.Status.Following, viewModel.run.value.status)
            reading.complete(Unit)
            advanceUntilIdle()
            assertEquals(GenerationRun.Status.Ready, viewModel.run.value.status)
            assertEquals(4, viewModel.ui.value.questions.size)
        }

    @Test
    fun aReadStartedBeforeTheQuestionsWereWrittenIsntTakenForThem() =
        runTest(dispatcher) {
            writing = CompletableDeferred()
            val viewModel = viewModel()
            started(viewModel)
            reading = CompletableDeferred()
            launch { viewModel.test.refresh() }
            runCurrent()

            writing.complete(Unit)
            runCurrent()
            reading.complete(Unit)
            advanceUntilIdle()

            assertEquals(4, viewModel.ui.value.questions.size)
        }

    @Test
    fun aFailedReadOfTheWrittenQuestionsCanBeTriedAgain() =
        runTest(dispatcher) {
            writing = CompletableDeferred()
            val viewModel = viewModel()
            started(viewModel)
            readFails = true

            writing.complete(Unit)
            advanceUntilIdle()

            assertEquals(GenerationFailure.Connection, viewModel.run.value.failure)
            assertEquals(1, viewModel.ui.value.questions.size)
            readFails = false
            viewModel.retryWriting()
            advanceUntilIdle()
            assertEquals(GenerationRun.Status.Ready, viewModel.run.value.status)
            assertEquals(4, viewModel.ui.value.questions.size)
        }

    @Test
    fun waitingForTheNextQuestionsDoesntCountAsAnsweringTime() =
        runTest(dispatcher) {
            writing = CompletableDeferred()
            val viewModel = viewModel()
            started(viewModel)
            clock = 5_000
            viewModel.answer(viewModel.ui.value.questions[0], Answer.Choice(0))

            clock = 65_000
            writing.complete(Unit)
            advanceUntilIdle()
            clock = 67_000
            viewModel.answer(viewModel.ui.value.questions[1], Answer.Choice(0))

            assertEquals(
                listOf(5_000L, 2_000L),
                viewModel.ui.value.answers
                    .map { it.durationMs },
            )
        }

    @Test
    fun theLastAnswerSendsThemAllAndShowsTheNewFocus() =
        runTest(dispatcher) {
            written = 4
            val viewModel = viewModel()
            started(viewModel)

            viewModel.ui.value.questions
                .forEach { viewModel.answer(it, Answer.Choice(0)) }
            advanceUntilIdle()

            assertEquals(4, sent.single().answers.size)
            assertEquals(
                listOf("History"),
                viewModel.ui.value.outcome
                    ?.areas
                    ?.filter { it.chosen }
                    ?.map { it.label },
            )
        }

    @Test
    fun answersKeptOnTheDeviceComeBackFirstAfterTheProcessEnds() =
        runTest(dispatcher) {
            written = 4
            val parts = parts()
            val saved = SavedStateHandle()
            val before = viewModel(saved, parts)
            started(before)
            before.answer(before.ui.value.questions[2], Answer.Choice(1))
            before.answer(before.ui.value.questions[0], Answer.DontKnow)
            advanceUntilIdle()

            val after = viewModel(SavedStateHandle(saved.keys().associateWith { saved.get<Any>(it) }), parts)
            read(after)

            assertTrue(after.ui.value.started)
            assertEquals(
                listOf(ids[2], ids[0], ids[1], ids[3]),
                after.ui.value.questions
                    .map { it.itemId },
            )
            assertEquals(
                listOf(Answer.Choice(1), Answer.DontKnow),
                after.ui.value.answers
                    .map { it.answer },
            )
        }

    @Test
    fun anAnswerIsKeptWhenTheTestClosesRightAfterIt() =
        runTest(dispatcher) {
            written = 4
            val parts = parts()
            val before = viewModel(SavedStateHandle(), parts)
            started(before)
            val owner = ViewModelStore()
            ViewModelProvider.create(owner, viewModelFactory { initializer { before } })[FocusTestViewModel::class]

            before.answer(before.ui.value.questions[0], Answer.Choice(1))
            owner.clear()
            advanceUntilIdle()

            val after = viewModel(SavedStateHandle(), parts)
            read(after)
            assertEquals(
                listOf(Answer.Choice(1)),
                after.ui.value.answers
                    .map { it.answer },
            )
        }

    @Test
    fun aSentTestShowsItsOutcomeAgainWithoutCelebratingOrKeepingItsAnswers() =
        runTest(dispatcher) {
            written = 4
            val parts = parts()
            val saved = SavedStateHandle()
            val before = viewModel(saved, parts)
            started(before)
            before.ui.value.questions
                .forEach { before.answer(it, Answer.Choice(0)) }
            advanceUntilIdle()
            before.undo()
            advanceUntilIdle()

            val after = viewModel(SavedStateHandle(saved.keys().associateWith { saved.get<Any>(it) }), parts)
            advanceUntilIdle()

            assertEquals(before.ui.value.outcome, after.ui.value.outcome)
            assertEquals(false, after.ui.value.celebrate)
            assertEquals(UndoState.Done, after.ui.value.undo)
            assertNull(
                parts.first
                    .answersDraft(signedIn, goalId)
                    .value
                    .first(),
            )
        }

    @Test
    fun theAnswersGivenCanBeSentWhenTheRestWontCome() =
        runTest(dispatcher) {
            writingEnds = Generation.Status.FAILED
            val viewModel = viewModel()
            started(viewModel)
            viewModel.answer(viewModel.ui.value.questions[0], Answer.DontKnow)

            viewModel.send()
            advanceUntilIdle()

            assertEquals(listOf(UUID.fromString(ids[0])), sent.single().answers.map { it.itemId })
        }

    @Test
    fun aRefusedStartSaysWhatRanOut() =
        runTest(dispatcher) {
            write = { throw ApiException(ApiError.Unavailable, "SIGN_UP_REQUIRED", status = 403) }
            val viewModel = viewModel()

            started(viewModel)

            assertEquals(Limit.SignUpRequired, viewModel.ui.value.refused)
            assertEquals(false, viewModel.ui.value.started)
        }

    @Test
    fun aRefusedRewriteGoesBackToTheStartAndSaysWhy() =
        runTest(dispatcher) {
            written = 0
            writingEnds = Generation.Status.FAILED
            val viewModel = viewModel()
            started(viewModel)

            write = { throw ApiException(ApiError.Unavailable, "SIGN_UP_REQUIRED", status = 403) }
            viewModel.retryWriting()
            advanceUntilIdle()

            assertEquals(Limit.SignUpRequired, viewModel.ui.value.refused)
            assertEquals(false, viewModel.ui.value.started)
            assertEquals(false, viewModel.ui.value.writing)
        }

    @Test
    fun undoPutsThePlanBack() =
        runTest(dispatcher) {
            written = 4
            val viewModel = viewModel()
            started(viewModel)
            viewModel.ui.value.questions
                .forEach { viewModel.answer(it, Answer.Choice(0)) }
            advanceUntilIdle()

            viewModel.undo()
            advanceUntilIdle()

            assertEquals(listOf(PlanChangeDecisionInput.Status.UNDONE), plansApi.decisions)
            assertEquals(UndoState.Done, viewModel.ui.value.undo)
        }
}
