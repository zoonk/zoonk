package com.zoonk.android.feature.tutor

import androidx.compose.foundation.text.input.setTextAndPlaceCursorAtEnd
import androidx.compose.ui.text.TextRange
import androidx.lifecycle.SavedStateHandle
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.value
import com.zoonk.android.feature.country.CountryChoice
import com.zoonk.android.feature.plan.planChange
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LimitPeriod
import com.zoonk.android.ui.components.LimitTier
import com.zoonk.api.models.PlanChange
import com.zoonk.api.models.PlanChangeDecisionInput
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceTimeBy
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
import org.junit.runner.RunWith
import java.util.UUID
import kotlin.time.Instant

@OptIn(ExperimentalCoroutinesApi::class)
internal abstract class TutorFixture {
    protected val dispatcher = StandardTestDispatcher()
    protected val ana = AuthenticatedSession("ana", "token-a", "local-a")
    protected val bia = AuthenticatedSession("bia", "token-b", "local-b")
    protected val session = FakeSession(ana)
    protected val api = FakeTutorApi()
    protected val scope = TutorScope.Plan(GOAL, CONVERSATION)
    protected var decision: (PlanChangeDecisionInput.Status) -> MutationResult<PlanChange> = {
        MutationResult.Done(planChange(status = it.value).copy(id = UUID.fromString(OTHER_CHANGE)))
    }

    @Before
    fun main() = Dispatchers.setMain(dispatcher)

    @After
    fun reset() = Dispatchers.resetMain()

    protected suspend fun conversation(
        scope: TutorScope = this.scope,
        cache: AppCache = AppCache(session, CoroutineScope(SupervisorJob() + dispatcher)),
        saved: SavedStateHandle = SavedStateHandle(),
        openMission: suspend (UUID) -> MutationResult<AppRoute?> = { MutationResult.Obsolete },
        setHomeCountry: suspend (CountryChoice) -> Boolean = { true },
    ): TutorViewModel =
        TutorViewModel(
            scope,
            TutorStore(
                api,
                cache,
                session,
                { MutationResult.Done(Unit) },
                { _, _ -> MutationResult.Done(Unit) },
                { _, _ -> MutationResult.Done(Unit) },
                setHomeCountry,
            ) { _, _, status -> decision(status) },
            saved,
            openMission = openMission,
        ).also { it.thread.load() }

    protected val TutorViewModel.turns get() =
        thread.state.value.value!!
            .turns
}

@OptIn(ExperimentalCoroutinesApi::class)
internal class TutorViewModelTest : TutorFixture() {
    @Test
    fun aStepLinkOpensOneAtATimeAndSaysWhyWhenItDidnt() =
        runTest(dispatcher) {
            val asked = mutableListOf<UUID>()
            var answer = CompletableDeferred<MutationResult<AppRoute?>>()
            val vm =
                conversation(openMission = {
                    asked += it
                    answer.await()
                })
            // The conversation's screen opens each route it's owed, then says so, as `TutorThreadView` does.
            val routes = mutableListOf<AppRoute>()
            val act = {
                vm.blockRoute.value?.let {
                    routes += it
                    vm.blockRoute.acted(it)
                }
            }

            vm.openBlock("turn-1", BLOCK)
            vm.openBlock("turn-2", BLOCK)
            advanceUntilIdle()
            assertEquals(listOf(BLOCK), asked)

            answer.complete(MutationResult.Done(null))
            advanceUntilIdle()
            assertEquals(BlockNotice("turn-1", closed = true), vm.blockNotice)

            answer = CompletableDeferred()
            vm.openBlock("turn-2", BLOCK)
            assertNull(vm.blockNotice)
            answer.complete(MutationResult.Failed(ApiError.Network))
            advanceUntilIdle()
            assertEquals(BlockNotice("turn-2", closed = false), vm.blockNotice)

            answer = CompletableDeferred()
            vm.openBlock("turn-2", BLOCK)
            answer.complete(MutationResult.Done(AppRoute.Today))
            advanceUntilIdle()
            act()
            assertEquals(listOf<AppRoute>(AppRoute.Today), routes)
            assertNull(vm.blockNotice)
            assertFalse(vm.isOpeningBlock)

            answer = CompletableDeferred()
            vm.openBlock("turn-2", BLOCK)
            advanceUntilIdle()
            vm.leave()
            answer.complete(MutationResult.Done(AppRoute.Exam))
            advanceUntilIdle()
            act()
            assertEquals("a step that opens after the learner left leads nowhere", listOf<AppRoute>(AppRoute.Today), routes)

            answer = CompletableDeferred()
            vm.openBlock("turn-2", BLOCK)
            advanceUntilIdle()
            vm.leave()
            answer.complete(MutationResult.Failed(ApiError.Network))
            advanceUntilIdle()
            assertNull("nor says anything once they come back", vm.blockNotice)
        }

