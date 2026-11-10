package com.zoonk.android.feature.player

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.viewModelScope
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.DraftsChange
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.player.engine.LessonAction
import com.zoonk.android.feature.player.engine.LessonRun
import com.zoonk.android.feature.player.model.LessonLoad
import com.zoonk.api.models.LessonClockInput
import com.zoonk.api.models.LessonClockResult
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.cancel
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
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
import org.junit.runner.RunWith
import java.util.UUID

@RunWith(AndroidJUnit4::class)
@OptIn(ExperimentalCoroutinesApi::class)
class LessonClockTest {
    @get:Rule val folder = TemporaryFolder()
    private val dispatcher = StandardTestDispatcher()
    private val ana = AuthenticatedSession("ana", "token-a", "local-a")
    private val sessions = FakeSession(ana)
    private val lesson = playable(listOf(explanationStep("first"), explanationStep("last")))
    private val api = FakeLessonPlayerApi(LessonLoad.Ready(lesson)).apply { clockId = CLOCK }

    @Before fun main() = Dispatchers.setMain(dispatcher)

    @After fun reset() = Dispatchers.resetMain()

    private suspend fun TestScope.player(): LessonPlayerViewModel {
        val cache = AppCache(sessions, backgroundScope)
        val drafts = DraftStore(folder.newFolder(), backgroundScope, dispatcher)
        drafts.follow { DraftsChange("ana") }
        return LessonPlayerViewModel(
            lessonId = LESSON_ID,
            studySessionId = null,
            firstAnswer = null,
            store = LessonPlayerStore(api, cache),
            cache = cache,
            sessions = sessions,
            choices = TodayChoices(drafts),
            drafts = drafts,
            saved = SavedStateHandle(),
        ).also { it.open(lesson) }
    }

    @Test fun pausesOnLeaveAndResumesWithoutAnotherStart() =
        runTest(dispatcher) {
            val player = player()
            advanceUntilIdle()
            player.resume()
            assertTrue(api.clockUpdates.isEmpty())

            player.leave()
            player.leave()
            player.resume()
            player.resume()
            player.leave()
            advanceUntilIdle()

            assertEquals(listOf(update(1, PAUSED), update(2, RUNNING), update(3, PAUSED)), api.clockUpdates.map { it.second })
            assertEquals(listOf(ana, ana, ana), api.clockUpdates.map { it.first })
            assertEquals(1, api.startOpenings.size)
        }

    @Test fun ignoredRunningRestartsOnceWithTheRunAndUsesTheNewClock() =
        runTest(dispatcher) {
            val player = player()
            advanceUntilIdle()
            val nextClock = UUID.randomUUID()
            api.clockId = nextClock
            api.clockResponse = { LessonClockResult(LessonClockResult.Status.IGNORED) }
            player.leave()
            advanceUntilIdle()
            assertEquals(listOf(null), api.startRunIds)
            player.resume()
            advanceUntilIdle()
            player.resume()
            player.leave()
            advanceUntilIdle()

            assertEquals(listOf(null, RUN_ID), api.startRunIds)
            assertEquals(
                listOf(update(1, PAUSED), update(2, RUNNING), update(1, PAUSED).copy(clockId = nextClock)),
                api.clockUpdates.map { it.second },
            )
        }

    @Test fun ignoredRunningDoesNotRestartAfterLeavingAgain() =
        runTest(dispatcher) {
            val player = player()
            advanceUntilIdle()
            api.clockId = UUID.randomUUID()
            val running = CompletableDeferred<LessonClockResult>()
            api.clockResponse = {
                if (it.state == RUNNING) running.await() else LessonClockResult(LessonClockResult.Status.UPDATED)
            }
            player.leave()
            runCurrent()
            player.resume()
            runCurrent()
            assertEquals(listOf(update(1, PAUSED), update(2, RUNNING)), api.clockUpdates.map { it.second })
            player.leave()
            runCurrent()
            running.complete(LessonClockResult(LessonClockResult.Status.IGNORED))
            advanceUntilIdle()

            assertEquals(listOf(null), api.startRunIds)
            assertEquals(listOf(update(1, PAUSED), update(2, RUNNING), update(3, PAUSED)), api.clockUpdates.map { it.second })
        }

    @Test fun standaloneLessonsSkipClockCalls() =
        runTest(dispatcher) {
            api.clockId = null
            val player = player()
            advanceUntilIdle()
            player.leave()
            player.resume()
            advanceUntilIdle()
            assertTrue(api.clockUpdates.isEmpty())
        }

    @Test fun pausesAStartThatReturnsAfterThePlayerLeaves() =
        runTest(dispatcher) {
            api.startGate = CompletableDeferred()
            val player = player()
            runCurrent()
            player.leave()
            api.startGate!!.complete(Unit)
            advanceUntilIdle()

            assertEquals(listOf(update(1, PAUSED)), api.clockUpdates.map { it.second })
            player.resume()
            advanceUntilIdle()
            assertEquals(update(2, RUNNING), api.clockUpdates.last().second)
            assertEquals(1, api.startOpenings.size)
        }

    @Test fun returningBeforeStartFinishesNeedsNoClockTransition() =
        runTest(dispatcher) {
            api.startGate = CompletableDeferred()
            val player = player()
            runCurrent()
            player.leave()
            player.resume()
            api.startGate!!.complete(Unit)
            advanceUntilIdle()

            assertTrue(api.clockUpdates.isEmpty())
            assertEquals(1, api.startOpenings.size)
        }

