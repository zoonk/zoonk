package com.zoonk.android.feature.today

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.focustest.unusedFocusTests
import com.zoonk.android.feature.plan.FakePlanApi
import com.zoonk.android.feature.plan.PlanOp
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.feature.session.FakeStudyApi
import com.zoonk.android.feature.session.StudyOpener
import com.zoonk.api.models.LearnerSummaryGoal
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
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.util.UUID

/** After the exam's date, Today's bar answers as the Plan's does: keep studying applies at once, archiving saves the status. */
@OptIn(ExperimentalCoroutinesApi::class)
class TodayExamOverTest {
    private val dispatcher = StandardTestDispatcher()
    private val plans = FakePlanApi()
    private val goalId = UUID.fromString("6f1c2c1e-1b8a-4d8e-9a77-2d8f4b0f1d02")

    @Before
    fun main() = Dispatchers.setMain(dispatcher)

    @After
    fun reset() = Dispatchers.resetMain()

    private fun today(): TodayViewModel {
        val cache = AppCache(FakeSession(AuthenticatedSession("ana", "token-a", "local-a")), CoroutineScope(SupervisorJob() + dispatcher))
        val study = FakeStudyApi()
        return TodayViewModel(
            StudyOpener(study, study::writeLesson, cache, timeZone = { "UTC" }),
            TodayStore(FakeTodayApi(emptyList()), cache, CoroutineScope(SupervisorJob() + dispatcher), timeZone = { "UTC" }),
            PlanStore(plans, cache),
            unusedFocusTests(cache),
        )
    }

    @Test
    fun keepStudyingStudiesEverythingAndStaysBusyUntilTodayShowsTheNewDay() =
        runTest(dispatcher) {
            val viewModel = today()
            var failed = false

            viewModel.keepStudying(goalId) { failed = true }
            advanceUntilIdle()

            assertEquals(listOf(listOf<PlanOp>(PlanOp.FullCourse(true))), plans.changes)
            assertEquals(ExamOverAnswer(goalId, archive = false), viewModel.examOverAnswer)
            assertEquals(false, failed)
        }

    @Test
    fun aFailedArchiveSaysSoAndCanBeAskedAgain() =
        runTest(dispatcher) {
            val viewModel = today()
            var failures = 0
            plans.statusFailure = ApiException(ApiError.Network)

            viewModel.archiveGoal(goalId) { failures++ }
            advanceUntilIdle()

            assertEquals(1, failures)
            assertNull(viewModel.examOverAnswer)

            plans.statusFailure = null
            viewModel.archiveGoal(goalId) { failures++ }
            advanceUntilIdle()

            assertEquals(1, failures)
            assertTrue(LearnerSummaryGoal.Status.ARCHIVED in plans.statuses)
        }
}
