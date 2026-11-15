package com.zoonk.android.feature.mindmaps

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.value
import com.zoonk.android.feature.goalcontent.ChapterKey
import com.zoonk.api.models.GoalMindMaps
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlinx.serialization.json.Json
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import java.util.UUID

/**
 * Mind maps has one fact, the list's offer: a refusal that stops every map is written into it as the answer to a
 * request newer than any read on its way, and the read after it replaces it.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class MindMapOfferWriteTest {
    private val ana = AuthenticatedSession("ana", "token-a", "local-a")
    private val goalId = UUID.fromString(GOAL)
    private val dispatcher = StandardTestDispatcher()
    private val api = FakeMindMapApi()

    private val allowed = goalMindMaps(offer = """{"eligible":2,"needLessons":0,"startable":2,"stop":null}""")
    private val stopped =
        goalMindMaps(
            offer =
                """
                {"eligible":2,"needLessons":0,"startable":0,
                "stop":{"reason":"limitReached","resource":"mindMap","period":"rolling30Days","availableAt":"2026-04-01T12:00:00Z"}}
                """.trimIndent(),
        )

    /** Each read of the list waits for the test to answer it, in the order it chooses. */
    private val reads = ArrayDeque<CompletableDeferred<GoalMindMaps>>()

    @Before
    fun main() = Dispatchers.setMain(dispatcher)

    @After
    fun stop() = Dispatchers.resetMain()

    private fun TestScope.store() = MindMapStore(api, AppCache(FakeSession(ana), CoroutineScope(SupervisorJob() + dispatcher)))

    private fun MindMapStore.offer() =
        list[goalId]
            .state.value.value!!
            .createOffer

    private fun refuse(
        resource: String,
        period: String,
    ) {
        api.create = {
            throw ApiException(
                ApiError.Unavailable,
                "USAGE_LIMIT_REACHED",
                402,
                Json.parseToJsonElement(
                    """{"limit":{"availableAt":"2026-04-01T12:00:00Z","period":"$period","resource":"$resource","tier":"free"}}""",
                ),
            )
        }
    }

    /** The list read once, allowed; then a read on its way when the cap's refusal arrives, and the read after it. */
    private fun TestScope.refusedWhileAReadIsOnItsWay(): MindMapStore {
        api.mindMaps = { CompletableDeferred<GoalMindMaps>().also(reads::addLast).await() }
        val store = store()
        launch { store.list[goalId].refresh() }
        advanceUntilIdle()
        reads.removeFirst().complete(allowed)
        advanceUntilIdle()

        launch { store.list[goalId].refresh() }
        advanceUntilIdle()
        refuse("mindMap", "rolling30Days")
        launch { store.create(ChapterKey(goalId, UUID.fromString(mapChapter(3)))) }
        advanceUntilIdle()
        assertEquals(2, reads.size)
        return store
    }

    @Test
    fun theStopShowsWhileTheReadAfterItIsOnItsWay() =
        runTest(dispatcher) {
            val store = refusedWhileAReadIsOnItsWay()

            assertNotNull(store.offer().stop)
            assertEquals(0L, store.offer().startable)
            reads.last().complete(stopped)
            advanceUntilIdle()
        }

    @Test
    fun theNewerAllowedReadWinsWhenTheOlderOneFinishesLast() =
        runTest(dispatcher) {
            val store = refusedWhileAReadIsOnItsWay()
            val (older, newer) = reads.toList()

            newer.complete(allowed)
            advanceUntilIdle()
            older.complete(stopped)
            advanceUntilIdle()

            assertNull(store.offer().stop)
        }

    @Test
    fun theNewerAllowedReadWinsWhenTheOlderOneFinishesFirst() =
        runTest(dispatcher) {
            val store = refusedWhileAReadIsOnItsWay()
            val (older, newer) = reads.toList()

            older.complete(stopped)
            advanceUntilIdle()
            newer.complete(allowed)
            advanceUntilIdle()

            assertNull(store.offer().stop)
        }

    /** A map's own lessons stop only its row: that refusal never touches the offer, so it can't erase the page's stop. */
    @Test
    fun aRowOnlyRefusalCantEraseThePagesStop() =
        runTest(dispatcher) {
            api.mindMaps = { if (api.lists == 1) allowed else stopped }
            val store = store()
            store.list[goalId].refresh()
            refuse("mindMap", "rolling30Days")
            store.create(ChapterKey(goalId, UUID.fromString(mapChapter(3))))
            advanceUntilIdle()
            assertNotNull(store.offer().stop)
            val lists = api.lists

            refuse("chapterLessons", "total")
            store.create(ChapterKey(goalId, UUID.fromString(mapChapter(6))))
            advanceUntilIdle()

            assertNotNull(store.offer().stop)
            assertEquals(lists, api.lists)
        }
}
