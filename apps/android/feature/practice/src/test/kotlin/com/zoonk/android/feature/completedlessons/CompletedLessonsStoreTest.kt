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
    private val goalId = UUID.fromString("00000000-0000-4000-8000-0000000000a1")
    private val pages = mutableMapOf<String?, () -> CompletedLessonList>()
    private var gate: CompletableDeferred<Unit>? = null

    private fun page(
        lessons: List<Pair<Int, String>>,
        nextCursor: String?,
    ): CompletedLessonList =
        ApiJson.decodeFromString(
            CompletedLessonList.serializer(),
            """{"data":[${lessons.joinToString(",") { (id, day) ->
                """{"chapterTitle":"Cells","finishedOn":"$day","lessonId":"00000000-0000-4000-8000-00000000000$id","title":"Lesson $id"}"""
            }}],"pagination":{"hasMore":${nextCursor != null},"nextCursor":${nextCursor?.let { "\"$it\"" } ?: "null"}}}""",
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
        lessons[goalId]
            .state.value.value
            ?.`data`
            ?.map {
                it.lessonId
                    .toString()
                    .takeLast(1)
                    .toInt() to it.finishedOn.toString()
            }

    @Test
    fun aLessonReplayedWhileTheListWasOpenStaysUnderItsNewDayOnly() =
        runTest(dispatcher) {
            // Lesson 3 was replayed after the first page loaded, so the second page starts one lesson later than it did.
            pages[null] = { page(listOf(3 to "2026-11-02", 1 to "2026-11-01"), nextCursor = "c1") }
            pages["c1"] = { page(listOf(1 to "2026-11-01", 2 to "2026-10-30"), nextCursor = null) }
            val store = store()
            store.lessons[goalId].refresh()

            store.more(goalId)

            assertEquals(listOf(3 to "2026-11-02", 1 to "2026-11-01", 2 to "2026-10-30"), store.shown())
            assertNull(
                store.lessons[goalId]
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
            store.lessons[goalId].refresh()

            val more = async { store.more(goalId) }
            advanceUntilIdle()
            pages[null] = { page(listOf(4 to "2026-11-02"), nextCursor = null) }
            store.lessons[goalId].refresh()
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
            store.lessons[goalId].refresh()

            assertFalse(store.more(goalId))
            assertEquals(listOf(1 to "2026-11-01"), store.shown())
        }
}
