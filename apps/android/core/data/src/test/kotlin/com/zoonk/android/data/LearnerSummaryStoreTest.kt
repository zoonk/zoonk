package com.zoonk.android.data

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.currentTime
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test
import kotlin.time.Duration.Companion.hours
import kotlin.time.Duration.Companion.milliseconds
import kotlin.time.Duration.Companion.minutes

@OptIn(ExperimentalCoroutinesApi::class)
class LearnerSummaryStoreTest {
    private val ana = AuthenticatedSession(ANA, "token-a", "local-a")

    @Test
    fun theSummaryIsReadAgainAtItsNextChangeAndNotBefore() =
        runTest {
            val scope = CoroutineScope(SupervisorJob() + StandardTestDispatcher(testScheduler))
            val cache = AppCache(FakeSession(ana), scope)
            var reads = 0
            val store =
                LearnerSummaryStore(
                    api = {
                        reads++
                        summary(readAt = currentTime, nextChangeAt = currentTime + 30.minutes.inWholeMilliseconds)
                    },
                    cache = cache,
                    scope = scope,
                    now = { currentTime },
                )
            // While shown, each read re-arms the timer, so time is stepped rather than run to idle.
            val frame = launch { store.summary.shown.collect {} }
            runCurrent()
            assertEquals(1, reads)

            advanceTimeBy(29.minutes.inWholeMilliseconds)
            assertEquals(1, reads)
            advanceTimeBy(2.minutes.inWholeMilliseconds)
            assertEquals(2, reads)
            frame.cancel()
        }

    @Test
    fun aSummaryNoScreenShowsWaitsForItsNextLoad() =
        runTest {
            val scope = CoroutineScope(SupervisorJob() + StandardTestDispatcher(testScheduler))
            val cache = AppCache(FakeSession(ana), scope)
            var reads = 0
            val store =
                LearnerSummaryStore(
                    api = {
                        reads++
                        summary(readAt = currentTime, nextChangeAt = currentTime + 10.minutes.inWholeMilliseconds)
                    },
                    cache = cache,
                    scope = scope,
                    now = { currentTime },
                )
            store.summary.load()
            advanceTimeBy(11.minutes.inWholeMilliseconds)
            assertEquals(1, reads)
            store.summary.load()
            assertEquals(2, reads)
        }

    @Test
    fun aPhoneWokenPastTheNextChangeReadsTheSummaryAgain() =
        runTest {
            val scope = CoroutineScope(SupervisorJob() + StandardTestDispatcher(testScheduler))
            val cache = AppCache(FakeSession(ana), scope)
            val foreground = MutableStateFlow(true)
            // A sleeping phone's wall clock moves on while coroutine timers, which count uptime, stand still.
            var wallClock = 0L
            var reads = 0
            val store =
                LearnerSummaryStore(
                    api = {
                        reads++
                        summary(readAt = wallClock, nextChangeAt = wallClock + 30.minutes.inWholeMilliseconds)
                    },
                    cache = cache,
                    scope = scope,
                    now = { wallClock },
                    isForeground = foreground,
                )
            val frame = launch { store.summary.shown.collect {} }
            runCurrent()
            assertEquals(1, reads)

            foreground.value = false
            runCurrent()
            wallClock += 8.hours.inWholeMilliseconds
            foreground.value = true
            runCurrent()
            assertEquals(2, reads)
            frame.cancel()
        }

    @Test
    fun aPhoneWokenJustBeforeTheNextChangeReadsTheSummaryAgainWhenItComes() =
        runTest {
            val scope = CoroutineScope(SupervisorJob() + StandardTestDispatcher(testScheduler))
            val cache = AppCache(FakeSession(ana), scope)
            val foreground = MutableStateFlow(true)
            var wallClock = 0L
            var reads = 0
            val store =
                LearnerSummaryStore(
                    api = {
                        reads++
                        summary(readAt = wallClock, nextChangeAt = 30.minutes.inWholeMilliseconds)
                    },
                    cache = cache,
                    scope = scope,
                    now = { wallClock },
                    isForeground = foreground,
                )
            val frame = launch { store.summary.shown.collect {} }
            runCurrent()
            assertEquals(1, reads)

            foreground.value = false
            runCurrent()
            wallClock += 29.minutes.inWholeMilliseconds
            foreground.value = true
            runCurrent()
            assertEquals(1, reads)

            wallClock += 1.minutes.inWholeMilliseconds
            advanceTimeBy(1.minutes + 1.milliseconds)
            runCurrent()
            assertEquals(2, reads)
            frame.cancel()
        }
}
