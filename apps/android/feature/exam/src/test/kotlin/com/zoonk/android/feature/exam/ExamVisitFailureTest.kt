package com.zoonk.android.feature.exam

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.plan.FakePlanApi
import com.zoonk.android.feature.plan.PlanOp
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.api.models.ExamResult
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import java.time.LocalDate
import java.util.UUID

/** A result or date the exam page didn't save says so only on the visit that asked. */
@OptIn(ExperimentalCoroutinesApi::class)
class ExamVisitFailureTest {
    private val dispatcher = StandardTestDispatcher()
    private val held = CompletableDeferred<Unit>()
    private val goalId = UUID.fromString("5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2d00")
    private val sitting = LocalDate.parse("2027-06-12")
    private val plans = FakePlanApi().apply { changeFailure = ApiException(ApiError.Network) }
    private val exams =
        object : ExamApi by FakeExamApi(null) {
            override suspend fun report(
                session: AuthenticatedSession,
                goalId: UUID,
                report: ExamResultReport,
                timeZone: String,
            ): ExamResult {
                held.await()
                throw ApiException(ApiError.Network)
            }
        }

    @Before
    fun main() = Dispatchers.setMain(dispatcher)

    @After
    fun reset() = Dispatchers.resetMain()

    private fun check(
        leaveFirst: Boolean,
        ask: ExamViewModel.() -> Unit,
        status: ExamViewModel.() -> SaveStatus,
    ) = runTest(dispatcher) {
        plans.gates[PlanOp.TargetDate(sitting)] = held
        val cache = AppCache(FakeSession(AuthenticatedSession("ana", "token-a", "local-a")), CoroutineScope(SupervisorJob() + dispatcher))
        val viewModel = ExamViewModel(ExamStore(exams, cache) { "UTC" }, PlanStore(plans, cache), goalId)

        viewModel.ask()
        runCurrent()
        if (leaveFirst) viewModel.visit.end()
        held.complete(Unit)
        advanceUntilIdle()
        if (!leaveFirst) {
            assertEquals(SaveStatus.Failed, viewModel.status())
            viewModel.visit.end()
        }

        assertEquals(SaveStatus.Idle, viewModel.status())
    }

    private fun report(leaveFirst: Boolean) =
        check(leaveFirst, { report(ExamResultReport(score = null, scale = null, maxScore = null, passed = true)) }) { report }

    private fun date(leaveFirst: Boolean) = check(leaveFirst, { useDate(sitting) }) { date }

    @Test
    fun aResultThatFailsAfterTheLearnerLeftSaysNothingOnReturn() = report(leaveFirst = true)

    @Test
    fun aResultFailureShownBeforeTheLearnerLeftIsGoneOnReturn() = report(leaveFirst = false)

    @Test
    fun aDateThatFailsAfterTheLearnerLeftSaysNothingOnReturn() = date(leaveFirst = true)

    @Test
    fun aDateFailureShownBeforeTheLearnerLeftIsGoneOnReturn() = date(leaveFirst = false)
}
