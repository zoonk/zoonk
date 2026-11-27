package com.zoonk.android.feature.completedlessons

import com.zoonk.android.data.ANA
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.value
import com.zoonk.api.ApiJson
import com.zoonk.api.models.CompletedLessonList
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
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Test
import java.util.UUID

@OptIn(ExperimentalCoroutinesApi::class)
class CompletedLessonsStoreTest {
    private val dispatcher = StandardTestDispatcher()
    private val query = CompletedLessonsQuery(UUID.fromString("00000000-0000-4000-8000-0000000000a1"))
    private val pages = mutableMapOf<String?, () -> CompletedLessonList>()
    private var gate: CompletableDeferred<Unit>? = null

    private fun page(
        lessons: List<Pair<Int, String>>,
        nextCursor: String?,
    ): CompletedLessonList =
        ApiJson.decodeFromString(
            CompletedLessonList.serializer(),
            """{"data":[${lessons.joinToString(",") { (id, day) ->
                """{"available":true,"chapterTitle":"Cells","finishedOn":"$day","group":null,"lessonId":"00000000-0000-4000-8000-00000000000$id","saved":false,"title":"Lesson $id"}"""
            }}],"filter":null,"pagination":{"hasMore":${nextCursor != null},"nextCursor":${nextCursor?.let { "\"$it\"" } ?: "null"}}}""",
        )

    private fun TestScope.store(): CompletedLessonsStore {
        val session = FakeSession(AuthenticatedSession(ANA, "token", "local"))
        val api =
            CompletedLessonsApi { _, _, cursor ->
                if (cursor != null) gate?.await()
                pages.getValue(cursor)()
            }
        return CompletedLessonsStore(api, AppCache(session, CoroutineScope(SupervisorJob() + dispatcher)), session)
    }

    private fun CompletedLessonsStore.shown() =
        lessons[query]
            .state.value.value
            ?.`data`
            ?.map {
                it.lessonId
                    .toString()
                    .takeLast(1)
                    .toInt() to it.finishedOn.toString()
            }

    @Test
    fun aLessonTheNextPageRepeatsShowsOnce() =
        runTest(dispatcher) {
            // A lesson finished on another device after the first page loaded moved to the top, so the second page repeats lesson 1.
            pages[null] = { page(listOf(3 to "2026-11-02", 1 to "2026-11-01"), nextCursor = "c1") }
            pages["c1"] = { page(listOf(1 to "2026-11-01", 2 to "2026-10-30"), nextCursor = null) }
            val store = store()
            store.lessons[query].refresh()

            store.more(query)

            assertEquals(listOf(3 to "2026-11-02", 1 to "2026-11-01", 2 to "2026-10-30"), store.shown())
            assertNull(
                store.lessons[query]
                    .state.value.value
                    ?.pagination
                    ?.nextCursor,
            )
        }

    @Test
    fun aPageThatLandsAfterARefreshDoesntJoinTheNewList() =
        runTest(dispatcher) {
            pages[null] = { page(listOf(1 to "2026-11-01"), nextCursor = "c1") }
            pages["c1"] = { page(listOf(2 to "2026-10-30"), nextCursor = null) }
            gate = CompletableDeferred()
            val store = store()
            store.lessons[query].refresh()

            val more = async { store.more(query) }
            advanceUntilIdle()
            pages[null] = { page(listOf(4 to "2026-11-02"), nextCursor = null) }
            store.lessons[query].refresh()
            gate?.complete(Unit)
            more.await()

            assertEquals(listOf(4 to "2026-11-02"), store.shown())
        }

    @Test
    fun aPageThatDoesntLoadSaysSoAndKeepsTheList() =
        runTest(dispatcher) {
            pages[null] = { page(listOf(1 to "2026-11-01"), nextCursor = "c1") }
            pages["c1"] = { throw ApiException(ApiError.Network) }
            val store = store()
            store.lessons[query].refresh()

            assertFalse(store.more(query))
            assertEquals(listOf(1 to "2026-11-01"), store.shown())
        }
}
