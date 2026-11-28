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
import com.zoonk.android.data.LESSON_CHECK_MILLIS
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
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceTimeBy
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
    private var runStatus = Generation.Status.COMPLETED
    private var following: Job? = null

    @Before
    fun main() = Dispatchers.setMain(dispatcher)

    @After
    fun reset() = Dispatchers.resetMain()

    private fun TestScope.writing(): LessonWritingViewModel {
        val cache = AppCache(session, CoroutineScope(SupervisorJob() + dispatcher))
        val generations =
            object : GenerationSource {
                override fun events(id: String): Flow<GenerationEvent> = flowOf(*events.toTypedArray())

                override suspend fun status(id: String) = runStatus
            }
        return LessonWritingViewModel(
            LESSON_ID,
            LessonPlayerStore(api, cache),
            { generations },
            cache,
            session,
        )
    }

    /** What the screen does while it shows: open for the session, then follow readiness. */
    private fun TestScope.open(writing: LessonWritingViewModel) {
        following?.cancel()
        writing.open()
        following = backgroundScope.launch { writing.followReadiness() }
    }

    /** Runs what's due without reaching the next readiness check. */
    private fun TestScope.settle() {
        advanceTimeBy(1_000)
        runCurrent()
    }

    @Test
    fun openingALessonNotWrittenYetWritesNothingUntilTheLearnerTaps() =
        runTest(dispatcher) {
            api.readinessStates += "notStarted"
            val writing = writing()

            open(writing)
            settle()

            assertEquals(LessonWriting.NotStarted, writing.writing.value)
            assertEquals(0, api.writes)
        }

    @Test
    fun openingALessonWhoseWritingFailedSaysSoAndOneItsChecksSetAsideSaysWhy() =
        runTest(dispatcher) {
            api.readinessStates += "failed"
            val failed = writing()
            open(failed)
            settle()
            assertEquals(LessonWriting.Failed, failed.writing.value)

            api.readinessStates += "failed"
            api.readinessSetAside = true
            val setAside = writing()
            open(setAside)
            settle()
            assertEquals(LessonWriting.SetAside, setAside.writing.value)
            assertEquals(0, api.writes)
        }

    @Test
    fun theTapWritesItAndFollowsItsRun() =
        runTest(dispatcher) {
            api.readinessStates += "notStarted"
            events +=
                listOf(
                    GenerationEvent(status = "completed", step = "planLesson"),
                    GenerationEvent(status = "started", step = "writeLesson"),
                    GenerationEvent(status = "completed", step = "lessonReady"),
                )
            val writing = writing()

            open(writing)
            settle()
            writing.start()
            settle()

            assertEquals(1, api.writes)
            assertEquals(LessonWriting.Writing, writing.writing.value)
            assertEquals(GenerationRun.Status.Ready, writing.run.value.status)
        }

    @Test
    fun aRunAlreadyWritingItIsFollowedWithoutAnotherWrite() =
        runTest(dispatcher) {
            api.readinessStates += "generating"
            events += GenerationEvent(status = "completed", step = "lessonReady")
            val writing = writing()

            open(writing)
            settle()

            assertEquals(0, api.writes)
            assertEquals(GenerationRun.Status.Ready, writing.run.value.status)
        }

    @Test
    fun aFreeLearnerOutOfLessonsIsToldWhyAndASetAsideLessonSaysSo() =
        runTest(dispatcher) {
            api.readinessStates += listOf("notStarted", "notStarted")
            val limit = Json.parseToJsonElement("""{"limit":{"tier":"free","period":"rolling30Days","resource":"lessonStart"}}""")
            api.writeResponse = { throw ApiException(ApiError.Unavailable, "USAGE_LIMIT_REACHED", 402, limit) }
            val writing = writing()

            open(writing)
            settle()
            writing.start()
            settle()
            assertEquals(
                LessonWriting.Refused(LessonRefusal.Limited(Limit.Reached(LimitTier.Free, LimitPeriod.Rolling30Days))),
                writing.writing.value,
            )

            api.writeResponse = { throw ApiException(ApiError.Unavailable, "LESSON_SET_ASIDE", 409) }
            val setAside = writing()
            open(setAside)
            settle()
            setAside.start()
            settle()
            assertEquals(LessonWriting.SetAside, setAside.writing.value)
        }

    @Test
    fun aSlowDownCanBeTriedAgainOnceItsWaitIsOver() =
        runTest(dispatcher) {
            api.readinessStates += "notStarted"
            val slowDown = Json.parseToJsonElement("""{"retryAfterSeconds":30}""")
            api.writeResponse = { throw ApiException(ApiError.Unavailable, "SLOW_DOWN", 429, slowDown) }
            val writing = writing()

            open(writing)
            settle()
            writing.start()
            settle()
            assert(writing.writing.value is LessonWriting.Refused)

            api.writeResponse =
                { Json.decodeFromString(LessonGeneration.serializer(), """{"generationId":"gen-1","status":"generating"}""") }
            writing.start()
            settle()
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

            open(writing)
            settle()
            writing.start()
            runCurrent()

            session.session = bia
            open(writing)
            answer.complete(Json.decodeFromString(LessonGeneration.serializer(), """{"generationId":"gen-1","status":"generating"}"""))
            settle()

            assertEquals(LessonWriting.NotStarted, writing.writing.value)
            assertEquals(GenerationRun.Status.Waiting, writing.run.value.status)
        }

    @Test
    fun aRunThatStopsAsksReadinessAtOnceWhichDecides() =
        runTest(dispatcher) {
            api.readinessStates += listOf("generating", "ready")
            runStatus = Generation.Status.FAILED
            val writing = writing()

            open(writing)
            settle()

            assertEquals(LessonWriting.Ready, writing.writing.value)
            assertEquals(0, api.writes)
        }

    @Test
    fun aFailedLessonKeepsAskingSoAnotherDevicesRetryIsFollowed() =
        runTest(dispatcher) {
            api.readinessStates += "failed"
            events += GenerationEvent(status = "completed", step = "lessonReady")
            val writing = writing()

            open(writing)
            settle()
            assertEquals(LessonWriting.Failed, writing.writing.value)

            api.readinessStates += "generating"
            api.readinessGenerationId = "gen-2"
            advanceTimeBy(LESSON_CHECK_MILLIS)
            runCurrent()

            assertEquals(LessonWriting.Writing, writing.writing.value)
            assertEquals("gen-2", writing.run.value.id)
            assertEquals(GenerationRun.Status.Ready, writing.run.value.status)
            assertEquals(0, api.writes)
        }
}