    @Test fun eachFreshStartResetsTheClockSequence() =
        runTest(dispatcher) {
            val player = player()
            advanceUntilIdle()
            player.leave()
            player.resume()
            advanceUntilIdle()
            val nextClock = UUID.randomUUID()
            api.clockId = nextClock
            player.retryStart()
            advanceUntilIdle()
            player.leave()
            advanceUntilIdle()

            assertEquals(
                listOf(update(1, PAUSED), update(2, RUNNING), update(1, PAUSED).copy(clockId = nextClock)),
                api.clockUpdates.map { it.second },
            )
        }

    @Test fun aFreshStartWhileHiddenPausesItsOwnClock() =
        runTest(dispatcher) {
            val player = player()
            advanceUntilIdle()
            player.leave()
            advanceUntilIdle()
            val nextClock = UUID.randomUUID()
            api.clockId = nextClock
            player.retryStart()
            advanceUntilIdle()

            assertEquals(listOf(update(1, PAUSED), update(1, PAUSED).copy(clockId = nextClock)), api.clockUpdates.map { it.second })
        }

    @Test fun aNewStandaloneStartClearsThePreviousClock() =
        runTest(dispatcher) {
            val player = player()
            advanceUntilIdle()
            player.leave()
            player.resume()
            advanceUntilIdle()
            api.clockId = null
            player.retryStart()
            advanceUntilIdle()
            player.leave()
            player.resume()
            advanceUntilIdle()

            assertEquals(listOf(update(1, PAUSED), update(2, RUNNING)), api.clockUpdates.map { it.second })
        }

    @Test fun aFailedTransitionGoesAgainUnderItsSequenceUntilItGetsThrough() =
        runTest(dispatcher) {
            val player = player()
            advanceUntilIdle()
            player.leave()
            advanceUntilIdle()
            val before = player.state.value
            api.clockResponse = { throw ApiException(ApiError.Network) }
            player.resume()
            advanceUntilIdle()
            player.resume()
            advanceUntilIdle()
            assertEquals(before, player.state.value)
            assertTrue(player.state.value?.run is LessonRun.Started)
            api.clockResponse = { LessonClockResult(LessonClockResult.Status.UPDATED) }
            player.dispatch(LessonAction.Continue)
            advanceUntilIdle()
            player.resume()
            advanceUntilIdle()

            assertEquals(
                listOf(update(1, PAUSED), update(2, RUNNING), update(2, RUNNING), update(2, RUNNING)),
                api.clockUpdates.map { it.second },
            )
        }

    @Test fun finishingWaitsForTheClockToGetThrough() =
        runTest(dispatcher) {
            val player = player()
            advanceUntilIdle()
            player.dispatch(LessonAction.Continue)
            player.leave()
            advanceUntilIdle()
            api.clockResponse = { throw ApiException(ApiError.Network) }
            player.resume()
            advanceUntilIdle()
            val reply = CompletableDeferred<Unit>()
            api.clockResponse = {
                reply.await()
                LessonClockResult(LessonClockResult.Status.UPDATED)
            }
            player.dispatch(LessonAction.Continue)
            advanceUntilIdle()
            assertEquals(3, api.clockUpdates.size)
            assertTrue(api.completions.isEmpty())

            reply.complete(Unit)
            advanceUntilIdle()

            assertEquals(listOf(RUN_ID), api.completions)
        }

    @Test fun lateRepliesDoNotChangeTheNextSequence() =
        runTest(dispatcher) {
            val player = player()
            advanceUntilIdle()
            val paused = CompletableDeferred<Unit>()
            api.clockResponse = {
                if (it.state == PAUSED && it.sequence == 1L) paused.await()
                LessonClockResult(LessonClockResult.Status.UPDATED)
            }
            player.leave()
            runCurrent()
            player.resume()
            runCurrent()
            paused.complete(Unit)
            advanceUntilIdle()
            player.leave()
            advanceUntilIdle()

            assertEquals(listOf(update(1, PAUSED), update(2, RUNNING), update(3, PAUSED)), api.clockUpdates.map { it.second })
        }

    @Test fun anExitPauseFinishesAfterTheViewModelCloses() =
        runTest(dispatcher) {
            val player = player()
            advanceUntilIdle()
            val reply = CompletableDeferred<Unit>()
            var delivered = false
            api.clockResponse = {
                reply.await()
                delivered = true
                LessonClockResult(LessonClockResult.Status.UPDATED)
            }
            player.leave()
            player.viewModelScope.cancel()
            reply.complete(Unit)
            advanceUntilIdle()

            assertTrue(delivered)
            assertEquals(listOf(update(1, PAUSED)), api.clockUpdates.map { it.second })
        }

    @Test fun anotherSessionCannotSendThePreviousLearnersClock() =
        runTest(dispatcher) {
            val player = player()
            advanceUntilIdle()
            sessions.session = AuthenticatedSession("bob", "token-b", "local-b")
            player.leave()
            player.resume()
            advanceUntilIdle()

            assertTrue(api.clockUpdates.isEmpty())
        }

    private fun update(
        sequence: Long,
        state: LessonClockInput.State,
    ) = LessonClockInput(CLOCK, UUID.fromString(RUN_ID), sequence, state)

    private companion object {
        val CLOCK: UUID = UUID.fromString("00000000-0000-4000-8000-000000000011")
        val PAUSED = LessonClockInput.State.PAUSED
        val RUNNING = LessonClockInput.State.RUNNING
    }
}
