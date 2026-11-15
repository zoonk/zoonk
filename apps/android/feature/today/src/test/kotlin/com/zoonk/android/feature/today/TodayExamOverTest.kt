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
import com.zoonk.android.feature.session.decodeFixture
import com.zoonk.api.models.LearnerSummaryGoal
import com.zoonk.api.models.Today
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.util.UUID

/**
 * After the exam's date, Today's bar answers as the Plan's does: keep studying applies at once, archiving saves the status.
 * A saved answer keeps its button busy until Today's next read, which shows what it did.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class TodayExamOverTest {
    private val dispatcher = StandardTestDispatcher()
    private val plans = FakePlanApi()
    private val goalId = UUID.fromString("5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2d00")

    @Before
    fun main() = Dispatchers.setMain(dispatcher)

    @After
    fun reset() = Dispatchers.resetMain()

    private val cache =
        AppCache(FakeSession(AuthenticatedSession("ana", "token-a", "local-a")), CoroutineScope(SupervisorJob() + dispatcher))
    private val reads = TodayReads()
    private val store = TodayStore(reads, cache, CoroutineScope(SupervisorJob() + dispatcher), timeZone = { "UTC" })

    /** Today's server: the exam-over day until an answer saves, then the day it leads to; a read can fail or wait. */
    private class TodayReads(
        private val api: FakeTodayApi = FakeTodayApi(listOf(EXAM_OVER)),
    ) : TodayApi by api {
        var answer: Today = EXAM_OVER
        var failure: ApiException? = null
        var gate: CompletableDeferred<Unit>? = null

        override suspend fun today(
            session: AuthenticatedSession,
            timeZone: String,
        ): Today {
            val read = answer
            gate?.await()
            failure?.let { throw it }
            return read
        }
    }

    private fun today(): TodayViewModel {
        val study = FakeStudyApi()
        return TodayViewModel(
            StudyOpener(study, study::writeLesson, cache, timeZone = { "UTC" }),
            store,
            PlanStore(plans, cache),
            unusedFocusTests(cache),
        )
    }

    /** Today's exam-over read on screen, as the learner answers it. */
    private suspend fun TestScope.examOverShown(): TodayViewModel {
        val viewModel = today()
        store.today.load()
        advanceUntilIdle()
        return viewModel
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
    fun bothAnswersWorkAgainOnceTodayHasReadTheSavedAnswer() =
        runTest(dispatcher) {
            val viewModel = examOverShown()

            viewModel.keepStudying(goalId) {}
            advanceUntilIdle()
            reads.answer = AFTER_ANSWER
            store.today.refresh()
            advanceUntilIdle()

            assertNull(viewModel.examOverAnswer)

            // Studying past the exam turned off again in the Plan: Today is back on the exam-over day.
            reads.answer = EXAM_OVER
            store.today.refresh()
            advanceUntilIdle()
            viewModel.archiveGoal(goalId) {}
            advanceUntilIdle()

            assertTrue(LearnerSummaryGoal.Status.ARCHIVED in plans.statuses)
        }

    @Test
    fun aReadThatFailsAfterTheSaveKeepsTheAnswerSoTheOldNoticeSendsNothing() =
        runTest(dispatcher) {
            val viewModel = examOverShown()

            viewModel.keepStudying(goalId) {}
            advanceUntilIdle()
            reads.failure = ApiException(ApiError.Network)
            store.today.refresh()
            advanceUntilIdle()
            viewModel.keepStudying(goalId) {}
            advanceUntilIdle()

            assertEquals(ExamOverAnswer(goalId, archive = false), viewModel.examOverAnswer)
            assertEquals(1, plans.changes.size)

            reads.failure = null
            reads.answer = AFTER_ANSWER
            store.today.refresh()
            advanceUntilIdle()

            assertNull(viewModel.examOverAnswer)
        }

    @Test
    fun aReadStartedBeforeTheSaveKeepsTheAnswerWhenItFinishesAfter() =
        runTest(dispatcher) {
            val viewModel = examOverShown()
            val before = CompletableDeferred<Unit>()
            reads.gate = before
            launch { store.today.refresh() }
            runCurrent()

            viewModel.keepStudying(goalId) {}
            // The read the save starts waits, so only the one that started before it can finish.
            reads.gate = CompletableDeferred()
            runCurrent()
            before.complete(Unit)
            advanceUntilIdle()

            assertEquals(ExamOverAnswer(goalId, archive = false), viewModel.examOverAnswer)

            reads.gate?.complete(Unit)
            advanceUntilIdle()

            assertNull(viewModel.examOverAnswer)
        }

    @Test
    fun aResumedGoalCanBeResumedAgainOnceTodayHasReadTheResume() =
        runTest(dispatcher) {
            val viewModel = examOverShown()

            viewModel.resume(goalId)
            advanceUntilIdle()
            reads.answer = AFTER_ANSWER
            store.today.refresh()
            advanceUntilIdle()

            assertNull(viewModel.resuming)
        }

    @Test
    fun aReadThatFailsAfterAResumeKeepsItBusy() =
        runTest(dispatcher) {
            val viewModel = examOverShown()

            viewModel.resume(goalId)
            advanceUntilIdle()
            reads.failure = ApiException(ApiError.Network)
            store.today.refresh()
            advanceUntilIdle()

            assertEquals(goalId, viewModel.resuming)
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

    private companion object {
        val EXAM_OVER: Today =
            decodeFixture(
                "today",
                "goal" to TodayExamOverWindowTest.EXAM_GOAL,
                "session" to TodayExamOverWindowTest.PAST_DATE_DAY,
                "progress" to TodayExamOverWindowTest.PAST_DATE,
            )

        /** The day after an answer saved: the plan studies on, no exam-over notice. */
        val AFTER_ANSWER: Today = decodeFixture("today", "goal" to TodayExamOverWindowTest.EXAM_GOAL)
    }
}