    @Test
    fun aStepLinkThatOpensWhileTheConversationIsRecreatedLeadsThereOnce() =
        runTest(dispatcher) {
            val answer = CompletableDeferred<MutationResult<AppRoute?>>()
            val vm = conversation(openMission = { answer.await() })

            // A recreation: no screen acts while the step opens; the next one does, once.
            vm.openBlock("turn-1", BLOCK)
            answer.complete(MutationResult.Done(AppRoute.Exam))
            advanceUntilIdle()

            assertEquals(AppRoute.Exam, vm.blockRoute.value)
            vm.blockRoute.acted(AppRoute.Exam)
            assertNull(vm.blockRoute.value)
        }

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

    /** A question that couldn't be asked goes back to the composer unless something new was typed; a tapped suggestion leaves what's typed alone. */
    @Test
    fun aFailedQuestionGoesBackToTheComposerUnlessAnotherWasStarted() =
        runTest(dispatcher) {
            val vm = conversation()
            api.refusal = ApiException(ApiError.Unavailable, status = 422)

            vm.draft.setTextAndPlaceCursorAtEnd("Why?")
            vm.send()
            advanceUntilIdle()

            assertNull(vm.state.value.sending)
            assertEquals("Why?", vm.draft.text.toString())
            assertTrue(vm.state.value.isEmpty(vm.thread.state.value.value!!))

            api.askGate = CompletableDeferred()
            vm.send(TutorSuggestion("Explain it more simply"))
            advanceUntilIdle()
            assertEquals("Why?", vm.draft.text.toString())
            vm.draft.setTextAndPlaceCursorAtEnd("Something else")
            api.askGate?.complete(Unit)
            advanceUntilIdle()

            assertEquals("Something else", vm.draft.text.toString())
        }

    /** A lesson's suggestion only fills the composer: nothing is asked until the learner sends it, by its id only while unchanged. */
    @Test
    fun anOfferedSuggestionWaitsForSendAndGoesByItsIdOnlyUnchanged() =
        runTest(dispatcher) {
            val vm = conversation()
            val simpler = TutorSuggestion("Explain it more simply", "simpler")

            vm.offer(simpler)
            advanceUntilIdle()
            assertEquals("Explain it more simply", vm.draft.text.toString())
            assertTrue(api.asked.isEmpty())

            vm.send()
            advanceUntilIdle()
            vm.offer(simpler)
            vm.draft.setTextAndPlaceCursorAtEnd("Explain it more simply, with a picture")
            vm.send()
            advanceUntilIdle()

            assertEquals(listOf("simpler", null), api.asked.map { it.suggestion })
        }

    /** Android closing the app in the background keeps the question being written and the suggestion it started from. */
    @Test
    fun anAnswerMarksTheAllowanceItSpentStaleOnceItEnds() =
        runTest(dispatcher) {
            val cache = AppCache(session, CoroutineScope(SupervisorJob() + dispatcher))
            val vm = conversation(cache = cache)
            var reads = 0
            val allowance = cache.resource(Audience.SignedIn, setOf(DataDomain.Allowance)) { ++reads }
            allowance.load()
            val ended = CompletableDeferred<Unit>()
            api.answers = {
                flow {
                    emit(TutorAnswerEvent.Text("A path."))
                    ended.await()
                    emit(TutorAnswerEvent.Finish)
                }
            }

            vm.draft.setTextAndPlaceCursorAtEnd("Why?")
            vm.send()
            advanceUntilIdle()
            allowance.load()
            assertEquals(1, reads)

            ended.complete(Unit)
            advanceUntilIdle()
            allowance.load()
            assertEquals(2, reads)
        }

