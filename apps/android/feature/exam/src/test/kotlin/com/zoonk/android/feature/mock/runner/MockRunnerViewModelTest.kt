package com.zoonk.android.feature.mock.runner

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.DraftsChange
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.GenerationSource
import com.zoonk.android.data.HeldRuns
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.WritingRuns
import com.zoonk.android.data.writingWaits
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
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
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
    private val runs = WritingRuns()

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

    private suspend fun MockRunStore.runner(source: GenerationSource = runs) =
        MockRunnerViewModel(this, session, RUN_BLOCK, opened(), reread = {
            rereads++
        }, writingWaits = writingWaits(source, session))

    private suspend fun MockRunStore.kept() = unsent(ana, RUN_BLOCK).value.first().orEmpty()

    @Test
    fun answersLeftOnTheDeviceGoOutFirstWhenTheMockOpensAgain() =
        runTest(dispatcher) {
            api.mock = navigatedMock(FORWARD_ONLY)
            val store = store()
            val kept = MockDraft(ITEM_ONE, Answer.Choice(2), durationMs = 4000, flagged = true).nextEdit()
            store.unsent(ana, RUN_BLOCK).save(listOf(kept))

            val viewModel = store.runner()
            advanceTimeBy(1_000)
            runCurrent()

            // A forward-only section's visit to the question on screen never goes out ahead of its kept answer.
            assertEquals(listOf(kept), api.saved)
            assertEquals(kept, viewModel.state.value.drafts[ITEM_ONE])
            assertTrue(store.kept().isEmpty())
        }

    /** A forward-only section of three questions allowing [answerChanges] in its review; [stored] are the answers the server has. */
    private fun forwardOnly(
        answerChanges: Int,
        stored: List<String>,
        changesLeft: Int = answerChanges,
        changedItemIds: List<String> = emptyList(),
    ) = navigatedMock(
        """{"answerChanges":$answerChanges,"forwardOnly":true,"itemSeconds":null,"mustAnswer":false}""",
        currentSection(
            questions =
                listOf(ITEM_ONE, ITEM_TWO, ITEM_THREE)
                    .mapIndexed { index, item -> question(item, index + 1, "Question ${index + 1}") }
                    .joinToString(","),
            drafts = stored.joinToString(",") { """{"answer":{"selectedIndex":0},"durationMs":1000,"flagged":false,"itemId":"$it"}""" },
            resume = stored.size - 1,
            changesLeft = changesLeft,
            changedItemIds = changedItemIds,
        ),
    )

    @Test
    fun aQuestionTheReviewAlreadyChangedChangesAgainWithoutUsingAnotherChange() =
        runTest(dispatcher) {
            api.mock =
                forwardOnly(
                    answerChanges = 2,
                    stored = listOf(ITEM_ONE, ITEM_TWO, ITEM_THREE),
                    changesLeft = 1,
                    changedItemIds = listOf(ITEM_TWO),
                )
            val viewModel = store().runner()

            viewModel.go(1)
            viewModel.answer(Answer.Choice(2))
            assertEquals(
                Answer.Choice(2),
                viewModel.state.value.drafts[ITEM_TWO]
                    ?.answer,
            )
            assertEquals(1, viewModel.state.value.moves.changesLeft)

            viewModel.go(0)
            viewModel.answer(Answer.Choice(1))
            assertEquals(0, viewModel.state.value.moves.changesLeft)
            assertTrue(
                viewModel.state.value.moves
                    .canChange(1),
            )
            advanceUntilIdle()
        }

    @Test
    fun aReviewsChangesKeptOnTheDeviceCountOnceWhenTheMockOpensAgain() =
        runTest(dispatcher) {
            api.mock =
                forwardOnly(
                    answerChanges = 3,
                    stored = listOf(ITEM_ONE, ITEM_TWO, ITEM_THREE),
                    changesLeft = 2,
                    changedItemIds = listOf(ITEM_TWO),
                )
            val store = store()
            store.unsent(ana, RUN_BLOCK).save(listOf(MockDraft(ITEM_TWO, Answer.Choice(2)), MockDraft(ITEM_ONE, Answer.Choice(1))))

            val moves =
                store
                    .runner()
                    .state.value.moves

            // Question 2 was already charged on the server, so only question 1 uses a change.
            assertEquals(1, moves.changesLeft)
            assertTrue(moves.canChange(0))
            assertTrue(moves.canChange(1))
        }

    @Test
    fun aSectionFinishedOfflineOpensAgainWhereItWasLeft() =
        runTest(dispatcher) {
            api.mock = forwardOnly(answerChanges = 1, stored = listOf(ITEM_ONE))
            val store = store()
            store.unsent(ana, RUN_BLOCK).save(
                listOf(
                    MockDraft(ITEM_TWO, Answer.Choice(0)),
                    MockDraft(ITEM_THREE, Answer.Choice(0)),
                    MockDraft(ITEM_ONE, Answer.Choice(1)),
                ),
            )

            val run = store.runner().state.value

            assertEquals(2, run.position)
            assertEquals(2, run.reached)
            assertEquals(0, run.moves.changesLeft)
            assertTrue(run.moves.canChange(0))
            assertFalse(run.moves.canChange(1))
        }

    @Test
    fun anAnswerThatCouldntBeSentStaysOnTheDevice() =
        runTest(dispatcher) {
            val store = store()
            api.saveFailure = UNREACHABLE

            val viewModel = store.runner()
            viewModel.answer(Answer.Choice(1))
            assertEquals(1, viewModel.state.value.counts.answered)
            viewModel.onStop()
            runCurrent()

            assertEquals(Answer.Choice(1), store.kept().single { it.itemId == ITEM_ONE }.answer)
            assertEquals(DraftSaveStatus.Retrying, viewModel.saveStatus.value)
            assertEquals(0, viewModel.state.value.counts.answered)

            // Back online, the answer counts only once the server keeps it, not while it's on its way.
            api.saveFailure = null
            api.saveGate = CompletableDeferred()
            viewModel.retrySaves()
            runCurrent()
            assertEquals(0, viewModel.state.value.counts.answered)

            api.saveGate?.complete(Unit)
            advanceUntilIdle()
            assertEquals(Answer.Choice(1), api.saved.last { it.itemId == ITEM_ONE }.answer)
            assertEquals(1, viewModel.state.value.counts.answered)
            assertTrue(store.kept().isEmpty())
        }

    @Test
    fun writtenTypingIsKeptOnTheDeviceAndSentWithItsOriginalEditWhenOpenedAgain() =
        runTest(dispatcher) {
            api.mock = runningMock(current = currentSection(questions = question(ITEM_ONE, 1, "Write an answer", format = "essay")))
            val store = store()
            val viewModel = store.runner()

            viewModel.write(Answer.Text("Paris"))
            viewModel.onStop()
            runCurrent()

            val kept = store.kept().single()
            assertEquals(Answer.Text("Paris"), kept.answer)
            assertTrue(api.saved.isEmpty())

            val reopened = store.runner()
            runCurrent()
            assertEquals(kept, api.saved.single())

            reopened.onStop()
            runCurrent()
            assertTrue(store.kept().isEmpty())
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
    fun aRefusedAnswerIsNoLongerSaidOnceItsSectionIsHandedIn() =
        runTest(dispatcher) {
            api.saveOutcome = SaveOutcome.Refused
            val viewModel = store().runner()
            viewModel.answer(Answer.Choice(1))
            runCurrent()
            assertEquals(DraftSaveStatus.Refused, viewModel.saveStatus.value)

            api.mock = secondSection()
            viewModel.submitSection()
            runCurrent()

            assertEquals(
                1,
                viewModel.state.value.view.current
                    ?.section
                    ?.toInt(),
            )
            assertEquals(DraftSaveStatus.Saved, viewModel.saveStatus.value)
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
    fun aSpeakingPaperBeingWrittenIsWaitedOnThenTheSpeakingPartStartsAgain() =
        runTest(dispatcher) {
            api.mock = runningMock(current = currentSection(questions = "", kind = "\"speaking\""))
            api.paperWritings += "run-1"
            val viewModel = store().runner()

            viewModel.startSpeaking()
            runCurrent()

            assertEquals(2, api.speakingStarts)
            assertEquals(listOf("run-1"), runs.followed)
            assertNull(viewModel.speakingPaper.generationId.value)
            assertFalse(viewModel.state.value.error)
        }

    @Test
    fun leavingASpeakingPaperWaitClearsItAndDoesNotRestartSpeaking() =
        runTest(dispatcher) {
            api.mock = runningMock(current = currentSection(questions = "", kind = "\"speaking\""))
            api.paperWritings += "run-1"
            val held = HeldRuns()
            val viewModel = store().runner(held)
            viewModel.startSpeaking()
            runCurrent()
            assertEquals("run-1", viewModel.speakingPaper.generationId.value)
            viewModel.visit.end()
            held.write()
            runCurrent()
            assertNull(viewModel.speakingPaper.generationId.value)
            assertEquals(1, api.speakingStarts)
        }

    @Test
    fun aLateSpeakingPaperAnswerCannotInstallAnotherWait() =
        runTest(dispatcher) {
            api.mock = runningMock(current = currentSection(questions = "", kind = "\"speaking\""))
            val gate = CompletableDeferred<Unit>().also { api.speakingGate = it }
            api.paperWritings += "run-1"
            val viewModel = store().runner()
            viewModel.startSpeaking()
            runCurrent()
            viewModel.visit.end()
            gate.complete(Unit)
            runCurrent()
            assertNull(viewModel.speakingPaper.generationId.value)
            assertEquals(1, api.speakingStarts)
        }

    @Test
    fun aSpeakingPaperStillUnwrittenAfterItsRunFailsTheStepRatherThanWaitingAgain() =
        runTest(dispatcher) {
            api.mock = runningMock(current = currentSection(questions = "", kind = "\"speaking\""))
            api.paperWritings += listOf("run-1", "run-2")
            val viewModel = store().runner()

            viewModel.startSpeaking()
            runCurrent()

            assertEquals(2, api.speakingStarts)
            assertNull(viewModel.speakingPaper.generationId.value)
            assertTrue(viewModel.state.value.error)
        }

    @Test
    fun aSpeakingStartThatFailsAfterItsPaperWasWrittenClosesTheWaitAndSaysSo() =
        runTest(dispatcher) {
            api.mock = runningMock(current = currentSection(questions = "", kind = "\"speaking\""))
            api.paperWritings += "run-1"
            api.speakingFailure = UNREACHABLE
            val viewModel = store().runner()

            viewModel.startSpeaking()
            runCurrent()

            assertEquals(2, api.speakingStarts)
            assertNull(viewModel.speakingPaper.generationId.value)
            assertTrue(viewModel.state.value.error)
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
