package com.zoonk.android.feature.tutor

import androidx.compose.foundation.text.input.setTextAndPlaceCursorAtEnd
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.value
import com.zoonk.android.feature.plan.planChange
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LimitPeriod
import com.zoonk.android.ui.components.LimitTier
import com.zoonk.api.models.PlanChange
import com.zoonk.api.models.PlanChangeDecisionInput
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlinx.serialization.json.Json
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.util.UUID
import kotlin.time.Instant

@OptIn(ExperimentalCoroutinesApi::class)
class TutorViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val ana = AuthenticatedSession("ana", "token-a", "local-a")
    private val bia = AuthenticatedSession("bia", "token-b", "local-b")
    private val session = FakeSession(ana)
    private val api = FakeTutorApi()
    private val scope = TutorScope.Plan(GOAL)
    private var decision: (PlanChangeDecisionInput.Status) -> MutationResult<PlanChange> = {
        MutationResult.Done(planChange(status = it.value).copy(id = UUID.fromString(OTHER_CHANGE)))
    }

    @Before
    fun main() = Dispatchers.setMain(dispatcher)

    @After
    fun reset() = Dispatchers.resetMain()

    private suspend fun conversation(scope: TutorScope = this.scope): TutorViewModel {
        val cache = AppCache(session, CoroutineScope(SupervisorJob() + dispatcher))
        return TutorViewModel(
            scope,
            TutorStore(api, cache, session, { true }) { _, _, status -> decision(status) },
        ).also { it.thread.load() }
    }

    private val TutorViewModel.turns get() =
        thread.state.value.value!!
            .turns

    @Test
    fun sendingAddsTheQuestionAndStreamsItsAnswer() =
        runTest(dispatcher) {
            val vm = conversation()
            api.answers = { flowOf(TutorAnswerEvent.Text("An orbit "), TutorAnswerEvent.Text("is a path."), TutorAnswerEvent.Finish) }

            vm.draft.setTextAndPlaceCursorAtEnd("  Why?  ")
            vm.send()
            advanceUntilIdle()

            assertEquals(listOf("Why?"), api.asked.map { it.question })
            val turn = vm.turns.single()
            assertEquals(TutorTurn.Status.Completed, turn.status)
            assertEquals("An orbit is a path.", turn.answer)
            assertEquals("", vm.draft.text.toString())
            assertTrue(vm.state.value.canAsk(vm.turns))
        }

    @Test
    fun aHelpLimitTakesTheComposersPlace() =
        runTest(dispatcher) {
            val vm = conversation()
            val details = Json.parseToJsonElement("""{"limit":{"period":"day","tier":"free"}}""")
            api.refusal = ApiException(ApiError.Unavailable, "USAGE_LIMIT_REACHED", 403, details)

            vm.draft.setTextAndPlaceCursorAtEnd("Why?")
            vm.send()
            advanceUntilIdle()

            assertEquals(Limit.Reached(LimitTier.Free, LimitPeriod.Day), vm.state.value.limit(vm.turns))
            assertFalse(vm.state.value.canAsk(vm.turns))
            assertNull(vm.state.value.unresolvedQuestion)
        }

    @Test
    fun aQuestionWhoseReplyNeverCameIsSentAgainWithTheSameRequest() =
        runTest(dispatcher) {
            val vm = conversation()
            api.refusal = ApiException(ApiError.Network)
            vm.draft.setTextAndPlaceCursorAtEnd("Why?")
            vm.send()
            advanceUntilIdle()

            assertEquals("Why?", vm.state.value.unresolvedQuestion)
            assertEquals("Why?", vm.draft.text.toString())

            api.refusal = null
            api.answers = { flowOf(TutorAnswerEvent.Text("Because."), TutorAnswerEvent.Finish) }
            vm.draft.setTextAndPlaceCursorAtEnd("Something else")
            vm.send()
            advanceUntilIdle()

            assertEquals(listOf("Why?", "Why?"), api.asked.map { it.question })
            assertEquals(
                1,
                api.asked
                    .map { it.requestId }
                    .distinct()
                    .size,
            )
            assertNull(vm.state.value.unresolvedQuestion)
        }

    @Test
    fun aConflictReadsTheConversationAgain() =
        runTest(dispatcher) {
            val vm = conversation()
            api.refusal = ApiException(ApiError.Unavailable, status = 409)
            api.thread = TutorThread(listOf(turn("q1", TutorTurn.Status.Completed, "Saved meanwhile.")), hasMore = false, nextCursor = null)

            vm.draft.setTextAndPlaceCursorAtEnd("Why?")
            vm.send()
            advanceUntilIdle()

            assertEquals(2, api.threadReads)
            assertEquals("Saved meanwhile.", vm.turns.single().answer)
            assertNull(vm.state.value.askFailure)
        }

    @Test
    fun aDroppedAnswerSavedMeanwhileShowsAsAnswered() =
        runTest(dispatcher) {
            val vm = conversation()
            api.answers = {
                flow {
                    emit(TutorAnswerEvent.Text("An orb"))
                    throw ApiException(ApiError.Network)
                }
            }
            api.question = { id -> turn(id, TutorTurn.Status.Completed, "An orbit is a path.") }

            vm.draft.setTextAndPlaceCursorAtEnd("Why?")
            vm.send()
            advanceUntilIdle()

            assertEquals(TutorTurn.Status.Completed, vm.turns.single().status)
            assertEquals("An orbit is a path.", vm.turns.single().answer)
            assertTrue(
                vm.state.value.answerFailures
                    .isEmpty(),
            )
        }

    @Test
    fun aDroppedAnswerNotSavedFailsBlocksTheNextQuestionAndCanBeRetried() =
        runTest(dispatcher) {
            val vm = conversation()
            api.answers = { flow { throw ApiException(ApiError.Network) } }
            api.question = { id -> turn(id, TutorTurn.Status.Pending, null) }

            vm.draft.setTextAndPlaceCursorAtEnd("Why?")
            vm.send()
            advanceUntilIdle()

            val failed = vm.turns.single()
            assertEquals(TutorTurn.Status.Failed, failed.status)
            assertEquals(TutorFailure.Failed, vm.state.value.answerFailures[failed.id])
            assertFalse(vm.state.value.canAsk(vm.turns))

            api.answers = { flowOf(TutorAnswerEvent.Text("Because."), TutorAnswerEvent.Finish) }
            vm.retryAnswer(failed.id)
            advanceUntilIdle()

            assertEquals(TutorTurn.Status.Completed, vm.turns.single().status)
            assertTrue(vm.state.value.canAsk(vm.turns))
        }

    @Test
    fun anAnswerStopsWhenTheSessionChanges() =
        runTest(dispatcher) {
            val vm = conversation()
            api.answers = {
                flow {
                    emit(TutorAnswerEvent.Text("For Ana"))
                    session.session = bia
                    emit(TutorAnswerEvent.Text(" and Bia"))
                    emit(TutorAnswerEvent.Finish)
                }
            }

            vm.draft.setTextAndPlaceCursorAtEnd("Why?")
            vm.send()
            advanceUntilIdle()

            assertNull(vm.state.value.answeringId)
            assertTrue(
                vm.thread.state.value.value
                    ?.turns
                    .orEmpty()
                    .none { it.answer?.contains("Bia") == true },
            )
        }

    @Test
    fun followsAnAnswerWrittenElsewhereUntilItsDone() =
        runTest(dispatcher) {
            api.thread = TutorThread(listOf(turn("q1", TutorTurn.Status.Running, null)), hasMore = false, nextCursor = null)
            val vm = conversation()
            var reads = 0
            api.question = { id -> turn(id, if (++reads < 3) TutorTurn.Status.Running else TutorTurn.Status.Completed, "Done.") }

            assertEquals("q1", vm.state.value.remote(vm.turns))
            vm.followRemote("q1")

            assertEquals(3, reads)
            assertEquals(TutorTurn.Status.Completed, vm.turns.single().status)
            assertNull(vm.state.value.remote(vm.turns))
        }

    @Test
    fun earlierQuestionsGoBeforeTheConversation() =
        runTest(dispatcher) {
            api.thread = TutorThread(listOf(turn("q2", TutorTurn.Status.Completed, "Two.")), hasMore = true, nextCursor = "cursor")
            val vm = conversation()
            api.earlier = TutorThread(listOf(turn("q1", TutorTurn.Status.Completed, "One.")), hasMore = false, nextCursor = null)

            vm.loadEarlier()
            advanceUntilIdle()

            assertEquals(listOf("q1", "q2"), vm.turns.map { it.id })
            assertFalse(
                vm.thread.state.value.value!!
                    .hasMore,
            )
        }

    @Test
    fun anotherAccountDoesntResendTheFirstOnesQuestion() =
        runTest(dispatcher) {
            val vm = conversation()
            api.refusal = ApiException(ApiError.Network)
            vm.draft.setTextAndPlaceCursorAtEnd("Ana's question")
            vm.send()
            advanceUntilIdle()

            session.session = bia
            api.refusal = null
            vm.thread.load()
            vm.draft.setTextAndPlaceCursorAtEnd("Bia's question")
            vm.send()
            advanceUntilIdle()

            assertEquals("Bia's question", api.asked.last().question)
            assertEquals(
                2,
                api.asked
                    .map { it.requestId }
                    .distinct()
                    .size,
            )
        }

    @Test
    fun aReadInFlightDoesntDropTheNewQuestion() =
        runTest(dispatcher) {
            val vm = conversation()
            api.gate = kotlinx.coroutines.CompletableDeferred()
            launch { vm.thread.refresh() }
            advanceUntilIdle()

            vm.draft.setTextAndPlaceCursorAtEnd("Why?")
            vm.send()
            advanceUntilIdle()
            api.gate?.complete(Unit)
            advanceUntilIdle()

            assertEquals(listOf("q1"), vm.turns.map { it.id })
        }

    @Test
    fun linksCountAsCheckedOnlyOnceTheServersAnswerArrives() =
        runTest(dispatcher) {
            val vm = conversation()
            api.answers = {
                flow {
                    emit(TutorAnswerEvent.Text("See [this](https://example.com)"))
                    throw ApiException(ApiError.Network)
                }
            }
            api.question = { id -> turn(id, TutorTurn.Status.Pending, null) }
            vm.draft.setTextAndPlaceCursorAtEnd("Why?")
            vm.send()
            advanceUntilIdle()

            assertTrue("A partial answer that failed keeps its links shut", "q1" in vm.state.value.streamed)

            api.answers = {
                flow {
                    emit(TutorAnswerEvent.Text("See"))
                    throw ApiException(ApiError.Network)
                }
            }
            api.question = { id -> turn(id, TutorTurn.Status.Completed, "See [this](https://example.com)") }
            vm.retryAnswer("q1")
            advanceUntilIdle()

            assertFalse("The server's saved answer has checked links", "q1" in vm.state.value.streamed)
        }

    @Test
    fun anExpiredReadBackSignsTheSessionOut() =
        runTest(dispatcher) {
            val vm = conversation()
            api.answers = { flow { throw ApiException(ApiError.Network) } }
            api.question = { throw ApiException(ApiError.Unauthorized) }

            vm.draft.setTextAndPlaceCursorAtEnd("Why?")
            vm.send()
            advanceUntilIdle()

            assertEquals(listOf(ana), session.expired)
        }

    @Test
    fun aResentQuestionKeepsTheScopeItWasAskedIn() =
        runTest(dispatcher) {
            val unchecked = TutorScope.Item("item", blockId = null, answered = false)
            val vm = conversation(unchecked)
            api.refusal = ApiException(ApiError.Network)
            vm.draft.setTextAndPlaceCursorAtEnd("What is this asking?")
            vm.send()
            advanceUntilIdle()

            vm.scope = unchecked.copy(answered = true)
            api.refusal = null
            vm.send()
            advanceUntilIdle()

            assertEquals(listOf(unchecked, unchecked), api.asked.map { it.scope })
        }

    @Test
    fun polledAnswersBackOffWithinMainsBudget() {
        assertEquals(800, pollDelay(0, random = 0.0))
        assertEquals(2400, pollDelay(1, random = 1.0))
        assertEquals(5000, pollDelay(6, random = 0.5))
    }

    @Test
    fun applyingAChangeLeavesNoEarlierOneToUndo() =
        runTest(dispatcher) {
            api.thread = TutorThread(listOf(changeTurn("q1", planChange()), changeTurn("q2", proposed)), hasMore = false, nextCursor = null)
            decision = { MutationResult.Done(proposed.copy(status = PlanChange.Status.APPLIED)) }
            val vm = conversation()

            vm.decidePlanChange(proposed.id, PlanChangeDecisionInput.Status.APPLIED)
            advanceUntilIdle()

            assertEquals(listOf(false, true), vm.turns.map { it.planChange?.canUndo })
            assertEquals(
                PlanChange.Status.APPLIED,
                vm.turns
                    .last()
                    .planChange
                    ?.status,
            )
        }

    @Test
    fun aDecisionOutlastsAReadThatStartedBeforeIt() =
        runTest(dispatcher) {
            api.thread = TutorThread(listOf(changeTurn("q1", proposed)), hasMore = false, nextCursor = null)
            decision = { MutationResult.Done(proposed.copy(status = PlanChange.Status.DECLINED)) }
            val vm = conversation()
            api.gate = kotlinx.coroutines.CompletableDeferred()
            launch { vm.thread.refresh() }
            advanceUntilIdle()

            vm.decidePlanChange(proposed.id, PlanChangeDecisionInput.Status.DECLINED)
            advanceUntilIdle()
            api.gate?.complete(Unit)
            advanceUntilIdle()

            assertEquals(
                PlanChange.Status.DECLINED,
                vm.turns
                    .single()
                    .planChange
                    ?.status,
            )
        }

    private val proposed = planChange(status = "proposed").copy(id = UUID.fromString(OTHER_CHANGE))

    private fun changeTurn(
        id: String,
        change: PlanChange,
    ) = turn(id, TutorTurn.Status.Completed, "Try this.").copy(planChange = change)

    private fun <T> flowOf(vararg values: T): Flow<T> = flow { values.forEach { emit(it) } }

    private companion object {
        const val GOAL = "7b1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f"
        const val OTHER_CHANGE = "9a1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f"
    }
}
