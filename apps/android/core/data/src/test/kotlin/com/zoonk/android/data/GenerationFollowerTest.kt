package com.zoonk.android.data

import com.zoonk.api.models.Generation
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.takeWhile
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import kotlin.time.Duration.Companion.seconds

@OptIn(ExperimentalCoroutinesApi::class)
class GenerationFollowerTest {
    private class FakeSource : GenerationSource {
        val streams = mutableMapOf<String, MutableList<Flow<GenerationEvent>>>()
        val statuses = mutableMapOf<String, Generation.Status>()
        val opened = mutableListOf<String>()

        override fun events(id: String): Flow<GenerationEvent> {
            opened += id
            return streams[id]?.removeFirstOrNull() ?: flow { throw ApiException(ApiError.Network) }
        }

        override suspend fun status(id: String): Generation.Status = statuses[id] ?: throw ApiException(ApiError.Unavailable)
    }

    private fun event(
        step: String,
        status: String = "completed",
        at: Long? = null,
        entityId: String? = null,
    ) = GenerationEvent(at = at, entityId = entityId, status = status, step = step)

    private fun TestScope.follower(
        source: FakeSource,
        readGenerationId: (suspend () -> String?)? = null,
        restart: (suspend () -> String?)? = null,
    ): GenerationFollower {
        val scope = CoroutineScope(SupervisorJob() + StandardTestDispatcher(testScheduler))
        return GenerationFollower(GenerationKind.Understanding, scope, source, readGenerationId, restart, now = { 10_000 })
    }

    @Test
    fun aRunIsReadyOnceItsDoneStepArrives() =
        runTest {
            val source = FakeSource()
            source.streams["a"] =
                mutableListOf(
                    flow {
                        emit(event("readGoal", "started", at = 1_000))
                        emit(event("readGoal", at = 4_000))
                        emit(event("understandingReady"))
                        // The stream stays open; ready doesn't wait for it to close.
                        MutableSharedFlow<Unit>().collect {}
                    },
                )
            val follower = follower(source)

            follower.follow("a")
            runCurrent()

            val run = follower.run.value
            assertEquals(GenerationRun.Status.Ready, run.status)
            assertEquals(StepState.Completed, run.steps["readGoal"])
            assertEquals(StepTimes(started = 1_000, completed = 4_000), run.stepTimes["readGoal"])
            assertEquals(6_000L, run.clockOffsetMillis)
        }

    @Test
    fun aJoinedRunIsFollowedInstead() =
        runTest {
            val source = FakeSource()
            source.streams["a"] = mutableListOf(flow { emit(event("joinRunningUnderstanding", "started", entityId = "b")) })
            source.streams["b"] = mutableListOf(flow { emit(event("understandingReady")) })
            val follower = follower(source)

            follower.follow("a")
            runCurrent()

            assertEquals(listOf("a", "b"), source.opened)
            assertEquals(GenerationRun.Status.Ready, follower.run.value.status)
        }

    @Test
    fun aStreamThatClosesIsAnsweredByTheRunsStatus() =
        runTest {
            val source = FakeSource()
            source.streams["a"] =
                mutableListOf(
                    flow { emit(event("readGoal", "started")) },
                    flow { emit(event("readGoal")) },
                )
            source.statuses["a"] = Generation.Status.RUNNING
            val follower = follower(source)

            follower.follow("a")
            runCurrent()
            assertEquals(GenerationRun.Status.Following, follower.run.value.status)

            source.statuses["a"] = Generation.Status.COMPLETED
            advanceTimeBy(2.seconds)
            runCurrent()

            assertEquals(listOf("a", "a"), source.opened)
            assertEquals(GenerationRun.Status.Ready, follower.run.value.status)
        }

    @Test
    fun aRunThatFailedSaysSoAndStartsAgainOnlyOnRetry() =
        runTest {
            val source = FakeSource()
            source.streams["a"] = mutableListOf(flow { emit(event("readGoal", "error")) })
            source.streams["b"] = mutableListOf(flow { emit(event("understandingReady")) })
            var restarts = 0
            val follower =
                follower(source) {
                    restarts++
                    "b"
                }

            follower.follow("a")
            runCurrent()
            assertEquals(GenerationFailure.Generation, follower.run.value.failure)
            assertEquals(0, restarts)

            follower.retry()
            runCurrent()

            assertEquals(1, restarts)
            assertEquals(GenerationRun.Status.Ready, follower.run.value.status)
            assertNull(follower.run.value.failure)
        }

    @Test
    fun lostUpdatesReconnectToTheSameRunKeepingWhatItReported() =
        runTest {
            val source = FakeSource()
            source.streams["a"] =
                mutableListOf(
                    flow {
                        emit(event("readGoal"))
                        throw ApiException(ApiError.Network)
                    },
                    flow { emit(event("understandingReady")) },
                )
            val follower = follower(source)

            follower.follow("a")
            runCurrent()
            assertEquals(GenerationFailure.Connection, follower.run.value.failure)

            follower.retry()
            runCurrent()

            assertEquals(GenerationRun.Status.Ready, follower.run.value.status)
            assertEquals(StepState.Completed, follower.run.value.steps["readGoal"])
        }

    @Test
    fun aRunWithoutAnIdIsAskedForUntilItStartsOrSaidNotToHaveStarted() =
        runTest {
            val source = FakeSource()
            source.streams["a"] = mutableListOf(flow { emit(event("understandingReady")) })
            var reads = 0
            val late = follower(source, readGenerationId = { if (++reads == 3) "a" else null })

            late.follow(null)
            runCurrent()
            assertEquals(GenerationRun.Status.Waiting, late.run.value.status)
            advanceTimeBy(5.seconds)
            runCurrent()
            assertEquals(GenerationRun.Status.Ready, late.run.value.status)

            val never = follower(FakeSource(), readGenerationId = { null })
            never.follow(null)
            advanceTimeBy(46.seconds)
            runCurrent()
            assertEquals(GenerationFailure.NotStarted, never.run.value.failure)
        }

    @Test
    fun aStoppedRunBehindAnOpenStreamIsCaughtByItsStatus() =
        runTest {
            val source = FakeSource()
            val open = MutableSharedFlow<GenerationEvent>()
            source.streams["a"] = mutableListOf(open.takeWhile { true })
            source.statuses["a"] = Generation.Status.FAILED
            val follower = follower(source)

            follower.follow("a")
            advanceTimeBy(121.seconds)
            runCurrent()

            assertEquals(GenerationFailure.Generation, follower.run.value.failure)
            follower.stop()
        }
}
