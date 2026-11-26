package com.zoonk.android.feature.savedlessons

import com.zoonk.android.data.ANA
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.value
import com.zoonk.android.feature.completedlessons.CompletedLessonsQuery
import com.zoonk.android.feature.completedlessons.CompletedLessonsStore
import com.zoonk.api.ApiJson
import com.zoonk.api.models.CompletedLessonList
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test
import java.util.UUID

@OptIn(ExperimentalCoroutinesApi::class)
class SavedLessonsStoreTest {
    private val dispatcher = StandardTestDispatcher()
    private val goalId = UUID.fromString("00000000-0000-4000-8000-0000000000a1")
    private val lessonId = UUID.fromString("00000000-0000-4000-8000-000000000001")
    private val api = FakeSavedLessonsApi()
    private var completedReads = 0

    private fun completed(): CompletedLessonList {
        completedReads++
        return ApiJson.decodeFromString(
            CompletedLessonList.serializer(),
            """{"data":[{"chapterTitle":"Cells","finishedOn":"2026-11-01","group":null,"lessonId":"$lessonId","saved":false,"title":"Lesson"}],
            "filter":null,"pagination":{"hasMore":false,"nextCursor":null}}""",
        )
    }

    private fun TestScope.stores(): Pair<SavedLessonsStore, CompletedLessonsStore> {
        val session = FakeSession(AuthenticatedSession(ANA, "token", "local"))
        val cache = AppCache(session, CoroutineScope(SupervisorJob() + dispatcher))
        val completed = CompletedLessonsStore({ _, _, _ -> completed() }, cache, session)
        return SavedLessonsStore(api, cache, completed) to completed
    }

    @Test
    fun aSaveShowsOnEveryCompletedListWithoutReadingItsPagesAgainAndTheSavedListReadsAgain() =
        runTest(dispatcher) {
            val (saved, completed) = stores()
            val shown =
                launch {
                    launch { completed.lessons[CompletedLessonsQuery(goalId)].shown.collect {} }
                    saved.list[goalId].shown.collect {}
                }
            advanceUntilIdle()
            val reads = completedReads to api.reads

            val result = saved.save(goalId, lessonId, saved = true)
            advanceUntilIdle()

            assertEquals(MutationResult.Done(true), result)
            assertEquals(
                true,
                completed.lessons[CompletedLessonsQuery(goalId)]
                    .state.value.value
                    ?.`data`
                    ?.single()
                    ?.saved,
            )
            assertEquals(reads.first to reads.second + 1, completedReads to api.reads)
            assertEquals(
                listOf(lessonId),
                saved.list[goalId]
                    .state.value.value
                    ?.lessons
                    ?.map { it.lessonId },
            )
            shown.cancel()
        }
}
