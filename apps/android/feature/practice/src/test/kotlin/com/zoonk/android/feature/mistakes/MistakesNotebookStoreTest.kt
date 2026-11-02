package com.zoonk.android.feature.mistakes

import com.zoonk.android.data.ANA
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.value
import com.zoonk.api.ApiJson
import com.zoonk.api.models.GoalMistakePattern
import com.zoonk.api.models.MistakeList
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test
import java.util.UUID

@OptIn(ExperimentalCoroutinesApi::class)
class MistakesNotebookStoreTest {
    private val dispatcher = StandardTestDispatcher()
    private val key = NotebookKey(UUID.fromString("00000000-0000-4000-8000-0000000000a1"), fixed = false)
    private val pages = mutableMapOf<String?, () -> MistakeList>()
    private var gate: CompletableDeferred<Unit>? = null

    private fun mistake(id: Int) =
        """{"cause":"gap","createdAt":"2026-10-29T12:00:00Z","fixedAt":null,"id":"00000000-0000-4000-8000-00000000000$id",
        "itemId":null,"lesson":null,"practiceAvailable":true,"practiceAvailableTomorrow":false,"skill":null,
        "snapshot":{"answer":"5","question":"2 + 2?"},"status":"open"}"""

    private fun page(
        ids: List<Int>,
        nextCursor: String?,
    ): MistakeList =
        ApiJson.decodeFromString(
            MistakeList.serializer(),
            """{"availability":{"ready":3,"tomorrow":0},"counts":{"byCause":{"gap":3,"guess":0,"misread":0,"time":0,"trap":0,"unsorted":0},
            "fixed":0,"open":3},"data":[${ids.joinToString(",") { mistake(it) }}],
            "pagination":{"hasMore":${nextCursor != null},"nextCursor":${nextCursor?.let {
                "\"$it\""
            } ?: "null"}},"trueFalseLabels":"trueFalse"}""",
        )

    private fun TestScope.store(): MistakesNotebookStore {
        val session = FakeSession(AuthenticatedSession(ANA, "token", "local"))
        val api =
            object : NotebookApi {
                override suspend fun page(
                    session: AuthenticatedSession,
                    key: NotebookKey,
                    cursor: String?,
                    timeZone: String,
                ): MistakeList {
                    if (cursor != null) gate?.await()
                    return pages.getValue(cursor)()
                }

                override suspend fun pattern(
                    session: AuthenticatedSession,
                    goalId: UUID,
                ): GoalMistakePattern = error("Not used")
            }
        return MistakesNotebookStore(api, AppCache(session, CoroutineScope(SupervisorJob() + dispatcher)), session) { "UTC" }
    }

    private fun MistakesNotebookStore.ids() =
        notebooks[key]
            .state.value.value
            ?.`data`
            ?.map {
                it.id
                    .toString()
                    .takeLast(1)
                    .toInt()
            }

    @Test
    fun theNextPageJoinsTheListWithoutRepeatingAMistake() =
        runTest(dispatcher) {
            pages[null] = { page(listOf(1, 2), nextCursor = "c1") }
            pages["c1"] = { page(listOf(2, 3), nextCursor = null) }
            val store = store()
            store.notebooks[key].refresh()

            val loaded = store.more(key)

            assertEquals(true, loaded)
            assertEquals(listOf(1, 2, 3), store.ids())
            assertEquals(
                null,
                store.notebooks[key]
                    .state.value.value
                    ?.pagination
                    ?.nextCursor,
            )
        }

    @Test
    fun aPageThatLandsAfterARefreshDoesntJoinTheNewList() =
        runTest(dispatcher) {
            pages[null] = { page(listOf(1, 2), nextCursor = "c1") }
            pages["c1"] = { page(listOf(3), nextCursor = null) }
            gate = CompletableDeferred()
            val store = store()
            store.notebooks[key].refresh()

            val more = async { store.more(key) }
            advanceUntilIdle()
            pages[null] = { page(listOf(4), nextCursor = null) }
            store.notebooks[key].refresh()
            gate?.complete(Unit)
            more.await()

            assertEquals(listOf(4), store.ids())
        }

    @Test
    fun aPageThatDoesntLoadSaysSoAndKeepsTheList() =
        runTest(dispatcher) {
            pages[null] = { page(listOf(1), nextCursor = "c1") }
            pages["c1"] = { throw ApiException(ApiError.Network) }
            val store = store()
            store.notebooks[key].refresh()

            assertEquals(false, store.more(key))
            assertEquals(listOf(1), store.ids())
        }
}
