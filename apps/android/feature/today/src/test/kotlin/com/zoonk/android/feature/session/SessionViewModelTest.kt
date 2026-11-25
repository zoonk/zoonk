package com.zoonk.android.feature.session

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.GenerationEvent
import com.zoonk.android.data.GenerationSource
import com.zoonk.android.navigation.AppRoute
import com.zoonk.api.models.Generation
import com.zoonk.api.models.LessonGenerationStatus
import com.zoonk.api.models.LessonReadiness
import com.zoonk.api.models.Milestone
import com.zoonk.api.models.StudyBlockLesson
import com.zoonk.api.models.StudyBlockOpeningTarget
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.IOException
import java.util.UUID
import kotlin.time.Instant

@OptIn(ExperimentalCoroutinesApi::class)
class SessionViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val ana = AuthenticatedSession("ana", "token-a", "local-a")

    @Before
    fun main() = Dispatchers.setMain(dispatcher)

    @After
    fun reset() = Dispatchers.resetMain()

    private fun TestScope.viewModel(
        api: FakeStudyApi,
        generations: GenerationSource? = null,
        readiness: suspend (AuthenticatedSession, UUID) -> LessonReadiness = { _, _ -> error("Not used") },
    ): SessionViewModel {
        val scope = CoroutineScope(SupervisorJob() + dispatcher)
        val cache = AppCache(FakeSession(ana), scope)
        return SessionViewModel(
            StudyOpener(api, api::writeLesson, cache, { "UTC" }),
            StudySessionStore(api, cache) { "UTC" },
            cache,
            readiness = readiness,
            generations = { generations ?: error("Not used") },
        )
    }

    /** The route the screen owes its visit, which `SessionScreen` opens and then acknowledges. */
    private fun owed(viewModel: SessionViewModel): List<AppRoute> = listOfNotNull(viewModel.route.value)

    @Test
    fun aCeremonyStaysFromWhenItShowsUntilItsClosedThoughShowingItLeftItOutOfTheNextRead() =
        runTest(dispatcher) {
            val viewModel = viewModel(FakeStudyApi())

            assertEquals(BELT, viewModel.ceremony(BELT))
            viewModel.holdCeremony(BELT)

            // A rotation draws the screen again from a summary read after the ceremony was marked shown.
            assertEquals(BELT, viewModel.ceremony(null))

            viewModel.closeCeremony()
            assertEquals(null, viewModel.ceremony(null))
            assertEquals(null, viewModel.ceremony(BELT))
            viewModel.holdCeremony(BELT)
            assertEquals(null, viewModel.ceremony(BELT))
        }

    @Test
    fun anUnfinishedSummaryReadsTheDayAndItselfAgainOnceThenGoesToTodayWhenNothingIsNext() =
        runTest(dispatcher) {
            val api = FakeStudyApi()
            api.session = decodeFixture("study-session", "id" to SESSION.toString(), "nextBlockId" to null)
            api.studySummary = decodeFixture("study-session-summary", "finished" to false)
            val viewModel = viewModel(api)

            viewModel.readUnfinished(SESSION)
            viewModel.readUnfinished(SESSION)
            advanceUntilIdle()

            assertEquals(1, api.sessionReads)
            assertEquals(1, api.summaryReads)
            assertEquals(listOf(AppRoute.Today), owed(viewModel))
        }

    @Test
    fun anUnfinishedSummaryWhoseDayGainedANextStepStaysToShowIt() =
        runTest(dispatcher) {
            val api = FakeStudyApi()
            api.session = decodeFixture("study-session", "id" to SESSION.toString(), "nextBlockId" to blockId(1).toString())
            api.studySummary = decodeFixture("study-session-summary", "finished" to false)
            val viewModel = viewModel(api)

            viewModel.readUnfinished(SESSION)
            advanceUntilIdle()

            assertEquals(1, api.sessionReads)
            assertEquals(1, api.summaryReads)
            assertEquals(emptyList<AppRoute>(), owed(viewModel))
        }

    @Test
    fun aSummaryClaimRetriesWithItsOriginalIdAndKeepsItsAnswerThroughRecreation() =
        runTest(dispatcher) {
            val api = FakeStudyApi().apply { failures += ApiException(ApiError.Network) }
            val viewModel = viewModel(api)
            val visitId = UUID.randomUUID()

            viewModel.recordSummaryVisit(SESSION, visitId, requested = false)
            advanceUntilIdle()
            assertEquals(SummaryVisit.Failed, viewModel.summaryVisit)

            viewModel.recordSummaryVisit(SESSION, visitId, requested = false)
            viewModel.recordSummaryVisit(SESSION, visitId, requested = false)
            advanceUntilIdle()
            viewModel.recordSummaryVisit(SESSION, visitId, requested = false)
            advanceUntilIdle()

            assertEquals(listOf(visitId, visitId), api.summaryVisits)
            assertEquals(SummaryVisit.First, viewModel.summaryVisit)
            assertEquals(null, viewModel.summaryExit.value)
        }

    @Test
    fun aRepeatSummaryOnlyReturnsToTodayWhenItOpenedAutomatically() =
        runTest(dispatcher) {
            val api = FakeStudyApi()
            val viewModel = viewModel(api)
            val firstVisit = UUID.randomUUID()
            val afterStudying = UUID.randomUUID()
            val requested = UUID.randomUUID()

            viewModel.recordSummaryVisit(SESSION, firstVisit, requested = false)
            advanceUntilIdle()
            assertEquals(SummaryVisit.First, viewModel.summaryVisit)

            viewModel.summaryOpening.end()
            api.firstSummaryVisit = false
            viewModel.recordSummaryVisit(SESSION, afterStudying, requested = false)
            advanceUntilIdle()
            assertEquals(SummaryExit.Repeat, viewModel.summaryExit.value)

            viewModel.summaryOpening.end()
            viewModel.recordSummaryVisit(SESSION, requested, requested = true)
            advanceUntilIdle()
            assertEquals(SummaryVisit.Repeat, viewModel.summaryVisit)
            assertEquals(null, viewModel.summaryExit.value)
            assertEquals(listOf(firstVisit, afterStudying, requested), api.summaryVisits)
        }

    @Test
    fun aSummaryClaimThatAnswersAfterLeavingCannotSendTheLearnerToToday() =
        runTest(dispatcher) {
            val gate = CompletableDeferred<Unit>()
            val api =
                FakeStudyApi().apply {
                    firstSummaryVisit = false
                    summaryVisitGate = gate
                }
            val viewModel = viewModel(api)

            viewModel.recordSummaryVisit(SESSION, UUID.randomUUID(), requested = false)
            runCurrent()
            assertEquals(1, api.summaryVisits.size)
            viewModel.summaryOpening.end()
            gate.complete(Unit)
            advanceUntilIdle()

            assertEquals(null, viewModel.summaryVisit)
            assertEquals(null, viewModel.summaryExit.value)
        }

    @Test
    fun aSummaryThatIsNoLongerReadyReturnsToToday() =
        runTest(dispatcher) {
            val api = FakeStudyApi().apply { failures += ApiException(ApiError.Unavailable, "STUDY_SUMMARY_NOT_READY", 409) }
            val viewModel = viewModel(api)

            viewModel.recordSummaryVisit(SESSION, UUID.randomUUID(), requested = false)
            advanceUntilIdle()

            assertEquals(SummaryExit.DayChanged, viewModel.summaryExit.value)
        }

    @Test
    fun startOnASavedDayOpensTheShownStepItselfSinceTheLearnerMayHaveAskedForIt() =
        runTest(dispatcher) {
            val api = FakeStudyApi()
            val viewModel = viewModel(api)
            val asked = step(1)

            viewModel.start(day(listOf(step(0), asked)), asked, GOAL)
            advanceUntilIdle()

            assertEquals(listOf(blockId(1)), api.targets.map { (it as StudyBlockOpeningTarget.BlockWrapper).value.blockId })
        }

    private fun opensALesson(api: FakeStudyApi) {
        api.openings = listOf(opening("lesson", "lessonId" to step(1).lessonId.toString(), "sessionId" to SESSION.toString()))
    }

    @Test
    fun aStartThatLandsWhileTheScreenIsRecreatedOpensItsStepOnce() =
        runTest(dispatcher) {
            val api = FakeStudyApi().also(::opensALesson)
            val viewModel = viewModel(api)

            // A recreation: no screen acts while the step opens; the next one does.
            viewModel.start(day(listOf(step(0), step(1))), step(1), GOAL)
            advanceUntilIdle()

            assertEquals(1, owed(viewModel).size)
        }

    @Test
    fun aStartThatLandedBeforeTheScreenActedAndThenLeftOpensNothingOnReturn() =
        runTest(dispatcher) {
            val api = FakeStudyApi().also(::opensALesson)
            val viewModel = viewModel(api)

            viewModel.start(day(listOf(step(0), step(1))), step(1), GOAL)
            advanceUntilIdle()
            viewModel.visit.end()

            assertEquals(emptyList<AppRoute>(), owed(viewModel))
        }

    @Test
    fun aStartThatFailsAfterTheLearnerLeftSaysNothingOnReturn() =
        runTest(dispatcher) {
            val api = FakeStudyApi().apply { failures += ApiException(ApiError.Network) }
            val viewModel = viewModel(api)

            viewModel.start(day(listOf(step(0), step(1))), step(1), GOAL)
            viewModel.visit.end()
            advanceUntilIdle()

            assertEquals(null, viewModel.failed)
        }

    @Test
    fun aStartThatFailsWhileTheScreenIsRecreatedSaysSo() =
        runTest(dispatcher) {
            val api = FakeStudyApi().apply { failures += ApiException(ApiError.Network) }
            val viewModel = viewModel(api)

            viewModel.start(day(listOf(step(0), step(1))), step(1), GOAL)
            advanceUntilIdle()

            assertTrue(viewModel.failed != null)
        }

    @Test
    fun aFailedLessonIsReadForAsLongAsItsWaitShowsSinceItMayBeWrittenAgainElsewhere() =
        runTest(dispatcher) {
            var reads = 0
            val viewModel = viewModel(FakeStudyApi()) { _, _ -> reads++.let { readiness(LessonReadiness.Status.FAILED) } }

            val following = backgroundScope.launch { viewModel.followLesson(LESSON, null) {} }
            advanceTimeBy(30 * 60_000L)

            assertTrue(following.isActive)
            assertTrue("read $reads times", reads > 300)
        }

    @Test
    fun aReadTheServerCouldntAnswerKeepsTheLessonAsShownAndAsksAgain() =
        runTest(dispatcher) {
            var reads = 0
            var dayReads = 0
            val writing = StudyBlockLesson(setAside = false, status = LessonGenerationStatus.GENERATING)
            val viewModel =
                viewModel(FakeStudyApi()) { _, _ ->
                    if (reads++ == 0) throw ApiException(ApiError.Unavailable, "SERVICE_UNAVAILABLE", 503)
                    readiness(LessonReadiness.Status.FAILED)
                }

            backgroundScope.launch { viewModel.followLesson(LESSON, writing) { dayReads++ } }
            runCurrent()

            assertEquals(null, viewModel.lesson)
            assertEquals(0, dayReads)

            advanceTimeBy(LESSON_CHECK_MILLIS + 1)

            assertEquals(LessonReadiness.Status.FAILED, viewModel.lesson?.status)
            assertEquals(1, dayReads)
        }

    @Test
    fun aRunWhoseUpdatesStopAsksTheLessonsReadinessAtOnceWhichDecides() =
        runTest(dispatcher) {
            var reads = 0
            val lost =
                object : GenerationSource {
                    override fun events(id: String): Flow<GenerationEvent> = flow { throw IOException("Offline") }

                    override suspend fun status(id: String) = Generation.Status.RUNNING
                }
            val writing = StudyBlockLesson(setAside = false, status = LessonGenerationStatus.GENERATING)
            val viewModel =
                viewModel(FakeStudyApi(), generations = lost) { _, _ ->
                    readiness(if (reads++ == 0) LessonReadiness.Status.GENERATING else LessonReadiness.Status.FAILED)
                }

            backgroundScope.launch { viewModel.followLesson(LESSON, writing) {} }
            advanceTimeBy(LESSON_CHECK_MILLIS / 2)

            assertEquals(2, reads)
            assertEquals(LessonReadiness.Status.FAILED, viewModel.lesson?.status)
        }

    private fun readiness(status: LessonReadiness.Status) =
        LessonReadiness(
            alternative = null,
            generationId = "run-1".takeIf { status == LessonReadiness.Status.GENERATING },
            kind = LessonReadiness.Kind.LESSON,
            setAside = false,
            status = status,
            warmUpId = null,
        )

    private companion object {
        val LESSON: UUID = UUID.fromString("00000000-0000-4000-8000-0000000000a1")

        val BELT =
            Milestone(
                beltStartBrainPower = 500,
                earnedAt = Instant.parse("2026-10-29T12:00:00Z"),
                id = UUID.fromString("00000000-0000-4000-8000-0000000000c1"),
                key = "yellow",
                kind = Milestone.Kind.BELT,
                shownAt = null,
            )
    }
}