    @Test
    fun aDroppedAnswerStillMarksTheAllowanceStale() =
        runTest(dispatcher) {
            val cache = AppCache(session, CoroutineScope(SupervisorJob() + dispatcher))
            val vm = conversation(cache = cache)
            var reads = 0
            val allowance = cache.resource(Audience.SignedIn, setOf(DataDomain.Allowance)) { ++reads }
            allowance.load()
            api.answers = { flow { throw ApiException(ApiError.Network) } }
            api.question = { id -> turn(id, TutorTurn.Status.Pending, null) }

            vm.draft.setTextAndPlaceCursorAtEnd("Why?")
            vm.send()
            advanceUntilIdle()
            allowance.load()

            assertEquals(2, reads)
        }

    @Test
    fun aQuestionALimitRefusesWaitsInTheComposerUnderItsNotice() =
        runTest(dispatcher) {
            val refusals =
                listOf(
                    Triple(402, "USAGE_LIMIT_REACHED", """{"limit":{"period":"day","tier":"free"}}""") to
                        Limit.Reached(LimitTier.Free, LimitPeriod.Day),
                    Triple(403, "USAGE_LIMIT_REACHED", """{"limit":{"period":"total","tier":"guest"}}""") to
                        Limit.Reached(LimitTier.Guest, LimitPeriod.Total),
                    Triple(403, "SIGN_UP_REQUIRED", null) to Limit.SignUpRequired,
                )
            refusals.forEach { (refusal, limit) ->
                val (status, code, details) = refusal
                val vm = conversation()
                api.refusal = ApiException(ApiError.Unavailable, code, status, details?.let(Json::parseToJsonElement))

                vm.draft.setTextAndPlaceCursorAtEnd("Why?")
                vm.send()
                advanceUntilIdle()

                assertEquals(limit, vm.state.value.limit(vm.turns))
                assertEquals("Why?", vm.draft.text.toString())
                assertFalse(vm.state.value.canAsk(vm.turns))
                assertTrue(vm.turns.isEmpty())
                assertTrue(vm.state.value.offersSuggestions)

                vm.limitLifted()

                assertTrue(vm.state.value.canAsk(vm.turns))
                assertEquals("Why?", vm.draft.text.toString())
            }
        }

    @Test
    fun aQuestionASlowDownRefusesCanBeSentAgainOnceItsWaitIsOver() =
        runTest(dispatcher) {
            val vm = conversation()
            val details = Json.parseToJsonElement("""{"retryAfterSeconds":30}""")
            api.refusal = ApiException(ApiError.Unavailable, "SLOW_DOWN", 429, details)

            vm.draft.setTextAndPlaceCursorAtEnd("Why?")
            vm.send()
            advanceTimeBy(29_000)

            assertEquals(30, (vm.state.value.limit(vm.turns) as Limit.SlowDown).retryAfterSeconds)
            assertFalse(vm.state.value.canAsk(vm.turns))

            advanceTimeBy(2_000)

            assertNull(vm.state.value.limit(vm.turns))
            assertTrue(vm.state.value.canAsk(vm.turns))
            assertEquals("Why?", vm.draft.text.toString())

            api.refusal = null
            vm.send()
            advanceUntilIdle()

            assertEquals(listOf("Why?", "Why?"), api.asked.map { it.question })
            assertEquals("Why?", vm.turns.single().question)
        }

    @Test
    fun aSuggestionALimitRefusesLeavesTheComposerEmptyAndTheSuggestionsInPlace() =
        runTest(dispatcher) {
            val vm = conversation()
            val details = Json.parseToJsonElement("""{"limit":{"period":"day","tier":"free"}}""")
            api.refusal = ApiException(ApiError.Unavailable, "USAGE_LIMIT_REACHED", 402, details)

            vm.send(TutorSuggestion("Explain it more simply", "simpler"))
            advanceUntilIdle()

            assertEquals(Limit.Reached(LimitTier.Free, LimitPeriod.Day), vm.state.value.limit(vm.turns))
            assertEquals("", vm.draft.text.toString())
            assertTrue(vm.state.value.offersSuggestions)
            assertFalse(vm.state.value.canAsk(vm.turns))
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
            assertFalse(vm.state.value.offersSuggestions)

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
            assertTrue(vm.state.value.offersSuggestions)
        }

