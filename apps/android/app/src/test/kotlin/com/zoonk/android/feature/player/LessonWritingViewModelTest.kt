package com.zoonk.android.feature.player

import com.zoonk.android.data.ANA
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.player.engine.LessonRefusal
import com.zoonk.android.feature.player.engine.RefusalPeriod
import com.zoonk.android.feature.player.engine.RefusalTier
import com.zoonk.android.feature.player.model.LessonLoad
import com.zoonk.android.feature.player.model.LessonOutline
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlinx.serialization.json.Json
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class LessonWritingViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val ana = AuthenticatedSession(ANA, "token", "local")
    private val api = FakeLessonPlayerApi(LessonLoad.NotGenerated(LessonOutline(LESSON_ID, "Clouds", "Why they float.", 5)))
    private val events = mutableListOf<WritingEvent>()
    private val waits = mutableListOf<Long>()
    private var readyReads = 0

    @Before
    fun main() = Dispatchers.setMain(dispatcher)

    @After
    fun reset() = Dispatchers.resetMain()

    private fun TestScope.writing(): LessonWritingViewModel {
        val session = FakeSession(ana)
        val cache = AppCache(session, CoroutineScope(SupervisorJob() + dispatcher))
        val writingApi =
            object : LessonWritingApi {
                override fun events(
                    generationId: String,
                    session: AuthenticatedSession,
                ): Flow<WritingEvent> = flowOf(*events.toTypedArray())

                override suspend fun recordWait(
                    session: AuthenticatedSession,
                    milliseconds: Long,
                ) {
                    waits += milliseconds
                }
            }
        return LessonWritingViewModel(LESSON_ID, LessonPlayerStore(api, cache), writingApi, cache, session, {
            readyReads++
        }, { testScheduler.currentTime })
    }

    @Test
    fun openingALessonNotWrittenYetWritesNothingUntilTheLearnerTaps() =
        runTest(dispatcher) {
            api.readinessStates += "notStarted"
            val writing = writing()

            writing.open()
            advanceUntilIdle()

            assertEquals(LessonWriting.NotStarted, writing.writing.value)
            assertEquals(0, api.writes)
        }

    @Test
    fun theTapWritesItFollowsItsPhasesAndOpensItWhenReady() =
        runTest(dispatcher) {
            api.readinessStates += listOf("notStarted", "ready")
            events += listOf(WritingEvent("planLesson", "completed"), WritingEvent("writeLesson", "started"))
            val writing = writing()

            writing.open()
            advanceUntilIdle()
            writing.start()
            advanceUntilIdle()

            assertEquals(1, api.writes)
            assertEquals(1, readyReads)
            assertEquals(1, waits.size)
        }

    @Test
    fun aRunAlreadyWritingItIsFollowedWithoutAnotherWrite() =
        runTest(dispatcher) {
            api.readinessStates += listOf("generating", "generating", "ready")
            val writing = writing()

            writing.open()
            advanceUntilIdle()

            assertEquals(0, api.writes)
            assertEquals(1, readyReads)
        }

    @Test
    fun aFreeLearnerOutOfLessonsIsToldWhyAndAFailedRunCanBeTriedAgain() =
        runTest(dispatcher) {
            api.readinessStates += listOf("notStarted", "failed", "notStarted")
            val limit = Json.parseToJsonElement("""{"limit":{"tier":"free","period":"month"}}""")
            api.writeResponse = { throw ApiException(ApiError.Unavailable, "USAGE_LIMIT_REACHED", 402, limit) }
            val writing = writing()

            writing.open()
            advanceUntilIdle()
            writing.start()
            advanceUntilIdle()
            assertEquals(LessonWriting.Refused(LessonRefusal.LimitReached(RefusalTier.Free, RefusalPeriod.Month)), writing.writing.value)

            api.writeResponse = { throw ApiException(ApiError.Unavailable, "LESSON_SET_ASIDE", 409) }
            val setAside = writing()
            setAside.open()
            advanceUntilIdle()
            setAside.start()
            advanceUntilIdle()
            assertEquals(LessonWriting.SetAside, setAside.writing.value)
        }
}
