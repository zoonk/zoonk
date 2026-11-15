package com.zoonk.android.feature.today

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.focustest.FocusTestStore
import com.zoonk.android.feature.plan.FakePlanApi
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.feature.session.FakeStudyApi
import com.zoonk.android.feature.session.StudyOpener
import com.zoonk.android.feature.session.StudySessionStore
import com.zoonk.android.feature.session.day
import com.zoonk.android.feature.session.decodeFixture
import com.zoonk.api.models.MemoryInsight
import com.zoonk.api.models.Today
import com.zoonk.api.models.TodayFocusTest
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import java.util.UUID

/**
 * A write Today asked for says how it went only on the visit that asked: one that fails after the learner left says
 * nothing on return, and one already shown is gone once they leave and come back.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class TodayVisitFailureTest {
    private val dispatcher = StandardTestDispatcher()
    private val todayApi = FakeTodayApi(listOf(decodeFixture<Today>("today")))
    private val study = FakeStudyApi()
    private val read = TodayRead.Day(decodeFixture<Today>("today"), day())
    private val failure = ApiException(ApiError.Network)
    private val held = CompletableDeferred<Unit>()
    private var focusTestFails = false

    @Before
    fun main() = Dispatchers.setMain(dispatcher)

    @After
    fun reset() = Dispatchers.resetMain()

    private fun TestScope.today(): TodayViewModel {
        val cache = AppCache(FakeSession(AuthenticatedSession("ana", "token-a", "local-a")), CoroutineScope(SupervisorJob() + dispatcher))
        val focusTests =
            FocusTestStore(
                api = { _, _, _ ->
                    held.await()
                    if (focusTestFails) throw failure
                    error("Not used")
                },
                cache = cache,
                sessions = StudySessionStore(FakeStudyApi(), cache) { "UTC" },
                summary = cache.resource(Audience.SignedIn, emptySet()) { null },
                timeZone = { "UTC" },
            )
        return TodayViewModel(
            StudyOpener(study, study::writeLesson, cache, timeZone = { "UTC" }),
            TodayStore(todayApi, cache, backgroundScope, timeZone = { "UTC" }),
            PlanStore(FakePlanApi(), cache),
            focusTests,
        )
    }

    /** [ask] once with its write held; the learner leaves before it fails ([leaveFirst]) or after it shows, then comes back. */
    private fun visit(
        leaveFirst: Boolean,
        ask: TodayViewModel.() -> Unit,
        shown: TodayViewModel.() -> Any?,
    ) = runTest(dispatcher) {
        val viewModel = today()
        viewModel.ask()
        runCurrent()
        if (leaveFirst) {
            viewModel.endVisit()
            held.complete(Unit)
            advanceUntilIdle()
        } else {
            held.complete(Unit)
            advanceUntilIdle()
            assertNotNull("the failure shows on the visit that asked", viewModel.shown())
            viewModel.endVisit()
        }
        assertNull(viewModel.shown())
    }

    private fun resume(leaveFirst: Boolean) {
        todayApi.resumeGate = held
        todayApi.resumeFailure = failure
        visit(leaveFirst, { resume(GOAL) }) { resumeFailure }
    }

    private fun catchUp(leaveFirst: Boolean) {
        study.catchUpGate = held
        study.catchUpFailure = failure
        visit(leaveFirst, { catchUp(read) }) { catchUpFailed.takeIf { it } }
    }

    private fun focusTest(leaveFirst: Boolean) {
        focusTestFails = true
        visit(leaveFirst, { dismissFocusTest(read, TodayFocusTest(minutes = 10)) }) { focusTestFailedOn }
    }

    private fun insight(leaveFirst: Boolean) {
        todayApi.insightGate = held
        todayApi.insightFailure = failure
        val insight = decodeFixture<MemoryInsight>("memory-insight", "id" to INSIGHT.toString(), "status" to "pending")
        visit(leaveFirst, { answerInsight(insight, accepted = false) }) { insightAnswers[INSIGHT] }
    }

    @Test
    fun aResumeThatFailsAfterTheLearnerLeftSaysNothingOnReturn() = resume(leaveFirst = true)

    @Test
    fun aResumeFailureShownBeforeTheLearnerLeftIsGoneOnReturn() = resume(leaveFirst = false)

    @Test
    fun aCatchUpThatFailsAfterTheLearnerLeftSaysNothingOnReturn() = catchUp(leaveFirst = true)

    @Test
    fun aCatchUpFailureShownBeforeTheLearnerLeftIsGoneOnReturn() = catchUp(leaveFirst = false)

    @Test
    fun aFocusTestNotNowThatFailsAfterTheLearnerLeftSaysNothingOnReturn() = focusTest(leaveFirst = true)

    @Test
    fun aFocusTestNotNowFailureShownBeforeTheLearnerLeftIsGoneOnReturn() = focusTest(leaveFirst = false)

    @Test
    fun anInsightAnswerThatFailsAfterTheLearnerLeftSaysNothingOnReturn() = insight(leaveFirst = true)

    @Test
    fun anInsightAnswerFailureShownBeforeTheLearnerLeftIsGoneOnReturn() = insight(leaveFirst = false)

    private companion object {
        val GOAL: UUID = UUID.fromString("5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2d00")
        val INSIGHT: UUID = UUID.fromString("5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2d91")
    }
}
