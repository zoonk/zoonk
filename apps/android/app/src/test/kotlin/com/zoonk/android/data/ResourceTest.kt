package com.zoonk.android.data

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.time.Duration.Companion.minutes
import kotlin.time.TestTimeSource

internal class FakeSession(
    var session: AuthenticatedSession?,
) : SessionSource {
    val expired = mutableListOf<AuthenticatedSession>()
    override val current get() = session

    override suspend fun expire(session: AuthenticatedSession) {
        expired += session
        if (this.session == session) this.session = null
    }
}

@OptIn(ExperimentalCoroutinesApi::class)
class ResourceTest {
    private val ana = AuthenticatedSession("ana", "token-a", "local-a")
    private val bia = AuthenticatedSession("bia", "token-b", "local-b")
    private val clock = TestTimeSource()

    private fun TestScope.cache(session: SessionSource) =
        AppCache(session, CoroutineScope(SupervisorJob() + StandardTestDispatcher(testScheduler)), clock)

    @Test
    fun concurrentCallersShareOneRequest() =
        runTest {
            var fetches = 0
            val gate = CompletableDeferred<Unit>()
            val resource =
                cache(FakeSession(ana)).resource<String>(Audience.SignedIn) {
                    fetches++
                    gate.await()
                    "today"
                }
            launch { resource.load() }
            launch { resource.load() }
            launch { resource.refresh() }
            runCurrent()
            assertEquals(LoadState.Loading, resource.state.value)
            gate.complete(Unit)
            advanceUntilIdle()
            assertEquals(1, fetches)
            assertEquals(LoadState.Loaded("today"), resource.state.value)
        }

    @Test
    fun freshValueIsNotRefetchedAndStaleValueRevalidatesInTheBackground() =
        runTest {
            var fetches = 0
            val gate = CompletableDeferred<Unit>()
            val resource =
                cache(FakeSession(ana)).resource<Int>(Audience.SignedIn) {
                    if (fetches > 0) gate.await()
                    ++fetches
                }
            resource.load()
            resource.load()
            assertEquals(1, fetches)

            clock += 6.minutes
            val revalidating = launch { resource.load() }
            runCurrent()
            assertEquals(LoadState.Loaded(1), resource.state.value)
            assertEquals(true, resource.isRefreshing.value)
            gate.complete(Unit)
            revalidating.join()
            assertEquals(LoadState.Loaded(2), resource.state.value)
        }

    @Test
    fun aReadThatAnswersWithoutWaitingFinishes() =
        runTest {
            val scope = CoroutineScope(SupervisorJob() + UnconfinedTestDispatcher(testScheduler))
            val resource = AppCache(FakeSession(ana), scope, clock).resource<String>(Audience.SignedIn) { "today" }
            resource.refresh()
            assertEquals(LoadState.Loaded("today"), resource.state.value)
        }

    @Test
    fun failedRefreshKeepsContentAndNotFoundReplacesIt() =
        runTest {
            var next: () -> String = { "plan" }
            val resource = cache(FakeSession(ana)).resource<String>(Audience.SignedIn) { next() }
            resource.load()
            next = { throw java.io.IOException("offline") }
            resource.refresh()
            assertEquals(LoadState.Loaded("plan"), resource.state.value)
            next = { throw ApiException(ApiError.NotFound) }
            resource.refresh()
            assertEquals(LoadState.Failed(ApiError.NotFound), resource.state.value)
        }

    @Test
    fun unauthorizedSignsTheOwnerOut() =
        runTest {
            val session = FakeSession(ana)
            val resource = cache(session).resource<String>(Audience.SignedIn) { throw ApiException(ApiError.Unauthorized) }
            resource.load()
            assertEquals(listOf(ana), session.expired)
            assertEquals(LoadState.Idle, resource.state.value)
        }

