package com.zoonk.android.feature.session

import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.navigation.AppRoute
import com.zoonk.api.models.Milestone
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
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

    private fun TestScope.viewModel(api: FakeStudyApi): SessionViewModel {
        val scope = CoroutineScope(SupervisorJob() + dispatcher)
        val cache = AppCache(FakeSession(ana), scope)
        return SessionViewModel(StudyOpener(api, api::writeLesson, cache, { "UTC" }, scope), StudySessionStore(api, cache) { "UTC" })
    }

    private fun TestScope.routes(viewModel: SessionViewModel): List<AppRoute> {
        val routes = mutableListOf<AppRoute>()
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { viewModel.routes.toList(routes) }
        return routes
    }

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
            val routes = routes(viewModel)

            viewModel.readUnfinished(SESSION)
            viewModel.readUnfinished(SESSION)
            advanceUntilIdle()

            assertEquals(1, api.sessionReads)
            assertEquals(1, api.summaryReads)
            assertEquals(listOf(AppRoute.Today), routes)
        }

    @Test
    fun anUnfinishedSummaryWhoseDayGainedANextStepStaysToShowIt() =
        runTest(dispatcher) {
            val api = FakeStudyApi()
            api.session = decodeFixture("study-session", "id" to SESSION.toString(), "nextBlockId" to blockId(1).toString())
            api.studySummary = decodeFixture("study-session-summary", "finished" to false)
            val viewModel = viewModel(api)
            val routes = routes(viewModel)

            viewModel.readUnfinished(SESSION)
            advanceUntilIdle()

            assertEquals(emptyList<AppRoute>(), routes)
        }

    private companion object {
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