    /** A list read that began before the question saved can't land over it: the conversation stays listed and current. */
    @Test
    fun aListReadInFlightWhenAQuestionSavesIsReadAgain() =
        runTest(dispatcher) {
            val cache = AppCache(session, CoroutineScope(SupervisorJob() + dispatcher))
            val store = tutorStore(api, cache, session)
            val earlier = BuddyConversation(CONVERSATION, "Why cells?", Instant.parse("2026-11-25T09:00:00Z"))
            api.conversationPages = mapOf(null to BuddyConversationList(listOf(earlier), currentId = null, nextCursor = null))
            api.conversationsGate = CompletableDeferred()
            val list = store.conversations[GOAL]
            val reading = launch { list.load() }
            advanceUntilIdle()

            val fresh = store.newConversation(GOAL)
            val asked = BuddyConversation(fresh, "Why osmosis?", Instant.parse("2026-11-26T09:00:00Z"))
            api.conversationPages = mapOf(null to BuddyConversationList(listOf(asked, earlier), currentId = fresh, nextCursor = null))
            val asking = TutorViewModel(TutorScope.Plan(GOAL, fresh), store, SavedStateHandle(), openMission = { MutationResult.Obsolete })
            asking.thread.load()
            asking.draft.setTextAndPlaceCursorAtEnd("Why osmosis?")
            asking.send()
            advanceUntilIdle()

            api.conversationsGate?.complete(Unit)
            reading.join()
            advanceUntilIdle()

            val shown = list.state.value.value!!
            assertEquals(fresh, shown.currentId)
            assertEquals(listOf(fresh, CONVERSATION), shown.conversations.map { it.id })
        }

    @Test
    fun eachConversationKeepsItsOwnQuestionsAndAFirstOneJoinsTheList() =
        runTest(dispatcher) {
            val cache = AppCache(session, CoroutineScope(SupervisorJob() + dispatcher))
            val store = tutorStore(api, cache, session)
            val earlier = BuddyConversation(CONVERSATION, "Why cells?", Instant.parse("2026-11-25T09:00:00Z"))
            api.conversationPages = mapOf(null to BuddyConversationList(listOf(earlier), currentId = null, nextCursor = null))
            store.conversations[GOAL].load()
            val fresh = store.newConversation(GOAL)
            val answer = CompletableDeferred<Unit>()
            api.answers = {
                flow {
                    emit(TutorAnswerEvent.Text("Because."))
                    answer.await()
                    emit(TutorAnswerEvent.Finish)
                }
            }
            val asking = TutorViewModel(TutorScope.Plan(GOAL, fresh), store, SavedStateHandle(), openMission = { MutationResult.Obsolete })
            val other =
                TutorViewModel(TutorScope.Plan(GOAL, CONVERSATION), store, SavedStateHandle(), openMission = { MutationResult.Obsolete })
            asking.thread.load()
            api.thread = TutorThread(listOf(turn("old", TutorTurn.Status.Completed, "Yes.")), hasMore = false, nextCursor = null)
            other.thread.load()

            asking.draft.setTextAndPlaceCursorAtEnd("Why osmosis?")
            other.draft.setTextAndPlaceCursorAtEnd("Half written")
            asking.send()
            advanceUntilIdle()

            assertEquals(listOf(TutorScope.Plan(GOAL, fresh)), api.asked.map { it.scope })
            assertEquals("Because.", asking.turns.single().answer)
            assertEquals(listOf("old"), other.turns.map { it.id })
            assertEquals("Half written", other.draft.text.toString())
            assertEquals(
                listOf(fresh to "Why osmosis?", CONVERSATION to "Why cells?"),
                store.conversations[GOAL]
                    .state.value.value!!
                    .conversations
                    .map { it.id to it.title },
            )
            answer.complete(Unit)
            advanceUntilIdle()
        }

    @Test
    fun aScreensAskWaitsInTheComposerWhileAnEarlierQuestionIsUnanswered() =
        runTest(dispatcher) {
            val vm = conversation()
            val simpler = TutorSuggestion("Explain it more simply", "simpler")
            api.refusal = ApiException(ApiError.Network)
            vm.draft.setTextAndPlaceCursorAtEnd("Why?")
            vm.send()
            advanceUntilIdle()

            vm.ask(simpler)
            advanceUntilIdle()

            assertEquals(listOf("Why?"), api.asked.map { it.question })
            assertEquals("Explain it more simply", vm.draft.text.toString())
        }