    @Test
    fun sessionChangeDropsPersonalDataKeepsPublicDataAndDiscardsLateResponses() =
        runTest {
            val session = FakeSession(ana)
            val cache = cache(session)
            val gate = CompletableDeferred<Unit>()
            val personal =
                cache.resource<String>(Audience.Viewer) { s ->
                    gate.await()
                    "for ${s?.accountId}"
                }
            val public = cache.resource<String>(Audience.Everyone) { "catalog" }
            public.load()
            launch { personal.load() }
            runCurrent()

            session.session = bia
            cache.followSession()
            gate.complete(Unit)
            advanceUntilIdle()

            assertEquals(LoadState.Idle, personal.state.value)
            assertEquals(LoadState.Loaded("catalog"), public.state.value)
            personal.load()
            assertEquals(LoadState.Loaded("for bia"), personal.state.value)
        }

    @Test
    fun invalidationRefetchesShownResourcesNowAndOthersWhenShown() =
        runTest {
            val cache = cache(FakeSession(ana))
            var progress = 0
            var goals = 0
            val shown = cache.resource<Int>(Audience.SignedIn, setOf(DataDomain.UserProgress)) { ++progress }
            val hidden = cache.resource<Int>(Audience.SignedIn, setOf(DataDomain.UserProgress, DataDomain.Goals)) { ++goals }
            val screen = launch { shown.shown.collect {} }
            hidden.load()
            advanceUntilIdle()

            cache.invalidate(setOf(DataDomain.UserProgress))
            advanceUntilIdle()
            assertEquals(LoadState.Loaded(2), shown.state.value)
            assertEquals(LoadState.Loaded(1), hidden.state.value)

            hidden.load()
            assertEquals(LoadState.Loaded(2), hidden.state.value)
            screen.cancel()
        }

    @Test
    fun mutationsInvalidateOnSuccessAndAreObsoleteAfterASessionChange() =
        runTest {
            val session = FakeSession(ana)
            val cache = cache(session)
            var reads = 0
            val summary = cache.resource<Int>(Audience.SignedIn, DataDomain.entries.toSet()) { ++reads }
            summary.load()

            val done = cache.mutate(setOf(DataDomain.Goals)) { s -> s.accountId }
            assertEquals(MutationResult.Done("ana"), done)
            summary.load()
            assertEquals(2, reads)

            val obsolete =
                cache.mutate(setOf(DataDomain.Goals)) {
                    session.session = bia
                    "late"
                }
            assertEquals(MutationResult.Obsolete, obsolete)

            val expired = cache.mutate { throw ApiException(ApiError.Unauthorized) }
            assertEquals(MutationResult.Obsolete, expired)
            assertEquals(listOf(bia), session.expired)

            session.session = ana
            val failed = cache.mutate { throw java.io.IOException("offline") }
            assertEquals(MutationResult.Failed(ApiError.Network), failed)
            assertTrue(session.expired.size == 1)

            val limit =
                kotlinx.serialization.json.Json
                    .parseToJsonElement("""{"limit":{"period":"day","tier":"free"}}""")
            val refused = cache.mutate { throw ApiException(ApiError.Unavailable, "USAGE_LIMIT_REACHED", 403, limit) }
            assertEquals(MutationResult.Failed(ApiError.Unavailable, "USAGE_LIMIT_REACHED", 403, limit), refused)
        }

    @Test
    fun aScreenStillShowingAResourceLoadsTheNewSessionsValue() =
        runTest {
            val session = FakeSession(null)
            val cache = cache(session)
            val fetchedFor = mutableListOf<String?>()
            val course =
                cache.resource<String>(Audience.Viewer) { s ->
                    fetchedFor += s?.accountId
                    "course for ${s?.accountId}"
                }
            val today = cache.resource<String>(Audience.SignedIn) { s -> "today for ${s?.accountId}" }
            val screen = launch { course.shown.collect {} }
            val frame = launch { today.shown.collect {} }
            advanceUntilIdle()
            assertEquals(LoadState.Loaded("course for null"), course.state.value)
            assertEquals(LoadState.Idle, today.state.value)

            session.session = ana
            cache.followSession()
            advanceUntilIdle()
            assertEquals(LoadState.Loaded("course for ana"), course.state.value)
            assertEquals(LoadState.Loaded("today for ana"), today.state.value)

            session.session = bia
            cache.followSession()
            advanceUntilIdle()
            assertEquals(LoadState.Loaded("course for bia"), course.state.value)
            assertEquals(LoadState.Loaded("today for bia"), today.state.value)
            assertEquals(listOf(null, "ana", "bia"), fetchedFor)
            screen.cancel()
            frame.cancel()
        }

