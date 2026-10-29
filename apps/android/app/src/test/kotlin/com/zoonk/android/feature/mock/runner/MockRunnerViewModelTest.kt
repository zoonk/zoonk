package com.zoonk.android.feature.mock.runner

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.DraftsChange
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.LoadState
import com.zoonk.android.feature.questions.Answer
import com.zoonk.api.models.MockExam
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

@OptIn(ExperimentalCoroutinesApi::class)
class MockRunnerViewModelTest {
    @get:Rule
    val folder = TemporaryFolder()

    private val dispatcher = StandardTestDispatcher()
    private val ana = AuthenticatedSession("ana", "token", "local")
    private val session = FakeSession(ana)
    private val api = FakeMockRunApi()
    private var rereads = 0

    @Before
    fun main() = Dispatchers.setMain(dispatcher)

    @After
    fun reset() = Dispatchers.resetMain()

    private suspend fun store(): MockRunStore {
        val scope = CoroutineScope(SupervisorJob() + dispatcher)
        val drafts = DraftStore(folder.root, scope, io = dispatcher)
        drafts.follow { DraftsChange(next = ana.accountId) }
        return MockRunStore(api, AppCache(session, scope), drafts) { "UTC" }
    }

    private suspend fun MockRunStore.opened(): OpenedMock {
        val read = open(RUN_BLOCK)
        read.load()
        return (read.state.value as LoadState.Loaded).value
    }

    private suspend fun MockRunStore.runner() = MockRunnerViewModel(this, session, RUN_BLOCK, opened(), reread = { rereads++ })

    private suspend fun MockRunStore.kept() = unsent(ana, RUN_BLOCK).value.first().orEmpty()

    @Test
    fun answersLeftOnTheDeviceGoOutFirstWhenTheMockOpensAgain() =
        runTest(dispatcher) {
            api.mock = navigatedMock(FORWARD_ONLY)
            val store = store()
            val kept = MockDraft(ITEM_ONE, Answer.Choice(2), durationMs = 4000, flagged = true)
            store.unsent(ana, RUN_BLOCK).save(listOf(kept))

            val viewModel = store.runner()
            advanceTimeBy(1_000)
            runCurrent()

            // A forward-only section's visit to the question on screen never goes out ahead of its kept answer.
            assertEquals(listOf(kept), api.saved)
            assertEquals(kept, viewModel.state.value.drafts[ITEM_ONE])
            assertTrue(store.kept().isEmpty())
        }

    @Test
    fun anAnswerThatCouldntBeSentStaysOnTheDevice() =
        runTest(dispatcher) {
            val store = store()
            api.saveFailure = UNREACHABLE

            val viewModel = store.runner()
            viewModel.answer(Answer.Choice(1))
            viewModel.onStop()
            runCurrent()

            assertEquals(Answer.Choice(1), store.kept().single { it.itemId == ITEM_ONE }.answer)
            assertEquals(DraftSaveStatus.Retrying, viewModel.saveStatus.value)

            // Back online, the retry gets it through and the device lets it go.
            api.saveFailure = null
            advanceUntilIdle()
            assertEquals(Answer.Choice(1), api.saved.last { it.itemId == ITEM_ONE }.answer)
            assertTrue(store.kept().isEmpty())
        }

    @Test
    fun typingIsKeptOnTheDeviceAsSoonAsTheAppGoesToTheBackground() =
        runTest(dispatcher) {
            val store = store()
            val viewModel = store.runner()

            viewModel.write(Answer.Text("Paris"))
            viewModel.onStop()
            runCurrent()

            assertEquals(Answer.Text("Paris"), store.kept().single().answer)
            assertTrue(api.saved.isEmpty())
        }

    @Test
    fun reopeningReadsTheMockAgain() =
        runTest(dispatcher) {
            val store = store()
            store.opened()

            api.mock = secondSection()

            assertEquals(
                1L,
                store
                    .opened()
                    .view.current
                    ?.section,
            )
        }

    @Test
    fun aReadDuringTheSectionKeepsTheAnswersBeingGiven() =
        runTest(dispatcher) {
            api.saveFailure = UNREACHABLE
            val viewModel = store().runner()
            viewModel.answer(Answer.Choice(1))
            viewModel.go(1)

            viewModel.show(runningMock())

            assertEquals(1, viewModel.state.value.position)
            assertEquals(
                Answer.Choice(1),
                viewModel.state.value.drafts[ITEM_ONE]
                    ?.answer,
            )
            api.saveFailure = null
            advanceUntilIdle()
        }

    @Test
    fun aReadThatMovedTheMockOnShowsWhereItStands() =
        runTest(dispatcher) {
            val viewModel = store().runner()

            viewModel.show(runningMock(extra = """"status":"expired""""))

            assertEquals(MockExam.Status.EXPIRED, viewModel.state.value.view.status)
        }

    @Test
    fun aReadDuringAHandInThatFailsIsShownAfterIt() =
        runTest(dispatcher) {
            api.stepGate = CompletableDeferred()
            api.stepFailure = ApiException(ApiError.Unavailable)
            val viewModel = store().runner()
            viewModel.submitSection()
            runCurrent()

            viewModel.show(runningMock(extra = """"status":"expired""""))
            assertEquals(MockExam.Status.RUNNING, viewModel.state.value.view.status)
            api.stepGate!!.complete(Unit)
            runCurrent()

            assertEquals(MockExam.Status.EXPIRED, viewModel.state.value.view.status)
        }

    @Test
    fun aQuestionThatTimedOutDuringAFailedHandInMovesOn() =
        runTest(dispatcher) {
            api.mock = navigatedMock(A_MINUTE_EACH)
            api.stepGate = CompletableDeferred()
            api.stepFailure = ApiException(ApiError.Unavailable)
            val viewModel = store().runner()
            viewModel.submitSection()
            runCurrent()

            viewModel.timeOutQuestion()
            api.stepGate!!.complete(Unit)
            runCurrent()

            assertTrue(viewModel.state.value.error)
            assertEquals(1, viewModel.state.value.position)
        }

    @Test
    fun backFromACallTheSpeakingPaperIsReadAgain() =
        runTest(dispatcher) {
            api.mock = runningMock(current = currentSection(questions = "", kind = "\"speaking\""))
            val viewModel = store().runner()

            viewModel.onStart()
            assertEquals(0, rereads)
            viewModel.onStop()
            viewModel.onStart()
            runCurrent()

            assertEquals(1, rereads)
        }
}