    @Test
    fun aScreensAskDropsWhenTheLearnerLeavesBeforeTheConversationLoads() =
        runTest(dispatcher) {
            val cache = AppCache(session, CoroutineScope(SupervisorJob() + dispatcher))
            val store =
                TutorStore(
                    api,
                    cache,
                    session,
                    { MutationResult.Done(Unit) },
                    { _, _ -> MutationResult.Done(Unit) },
                    { _, _ -> MutationResult.Done(Unit) },
                    { true },
                ) { _, _, status -> decision(status) }
            val vm = TutorViewModel(scope, store, SavedStateHandle()) { MutationResult.Obsolete }

            vm.ask(TutorSuggestion("Explain it more simply", "simpler"))
            advanceUntilIdle()
            vm.leave()
            vm.thread.load()
            advanceUntilIdle()

            assertTrue(api.asked.isEmpty())
        }

    @Test
    fun aScreensAskKeepsWhatTheLearnerTypedWhileTheConversationLoaded() =
        runTest(dispatcher) {
            api.thread = TutorThread(listOf(turn("q1", TutorTurn.Status.Running, null)), hasMore = false, nextCursor = null)
            val cache = AppCache(session, CoroutineScope(SupervisorJob() + dispatcher))
            val store =
                TutorStore(
                    api,
                    cache,
                    session,
                    { MutationResult.Done(Unit) },
                    { _, _ -> MutationResult.Done(Unit) },
                    { _, _ -> MutationResult.Done(Unit) },
                    { true },
                ) { _, _, status -> decision(status) }
            val vm = TutorViewModel(scope, store, SavedStateHandle()) { MutationResult.Obsolete }

            vm.ask(TutorSuggestion("Explain it more simply", "simpler"))
            advanceUntilIdle()
            vm.draft.setTextAndPlaceCursorAtEnd("What's a cell wall?")
            vm.thread.load()
            advanceUntilIdle()

            assertEquals("What's a cell wall?", vm.draft.text.toString())
            assertTrue(api.asked.isEmpty())
        }

    @Test
    fun aScreensAskWaitsInTheComposerWhenTheConversationCantBeRead() =
        runTest(dispatcher) {
            api.threadFailure = ApiException(ApiError.Network)
            val cache = AppCache(session, CoroutineScope(SupervisorJob() + dispatcher))
            val store =
                TutorStore(
                    api,
                    cache,
                    session,
                    { MutationResult.Done(Unit) },
                    { _, _ -> MutationResult.Done(Unit) },
                    { _, _ -> MutationResult.Done(Unit) },
                    { true },
                ) { _, _, status -> decision(status) }
            val vm = TutorViewModel(scope, store, SavedStateHandle()) { MutationResult.Obsolete }

            vm.ask(TutorSuggestion("Explain it more simply", "simpler"))
            vm.thread.load()
            advanceUntilIdle()

            assertTrue(api.asked.isEmpty())
            assertEquals("Explain it more simply", vm.draft.text.toString())

            api.threadFailure = null
            vm.thread.refresh()
            advanceUntilIdle()
            vm.send()
            advanceUntilIdle()

            assertEquals(listOf("simpler"), api.asked.map { it.suggestion })
        }

    @Test
    fun aScreensAskGoesAtOnceWhenNothingIsUnanswered() =
        runTest(dispatcher) {
            val vm = conversation()

            vm.ask(TutorSuggestion("Explain it more simply", "simpler"))
            advanceUntilIdle()

            assertEquals(listOf("simpler"), api.asked.map { it.suggestion })
            assertEquals("", vm.draft.text.toString())
        }

    /** Another device asked first: the screen's ask waits in the composer, still going by its suggestion. */
    @Test
    fun aScreensAskTheServerTurnsAwayWaitsInTheComposerWithItsSuggestion() =
        runTest(dispatcher) {
            val vm = conversation()
            api.refusal = ApiException(ApiError.Unavailable, status = 409)
            api.thread = TutorThread(listOf(turn("elsewhere", TutorTurn.Status.Running, null)), hasMore = false, nextCursor = null)

            vm.ask(TutorSuggestion("Explain it more simply", "simpler"))
            advanceUntilIdle()

            assertEquals(listOf("elsewhere"), vm.turns.map { it.id })
            assertEquals("Explain it more simply", vm.draft.text.toString())

            api.refusal = null
            api.thread = TutorThread(listOf(turn("elsewhere", TutorTurn.Status.Completed, "Done.")), hasMore = false, nextCursor = null)
            vm.thread.refresh()
            vm.send()
            advanceUntilIdle()

            assertEquals(listOf("simpler", "simpler"), api.asked.map { it.suggestion })
        }

