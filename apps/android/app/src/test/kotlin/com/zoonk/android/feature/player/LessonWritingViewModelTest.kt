package com.zoonk.android.feature.player

import com.zoonk.android.data.ANA
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.GenerationEvent
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.GenerationSource
import com.zoonk.android.feature.player.engine.LessonRefusal
import com.zoonk.android.feature.player.model.LessonLoad
import com.zoonk.android.feature.player.model.LessonOutline
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LimitPeriod
import com.zoonk.android.ui.components.LimitTier
import com.zoonk.api.models.Generation
import com.zoonk.api.models.LessonGeneration
import kotlinx.coroutines.CompletableDeferred
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
import kotlinx.coroutines.test.runCurrent
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
    private val bia = AuthenticatedSession("bia", "token-b", "local-b")
    private val session = FakeSession(ana)
    private val api = FakeLessonPlayerApi(LessonLoad.NotGenerated(LessonOutline(LESSON_ID, "Clouds", "Why they float.", 5)))
    private val events = mutableListOf<GenerationEvent>()
    private val waits = mutableListOf<Pair<AuthenticatedSession, Long>>()

    @Before
    fun main() = Dispatchers.setMain(dispatcher)

    @After
    fun reset() = Dispatchers.resetMain()

    private fun TestScope.writing(): LessonWritingViewModel {
        val cache = AppCache(session, CoroutineScope(SupervisorJob() + dispatcher))
        val generations =
            object : GenerationSource {
                override fun events(id: String): Flow<GenerationEvent> = flowOf(*events.toTypedArray())

                override suspend fun status(id: String) = Generation.Status.COMPLETED
            }
        return LessonWritingViewModel(
            LESSON_ID,
            LessonPlayerStore(api, cache),
            { session, milliseconds -> waits += session to milliseconds },
            { generations },
            cache,
            session,
        ) { testScheduler.currentTime }
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
    fun theTapWritesItFollowsItsRunAndRecordsTheWaitOnceWhenReady() =
        runTest(dispatcher) {
            api.readinessStates += "notStarted"
            events +=
                listOf(
                    GenerationEvent(status = "completed", step = "planLesson"),
                    GenerationEvent(status = "started", step = "writeLesson"),
                    GenerationEvent(status = "completed", step = "lessonReady"),
                )
            val writing = writing()

            writing.open()
            advanceUntilIdle()
            writing.start()
            advanceUntilIdle()

            assertEquals(1, api.writes)
            assertEquals(LessonWriting.Writing, writing.writing.value)
            assertEquals(GenerationRun.Status.Ready, writing.run.value.status)

            writing.recordWait()
            writing.recordWait()
            advanceUntilIdle()
            assertEquals(1, waits.size)
        }

    @Test
    fun aRunAlreadyWritingItIsFollowedWithoutAnotherWrite() =
        runTest(dispatcher) {
            api.readinessStates += "generating"
            events += GenerationEvent(status = "completed", step = "lessonReady")
            val writing = writing()

            writing.open()
            advanceUntilIdle()

            assertEquals(0, api.writes)
            assertEquals(GenerationRun.Status.Ready, writing.run.value.status)
        }

    @Test
    fun aFreeLearnerOutOfLessonsIsToldWhyAndASetAsideLessonSaysSo() =
        runTest(dispatcher) {
            api.readinessStates += listOf("notStarted", "notStarted")
            val limit = Json.parseToJsonElement("""{"limit":{"tier":"free","period":"month"}}""")
            api.writeResponse = { throw ApiException(ApiError.Unavailable, "USAGE_LIMIT_REACHED", 402, limit) }
            val writing = writing()

            writing.open()
            advanceUntilIdle()
            writing.start()
            advanceUntilIdle()
            assertEquals(
                LessonWriting.Refused(LessonRefusal.Limited(Limit.Reached(LimitTier.Free, LimitPeriod.Month))),
                writing.writing.value,
            )

            api.writeResponse = { throw ApiException(ApiError.Unavailable, "LESSON_SET_ASIDE", 409) }
            val setAside = writing()
            setAside.open()
            advanceUntilIdle()
            setAside.start()
            advanceUntilIdle()
            assertEquals(LessonWriting.SetAside, setAside.writing.value)
        }

    @Test
    fun aSlowDownCanBeTriedAgainOnceItsWaitIsOver() =
        runTest(dispatcher) {
            api.readinessStates += "notStarted"
            val slowDown = Json.parseToJsonElement("""{"retryAfterSeconds":30}""")
            api.writeResponse = { throw ApiException(ApiError.Unavailable, "SLOW_DOWN", 429, slowDown) }
            val writing = writing()

            writing.open()
            advanceUntilIdle()
            writing.start()
            advanceUntilIdle()
            assert(writing.writing.value is LessonWriting.Refused)

            api.writeResponse =
                { Json.decodeFromString(LessonGeneration.serializer(), """{"generationId":"gen-1","status":"generating"}""") }
            writing.start()
            advanceUntilIdle()
            assertEquals(2, api.writes)
            assertEquals(LessonWriting.Writing, writing.writing.value)
        }

    @Test
    fun aWriteAnsweredAfterAnotherLearnerSignedInIsDropped() =
        runTest(dispatcher) {
            api.readinessStates += listOf("notStarted", "notStarted")
            val answer = CompletableDeferred<LessonGeneration>()
            api.writeResponse = { answer.await() }
            val writing = writing()

            writing.open()
            advanceUntilIdle()
            writing.start()
            runCurrent()

            session.session = bia
            writing.open()
            answer.complete(Json.decodeFromString(LessonGeneration.serializer(), """{"generationId":"gen-1","status":"generating"}"""))
            advanceUntilIdle()

            assertEquals(LessonWriting.NotStarted, writing.writing.value)
            assertEquals(GenerationRun.Status.Waiting, writing.run.value.status)
        }
}
