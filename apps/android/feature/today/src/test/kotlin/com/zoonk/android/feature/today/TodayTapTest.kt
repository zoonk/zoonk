package com.zoonk.android.feature.today

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.plan.FakePlanApi
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.feature.session.FakeStudyApi
import com.zoonk.android.feature.session.StudyOpener
import com.zoonk.android.feature.session.day
import com.zoonk.android.feature.session.decodeFixture
import com.zoonk.android.feature.session.step
import com.zoonk.api.models.Today
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class TodayTapTest {
    private val dispatcher = StandardTestDispatcher()
    private val api = FakeStudyApi()
    private val offline = ApiException(ApiError.Network)

    @Before
    fun main() = Dispatchers.setMain(dispatcher)

    @After
    fun reset() = Dispatchers.resetMain()

    private fun today(): TodayViewModel {
        val cache = AppCache(FakeSession(AuthenticatedSession("ana", "token-a", "local-a")), CoroutineScope(SupervisorJob() + dispatcher))
        val store = TodayStore(FakeTodayApi(emptyList()), cache, CoroutineScope(SupervisorJob() + dispatcher), timeZone = { "UTC" })
        return TodayViewModel(StudyOpener(api, api::writeLesson, cache, timeZone = { "UTC" }), store, PlanStore(FakePlanApi(), cache))
    }

    private val read = TodayRead.Day(decodeFixture<Today>("today"), day())

    /** Main shows a mission row's wait and failure on that row, not on the queue row of the same block. */
    @Test
    fun aMissionTapThatFailsSaysSoOnTheMissionNotTheQueueRow() =
        runTest(dispatcher) {
            val viewModel = today()
            api.failures += offline

            viewModel.openMission(read, read.day.steps[1])
            advanceUntilIdle()

            assertNull(viewModel.pending)
            assertEquals(TodayTap.Mission(1), viewModel.failed)
        }

    @Test
    fun aMissionOnADayNotSavedYetStillFailsAsAMissionTap() =
        runTest(dispatcher) {
            val viewModel = today()
            val unsaved = TodayRead.Day(read.today, day(listOf(step(0, saved = false)), saved = false))
            api.failures += offline

            viewModel.openMission(unsaved, unsaved.day.steps[0])
            advanceUntilIdle()

            assertEquals(1, api.opened.size)
            assertEquals(TodayTap.Mission(0), viewModel.failed)
        }

    /** Switching goals or a new day ends the visit, so another goal's row at the same position never shows this one's failure. */
    @Test
    fun aFailureShownOnARowIsGoneOnceTheVisitEnds() =
        runTest(dispatcher) {
            val viewModel = today()
            api.failures += offline

            viewModel.open(read, read.day.steps[1], next = false)
            advanceUntilIdle()
            assertEquals(TodayTap.Step(1), viewModel.failed)

            viewModel.endVisit()

            assertNull(viewModel.failed)
        }

    @Test
    fun aTapThatFailsAfterTheLearnerLeftTodaySaysNothing() =
        runTest(dispatcher) {
            val viewModel = today()
            api.failures += offline

            viewModel.open(read, read.day.steps[1], next = false)
            viewModel.endVisit()
            advanceUntilIdle()

            assertNull(viewModel.pending)
            assertNull(viewModel.failed)
        }
}
