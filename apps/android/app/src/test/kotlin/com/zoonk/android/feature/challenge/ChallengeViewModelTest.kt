package com.zoonk.android.feature.challenge

import androidx.lifecycle.SavedStateHandle
import com.zoonk.android.data.ANA
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.GenerationEvent
import com.zoonk.android.data.GenerationSource
import com.zoonk.android.data.LoadState
import com.zoonk.android.feature.session.decodeFixture
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.Limit
import com.zoonk.api.models.Challenge
import com.zoonk.api.models.ChallengeGeneration
import com.zoonk.api.models.ChallengeMove
import com.zoonk.api.models.ChallengeMoveUndo
import com.zoonk.api.models.ChallengeStart
import com.zoonk.api.models.Generation
import com.zoonk.api.models.PlanEffect
import com.zoonk.api.models.StudyBlockStart
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlinx.datetime.LocalDate
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.util.UUID

@OptIn(ExperimentalCoroutinesApi::class)
class ChallengeViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val session = FakeSession(AuthenticatedSession(ANA, "token", "local"))
    private val blockId = UUID.fromString("7b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b")
    private val sessionId = UUID.fromString("8b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b")
    private val starts = mutableListOf<StudyBlockStart>()
    private var reads = 0
    private var missing = false
    private var start: (StudyBlockStart) -> ChallengeStart = { ChallengeStart(blockId, ChallengeStart.Kind.CHECKPOINT, sessionId) }
    private var write: () -> ChallengeGeneration = { ChallengeGeneration("gen-1", ChallengeGeneration.Status.GENERATING) }
    private var move: () -> ChallengeMove = { ChallengeMove(UUID.randomUUID(), LocalDate(2026, 11, 2), null, null) }

    @Before
    fun main() = Dispatchers.setMain(dispatcher)

    @After
    fun reset() = Dispatchers.resetMain()

    private val challenge: Challenge = decodeFixture("challenge")

    private fun TestScope.viewModel(saved: SavedStateHandle = SavedStateHandle()): ChallengeViewModel {
        val api =
            object : ChallengeApi {
                override suspend fun challenge(
                    session: AuthenticatedSession,
                    planItemId: UUID,
                    timeZone: String,
                ) = if (missing) throw ApiException(ApiError.NotFound) else challenge.also { reads++ }

                override suspend fun start(
                    session: AuthenticatedSession,
                    planItemId: UUID,
                    input: StudyBlockStart,
                ) = input.also(starts::add).let(start)

                override suspend fun writeQuestions(
                    session: AuthenticatedSession,
                    planItemId: UUID,
                ) = write()

                override suspend fun move(
                    session: AuthenticatedSession,
                    planItemId: UUID,
                    timeZone: String,
                ) = move()

                override suspend fun undoMove(
                    session: AuthenticatedSession,
                    planItemId: UUID,
                    changeId: UUID,
                    timeZone: String,
                ) = ChallengeMoveUndo(challenge.planItemId)
            }
        val source =
            object : GenerationSource {
                override fun events(id: String): Flow<GenerationEvent> =
                    flowOf(
                        GenerationEvent(status = "completed", step = "writeChallengeQuestions"),
                        GenerationEvent(status = "completed", step = "challengeQuestionsReady"),
                    )

                override suspend fun status(id: String) = Generation.Status.COMPLETED
            }
        val cache = AppCache(session, CoroutineScope(SupervisorJob() + dispatcher))
        return ChallengeViewModel(challenge.planItemId, "session", ChallengeStore(api, cache) { "UTC" }, source, saved)
    }

    @Test
    fun startingOpensTheBlockItStarted() =
        runTest(dispatcher) {
            val viewModel = viewModel()

            viewModel.start()
            advanceUntilIdle()

            assertEquals(AppRoute.Checkpoint(blockId.toString(), sessionId.toString()), viewModel.ui.value.opening)
            assertEquals(listOf(false), starts.map { it.afterWriting })
        }

    @Test
    fun aChallengeWithoutQuestionsWritesThemThenStarts() =
        runTest(dispatcher) {
            start = { input ->
                if (input.afterWriting == true) {
                    ChallengeStart(blockId, ChallengeStart.Kind.MOCK, sessionId)
                } else {
                    throw ApiException(ApiError.Unavailable, "QUESTIONS_NEEDED", status = 409)
                }
            }
            val viewModel = viewModel()

            viewModel.start()
            advanceUntilIdle()

            assertEquals(listOf(false, true), starts.map { it.afterWriting })
            assertEquals(AppRoute.Mock(blockId.toString(), sessionId.toString()), viewModel.ui.value.opening)
        }

    @Test
    fun aRefusedWritingShowsWhatRanOut() =
        runTest(dispatcher) {
            start = { throw ApiException(ApiError.Unavailable, "QUESTIONS_NEEDED", status = 409) }
            write = { throw ApiException(ApiError.Unavailable, "SIGN_UP_REQUIRED", status = 403) }
            val viewModel = viewModel()

            viewModel.start()
            advanceUntilIdle()

            assertTrue(viewModel.ui.value.refused is Limit)
            assertEquals(false, viewModel.ui.value.starting)
        }

    @Test
    fun aDayThatChangedReadsTheIntroAgainAndPlusRequiredSaysSo() =
        runTest(dispatcher) {
            val viewModel = viewModel()
            viewModel.challenge.load()
            advanceUntilIdle()

            start = { throw ApiException(ApiError.Unavailable, "DAILY_LIMIT_REACHED", status = 409) }
            viewModel.start()
            advanceUntilIdle()
            assertEquals(2, reads)
            assertNull(viewModel.ui.value.problem)

            start = { throw ApiException(ApiError.Unavailable, "CONFLICT", status = 409) }
            viewModel.start()
            advanceUntilIdle()
            assertEquals(3, reads)
            assertNull(viewModel.ui.value.problem)

            start = { throw ApiException(ApiError.Unavailable, "PLUS_REQUIRED", status = 403) }
            viewModel.start()
            advanceUntilIdle()
            assertEquals(StartProblem.PlusRequired, viewModel.ui.value.problem)
        }

    @Test
    fun aMoveShowsWhereItWentAndUndoBringsTheIntroBack() =
        runTest(dispatcher) {
            val viewModel = viewModel()

            viewModel.moveToMonday()
            advanceUntilIdle()
            assertEquals(
                LocalDate(2026, 11, 2),
                viewModel.ui.value.moved
                    ?.date,
            )

            viewModel.undoMove()
            advanceUntilIdle()
            assertNull(viewModel.ui.value.moved)
        }

    @Test
    fun undoShowsTheRestoredIntroThoughTheMoveLeftItMissing() =
        runTest(dispatcher) {
            move = { ChallengeMove(UUID.randomUUID(), LocalDate(2026, 11, 2), null, UUID.randomUUID()) }
            val viewModel = viewModel()
            val intro = backgroundScope.launch { viewModel.challenge.shown.collect {} }
            advanceUntilIdle()

            missing = true
            viewModel.moveToMonday()
            advanceUntilIdle()
            intro.cancel()

            missing = false
            viewModel.undoMove()
            advanceUntilIdle()

            assertEquals(challenge.planItemId, viewModel.ui.value.planItemId)
            val shown = viewModel.challenge.shown.first { it is LoadState.Loaded || it is LoadState.Failed }
            assertTrue("The intro reads the item as missing: $shown", shown is LoadState.Loaded)
        }

    @Test
    fun aMoveOutlivesTheProcessWithWhatUndoNeeds() =
        runTest(dispatcher) {
            val saved = SavedStateHandle()
            val movedItem = UUID.randomUUID()
            val moved =
                Moved(
                    UUID.randomUUID(),
                    LocalDate(2026, 11, 2),
                    PlanEffect(
                        endDateAfter = LocalDate(2026, 12, 4),
                        endDateBefore = LocalDate(2026, 12, 4),
                        lessonsAdded = 0,
                        lessonsRemoved = 1,
                        lessonsLeftOut = listOf("Photosynthesis"),
                    ),
                )
            move = { ChallengeMove(moved.changeId, moved.date, moved.effect, movedItem) }
            viewModel(saved).moveToMonday()
            advanceUntilIdle()

            val restored = viewModel(saved)

            assertEquals(movedItem, restored.ui.value.planItemId)
            assertEquals(moved, restored.ui.value.moved)
        }

    @Test
    fun aDayWithNoRoomSaysSo() =
        runTest(dispatcher) {
            move = {
                throw ApiException(
                    ApiError.Unavailable,
                    "PLAN_CHANGE_INVALID",
                    status = 422,
                    details = JsonObject(mapOf("reason" to JsonPrimitive("badMove"))),
                )
            }
            val viewModel = viewModel()

            viewModel.moveToMonday()
            advanceUntilIdle()

            assertEquals(MoveRefusal.NoRoom, viewModel.ui.value.refusal)
        }

    @Test
    fun aRefusedMoveSaysWhyAndStopsOfferingIt() =
        runTest(dispatcher) {
            move = {
                throw ApiException(
                    ApiError.Unavailable,
                    "PLAN_CHANGE_INVALID",
                    status = 422,
                    details =
                        JsonObject(
                            mapOf(
                                "reason" to JsonPrimitive("unfundedMove"),
                                "unfundedMove" to JsonObject(mapOf("date" to JsonPrimitive("2026-11-02"), "minutes" to JsonPrimitive(180))),
                            ),
                        ),
                )
            }
            val viewModel = viewModel()

            viewModel.moveToMonday()
            advanceUntilIdle()

            assertEquals(MoveRefusal.Unfunded(LocalDate(2026, 11, 2), 180), viewModel.ui.value.refusal)
            assertEquals(false, viewModel.ui.value.moveFailed)
        }
}
