package com.zoonk.android.feature.savedlessons

import com.zoonk.android.data.ANA
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.Visit
import com.zoonk.android.data.value
import com.zoonk.android.feature.completedlessons.CompletedLessonsQuery
import com.zoonk.android.feature.completedlessons.CompletedLessonsStore
import com.zoonk.api.ApiJson
import com.zoonk.api.models.CompletedLessonList
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
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
    private var completedGate: CompletableDeferred<Unit>? = null

    private suspend fun completed(): CompletedLessonList {
        completedReads++
        val saved = api.lessons.any { it.lessonId == lessonId }
        completedGate?.also { completedGate = null }?.await()
        return ApiJson.decodeFromString(
            CompletedLessonList.serializer(),
            """{"data":[{"available":true,"chapterTitle":"Cells","finishedOn":"2026-11-01","group":null,"lessonId":"$lessonId","saved":$saved,"title":"Lesson"}],
            "filter":null,"pagination":{"hasMore":false,"nextCursor":null}}""",
        )
    }

    private fun TestScope.stores(): Pair<SavedLessonsStore, CompletedLessonsStore> {
        val session = FakeSession(AuthenticatedSession(ANA, "token", "local"))
        val cache = AppCache(session, CoroutineScope(SupervisorJob() + dispatcher))
        val completed = CompletedLessonsStore({ _, _, _, _ -> completed() }, cache, session)
        return SavedLessonsStore(api, cache, completed) to completed
    }

    private fun CompletedLessonsStore.savedShown() =
        lessons[CompletedLessonsQuery(goalId)]
            .state.value.value
            ?.`data`
            ?.single()
            ?.saved

    @Test
    fun aCompletedListReadSentBeforeASaveTheServerTookIsReadAgain() =
        runTest(dispatcher) {
            val (saved, completed) = stores()
            completedGate = CompletableDeferred()
            val read = launch { completed.lessons[CompletedLessonsQuery(goalId)].load() }
            advanceUntilIdle()
            assertEquals(1, completedReads)

            saved.save(goalId, lessonId, saved = true)
            advanceUntilIdle()
            read.join()

            assertEquals(true, completed.savedShown())
        }

    @Test
    fun aRunStartedBeforeASaveTheServerTookNeverUndoesIt() =
        runTest(dispatcher) {
            val (saved, _) = stores()

            val started = saved.runStarting(lessonId)
            saved.save(goalId, lessonId, saved = true)
            advanceUntilIdle()

            assertEquals(true, started(false))
            assertEquals(false, saved.runStarting(lessonId)(false))
        }

    @Test
    fun aSaveAskedOnAScreenThatWentStillReachesTheServerAndEveryListReadsIt() =
        runTest(dispatcher) {
            val (saved, _) = stores()
            val shown = launch { saved.list[goalId].shown.collect {} }
            advanceUntilIdle()
            val reads = api.reads
            val screen = CoroutineScope(SupervisorJob() + dispatcher)
            val hold = CompletableDeferred<Unit>().also { api.hold = it }

            saved.saves(screen, Visit(), goalId).set(lessonId, true)
            advanceUntilIdle()
            screen.cancel()
            hold.complete(Unit)
            advanceUntilIdle()

            assertEquals(
                listOf(lessonId),
                saved.list[goalId]
                    .state.value.value
                    ?.lessons
                    ?.map { it.lessonId },
            )
            assertEquals(reads + 1, api.reads)
            shown.cancel()
        }

    @Test
    fun aSaveShowsOnEveryCompletedListAtOnceAndTheListsShownReadAgain() =
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
            assertEquals(reads.first + 1 to reads.second + 1, completedReads to api.reads)
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
