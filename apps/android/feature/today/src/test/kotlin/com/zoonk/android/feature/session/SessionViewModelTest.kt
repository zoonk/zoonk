package com.zoonk.android.feature.session

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.navigation.AppRoute
import com.zoonk.api.models.LessonReadiness
import com.zoonk.api.models.Milestone
import com.zoonk.api.models.StudyBlockOpeningTarget
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
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
        readiness: suspend (AuthenticatedSession, UUID) -> LessonReadiness = { _, _ -> error("Not used") },
    ): SessionViewModel {
        val scope = CoroutineScope(SupervisorJob() + dispatcher)
        val cache = AppCache(FakeSession(ana), scope)
        return SessionViewModel(
            StudyOpener(api, api::writeLesson, cache, { "UTC" }),
            StudySessionStore(api, cache) { "UTC" },
            cache,
            readiness = readiness,
            generations = { error("Not used") },
            now = { testScheduler.currentTime },
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
            viewModel.endVisit()

            assertEquals(emptyList<AppRoute>(), owed(viewModel))
        }

    @Test
    fun aStartThatFailsAfterTheLearnerLeftSaysNothingOnReturn() =
        runTest(dispatcher) {
            val api = FakeStudyApi().apply { failures += ApiException(ApiError.Network) }
            val viewModel = viewModel(api)

            viewModel.start(day(listOf(step(0), step(1))), step(1), GOAL)
            viewModel.endVisit()
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
    fun aFailedLessonIsReadForTenMinutesThenLeftToTryAgainEvenWhileReadsFail() =
        runTest(dispatcher) {
            var reads = 0
            val failed =
                LessonReadiness(
                    alternative = null,
                    generationId = null,
                    kind = LessonReadiness.Kind.LESSON,
                    setAside = false,
                    status = LessonReadiness.Status.FAILED,
                    warmUpId = null,
                )
            val viewModel = viewModel(FakeStudyApi()) { _, _ -> if (reads++ == 0) failed else throw IOException("Offline") }

            val following = backgroundScope.launch { viewModel.followLesson(LESSON, asked = false) {} }
            advanceTimeBy(FAILED_LESSON_READ_MILLIS - LESSON_CHECK_MILLIS)
            assertTrue(following.isActive)

            advanceTimeBy(2 * LESSON_CHECK_MILLIS)
            assertTrue(following.isCompleted)
        }

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