    @Test
    fun aScreensAskTheServerTurnsAwayKeepsWhatTheLearnerTypedMeanwhile() =
        runTest(dispatcher) {
            val vm = conversation()
            api.refusal = ApiException(ApiError.Unavailable, status = 409)
            api.askGate = CompletableDeferred()

            vm.ask(TutorSuggestion("Explain it more simply", "simpler"))
            advanceUntilIdle()
            vm.draft.setTextAndPlaceCursorAtEnd("What's a cell wall?")
            api.askGate?.complete(Unit)
            advanceUntilIdle()

            assertEquals("What's a cell wall?", vm.draft.text.toString())
        }

    @Test
    fun aQuestionSentWhileARefusedAskReadsTheConversationKeepsItsWords() =
        runTest(dispatcher) {
            val vm = conversation()
            api.refusal = ApiException(ApiError.Unavailable, status = 409)
            val suggestionAsk = CompletableDeferred<Unit>()
            api.askGate = suggestionAsk
            vm.ask(TutorSuggestion("Explain it more simply", "simpler"))
            advanceUntilIdle()
            vm.draft.setTextAndPlaceCursorAtEnd("What's a cell wall?")

            api.thread = TutorThread(listOf(turn("elsewhere", TutorTurn.Status.Running, null)), hasMore = false, nextCursor = null)
            val read = CompletableDeferred<Unit>()
            api.gate = read
            val typedAsk = CompletableDeferred<Unit>()
            api.askGate = typedAsk
            suggestionAsk.complete(Unit)
            advanceUntilIdle()
            vm.send()
            advanceUntilIdle()
            read.complete(Unit)
            advanceUntilIdle()
            typedAsk.complete(Unit)
            advanceUntilIdle()

            assertEquals(listOf("Explain it more simply", "What's a cell wall?"), api.asked.map { it.question })
            assertEquals("What's a cell wall?", vm.draft.text.toString())
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
    fun anAnswerASlowDownRefusesWaitsUnansweredUntilItsWaitIsOver() =
        runTest(dispatcher) {
            val vm = conversation()
            val details = Json.parseToJsonElement("""{"retryAfterSeconds":30}""")
            api.answers = { flow { throw ApiException(ApiError.Unavailable, "SLOW_DOWN", 429, details) } }
            api.question = { id -> turn(id, TutorTurn.Status.Pending, null) }

            vm.draft.setTextAndPlaceCursorAtEnd("Why?")
            vm.send()
            advanceTimeBy(29_000)

            val refused = vm.turns.single()
            assertEquals(TutorTurn.Status.Failed, refused.status)
            val slowDown = vm.state.value.limit(vm.turns) as Limit.SlowDown
            assertEquals(30, slowDown.retryAfterSeconds)
            assertEquals(TutorFailure.Refused(slowDown), vm.state.value.answerFailures[refused.id])
            assertFalse(vm.state.value.canAsk(vm.turns))

            advanceTimeBy(2_000)

            assertNull(vm.state.value.limit(vm.turns))
            assertEquals(TutorFailure.Unanswered, vm.state.value.answerFailures[refused.id])

            api.answers = { flowOf(TutorAnswerEvent.Text("Because."), TutorAnswerEvent.Finish) }
            vm.retryAnswer(refused.id)
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

            vm.decidePlanChange(proposed, PlanChangeDecisionInput.Status.APPLIED)
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
    fun anAcceptWhoseNumbersMovedAsksAgainWithTodays() =
        runTest(dispatcher) {
            api.thread = TutorThread(listOf(changeTurn("q1", proposed)), hasMore = false, nextCursor = null)
            decision = { MutationResult.Done(proposed.copy(quote = "quote-today")) }
            val vm = conversation()

            vm.decidePlanChange(proposed, PlanChangeDecisionInput.Status.APPLIED)
            advanceUntilIdle()

            val shown = vm.turns.single().planChange
            assertEquals(PlanChange.Status.PROPOSED, shown?.status)
            assertEquals("quote-today", shown?.quote)
            assertEquals(setOf(proposed.id), vm.state.value.repricedChanges)
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

            vm.decidePlanChange(proposed, PlanChangeDecisionInput.Status.DECLINED)
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

    @Test
    fun aVarietyCardShowsSavedOnlyWhileItsGoalHasItsCountry() =
        runTest(dispatcher) {
            val goal = UUID.fromString(GOAL)
            val vm = conversation()

            vm.applyVariety("q1", goal, "CA")
            assertEquals(OfferSave.Saving, vm.varietySave("q1", goal, "CA"))
            advanceUntilIdle()
            assertEquals(OfferSave.Saved, vm.varietySave("q1", goal, "CA"))

            vm.applyVariety("q2", goal, "AU")
            advanceUntilIdle()
            assertNull("the earlier card offers its country again", vm.varietySave("q1", goal, "CA"))
            assertEquals(OfferSave.Saved, vm.varietySave("q2", goal, "AU"))
        }

    @Test
    fun countryCardsShowSavedOnlyWhileTheirSettingHolds() =
        runTest(dispatcher) {
            val goal = UUID.fromString(GOAL)
            var homeSaves = false
            val vm = conversation(setHomeCountry = { homeSaves })

            vm.applyContentCountry("q1", goal, "PT")
            advanceUntilIdle()
            assertEquals(OfferSave.Saved, vm.contentCountrySave("q1", goal, "PT"))
            vm.goalCountries = mapOf(goal to "BR")
            assertNull("a later country takes over", vm.contentCountrySave("q1", goal, "PT"))

            vm.applyHomeCountry("q2", CountryChoice("PT", "Portugal"))
            advanceUntilIdle()
            assertEquals(OfferSave.Failed, vm.homeCountrySave("q2", "PT"))
            homeSaves = true
            vm.applyHomeCountry("q2", CountryChoice("PT", "Portugal"))
            advanceUntilIdle()
            assertEquals(OfferSave.Saved, vm.homeCountrySave("q2", "PT"))
        }

    private val proposed = planChange(status = "proposed").copy(id = UUID.fromString(OTHER_CHANGE))

    private fun changeTurn(
        id: String,
        change: PlanChange,
    ) = turn(id, TutorTurn.Status.Completed, "Try this.").copy(planChange = change)

    private fun <T> flowOf(vararg values: T): Flow<T> = flow { values.forEach { emit(it) } }
}

private const val GOAL = "7b1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f"
private const val CONVERSATION = "1d2c3b4a-5e6f-4a7b-8c9d-0e1f2a3b4c5d"
private const val OTHER_CHANGE = "9a1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f"
private val BLOCK: UUID = UUID.fromString("5d1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f")

@RunWith(AndroidJUnit4::class)
@OptIn(ExperimentalCoroutinesApi::class)
internal class TutorDraftRestoreTest : TutorFixture() {
    @Test
    fun aQuestionShowsWhileItsSentAndSurvivesAndroidClosingTheApp() =
        runTest(dispatcher) {
            val saved = SavedStateHandle()
            val vm = conversation(saved = saved)
            api.askGate = CompletableDeferred()
            vm.draft.setTextAndPlaceCursorAtEnd("Why?")
            advanceUntilIdle()

            vm.send()
            advanceUntilIdle()

            assertEquals(SendingQuestion("Why?", TutorTurn.About.Plan), vm.state.value.sending)
            assertEquals("", vm.draft.text.toString())
            assertTrue(vm.turns.isEmpty())
            assertFalse(vm.state.value.isEmpty(vm.thread.state.value.value!!))
            val restored = SavedStateHandle.createHandle(saved.savedStateProvider().saveState(), null)
            assertEquals("Why?", conversation(saved = restored).draft.text.toString())

            api.askGate?.complete(Unit)
            advanceUntilIdle()

            assertNull(vm.state.value.sending)
            assertEquals(listOf("Why?"), vm.turns.map { it.question })
            assertEquals("", vm.draft.text.toString())
        }

    @Test
    fun aQuestionBeingWrittenComesBackWithItsSuggestionAfterAndroidClosesTheApp() =
        runTest(dispatcher) {
            val saved = SavedStateHandle()
            val writing = conversation(saved = saved)
            writing.offer(TutorSuggestion("Explain it more simply", "simpler"))
            writing.draft.edit { selection = TextRange(8) }
            advanceUntilIdle()

            val restored = SavedStateHandle.createHandle(saved.savedStateProvider().saveState(), null)
            val reopened = conversation(saved = restored)
            assertEquals(TextRange(8), reopened.draft.selection)
            assertEquals("Explain it more simply", reopened.draft.text.toString())
            reopened.send()
            advanceUntilIdle()

            assertEquals(listOf("simpler"), api.asked.map { it.suggestion })
        }
}