    @Test
    fun aMutationsFullResponseReplacesWithoutARefetchAndBeatsAnOlderRead() =
        runTest {
            val cache = cache(FakeSession(ana))
            var planReads = 0
            var summaryReads = 0
            var coveredReads = 0
            val slowRead = CompletableDeferred<Unit>()
            val plan =
                cache.resource<String>(Audience.SignedIn, setOf(DataDomain.Goals)) {
                    planReads++
                    if (planReads == 2) slowRead.await()
                    "plan read $planReads"
                }
            val summary = cache.resource<Int>(Audience.SignedIn, setOf(DataDomain.Goals)) { ++summaryReads }
            val covered =
                cache.resource<String>(Audience.SignedIn, setOf(DataDomain.Goals)) {
                    coveredReads++
                    "covered read"
                }
            val screen = launch { plan.shown.collect {} }
            val frame = launch { summary.shown.collect {} }
            covered.load()
            advanceUntilIdle()

            val olderRead = launch { plan.refresh() } // still running when the write answers
            runCurrent()
            val result =
                cache.mutate(
                    invalidating = setOf(DataDomain.Goals),
                    replacing = { r: String -> listOf(plan.replacing("plan from $r"), covered.replacing("covered from $r")) },
                ) { "write" }
            slowRead.complete(Unit)
            olderRead.join()
            advanceUntilIdle()

            assertEquals(MutationResult.Done("write"), result)
            assertEquals(LoadState.Loaded("plan from write"), plan.state.value)
            assertEquals(2, planReads) // the first load and the older read, nothing after the write
            assertEquals(2, summaryReads) // everything else reading Goals still refetches
            covered.load()
            assertEquals(LoadState.Loaded("covered from write"), covered.state.value)
            assertEquals(1, coveredReads) // uncovered later: fresh, no request
            screen.cancel()
            frame.cancel()
        }

    @Test
    fun keyedReadsKeepWhatIsShownAndAFewRecentOnes() =
        runTest {
            val cache = cache(FakeSession(ana))
            val reads = mutableMapOf<Int, Int>()
            val lessons =
                cache.keyed<Int, String>(Audience.SignedIn, recentLimit = 3) { _, id ->
                    reads[id] = (reads[id] ?: 0) + 1
                    "lesson $id"
                }
            val open = lessons[0]
            val screen = launch { open.shown.collect {} }
            advanceUntilIdle()
            for (id in 1..20) lessons[id].load()
            assertEquals(4, lessons.size) // the shown one and the 3 most recent

            lessons[20].load()
            assertEquals(1, reads[20]) // a recent one returns without a request
            lessons[1].load()
            assertEquals(2, reads[1]) // a released one loads again

            cache.releaseInactive()
            assertEquals(1, lessons.size) // memory pressure keeps only what's shown
            assertEquals(LoadState.Loaded("lesson 0"), lessons[0].state.value)
            assertEquals(1, reads[0])
            screen.cancel()
        }

    @Test
    fun onlyAScreenCollectingShownCountsAsViewingIt() =
        runTest {
            val cache = cache(FakeSession(ana))
            var reads = 0
            val today = cache.resource<Int>(Audience.SignedIn) { ++reads }
            val timer = launch { today.state.collect {} }
            today.load()
            today.invalidate()
            advanceUntilIdle()
            assertEquals(1, reads) // observing its state isn't showing it

            val screen = launch { today.shown.collect {} }
            advanceUntilIdle()
            assertEquals(2, reads) // shown while stale: loads on appear
            screen.cancel()
            advanceUntilIdle()
            today.invalidate()
            advanceUntilIdle()
            assertEquals(2, reads) // the screen left: waits for its next load
            timer.cancel()
        }
}
