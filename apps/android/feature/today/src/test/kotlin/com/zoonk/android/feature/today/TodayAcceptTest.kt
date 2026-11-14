package com.zoonk.android.feature.today

import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.focustest.unusedFocusTests
import com.zoonk.android.feature.plan.FakePlanApi
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.feature.session.FakeStudyApi
import com.zoonk.android.feature.session.StudyOpener
import com.zoonk.android.feature.session.day
import com.zoonk.android.feature.session.decodeFixture
import com.zoonk.api.models.MemoryInsight
import com.zoonk.api.models.PlanChange
import com.zoonk.api.models.PlanChangeDecisionInput
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
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test

/** An accept carries the numbers the learner saw; when they moved, nothing applies and the card asks again with today's. */
@OptIn(ExperimentalCoroutinesApi::class)
class TodayAcceptTest {
    private val dispatcher = StandardTestDispatcher()
    private val plans = FakePlanApi()
    private val todayApi = FakeTodayApi(emptyList())
    private val read = TodayRead.Day(decodeFixture<Today>("today"), day())

    @Before
    fun main() = Dispatchers.setMain(dispatcher)

    @After
    fun reset() = Dispatchers.resetMain()

    private fun today(): TodayViewModel {
        val cache = AppCache(FakeSession(AuthenticatedSession("ana", "token-a", "local-a")), CoroutineScope(SupervisorJob() + dispatcher))
        val study = FakeStudyApi()
        return TodayViewModel(
            StudyOpener(study, study::writeLesson, cache, timeZone = { "UTC" }),
            TodayStore(todayApi, cache, CoroutineScope(SupervisorJob() + dispatcher), timeZone = { "UTC" }),
            PlanStore(plans, cache),
            unusedFocusTests(cache),
        )
    }

    @Test
    fun aPlanChangeWhoseNumbersMovedAsksAgainWithTodaysAndThenApplies() =
        runTest(dispatcher) {
            val viewModel = today()
            val shown = decodeFixture<PlanChange>("plan-change", "canApply" to true)
            plans.repriced = decodeFixture<PlanChange>("plan-change", "canApply" to true, "quote" to "quote-today")

            viewModel.decidePlanChange(read, shown, PlanChangeDecisionInput.Status.APPLIED)
            advanceUntilIdle()

            assertNull(viewModel.planChangeAnswer)
            val asking = viewModel.repricedChange?.change
            assertEquals("quote-today", asking?.quote)

            viewModel.decidePlanChange(read, asking!!, PlanChangeDecisionInput.Status.APPLIED)
            advanceUntilIdle()

            assertEquals(listOf<String?>("quote-shown", "quote-today"), plans.decisionQuotes)
            assertEquals(PlanChange.Status.APPLIED, viewModel.planChangeAnswer?.change?.status)
            assertNull(viewModel.repricedChange)
        }

    @Test
    fun anInsightThatComesBackPendingIsNotAcceptedAndAsksAgainWithTodaysNumbers() =
        runTest(dispatcher) {
            val viewModel = today()
            val shown = planChangeInsight("quote-shown")
            todayApi.insightAnswer = planChangeInsight("quote-today")

            viewModel.answerInsight(shown, accepted = true)
            advanceUntilIdle()

            assertEquals(listOf<String?>("quote-shown"), todayApi.insightQuotes)
            assertNull(viewModel.insightAnswers[shown.id])
            assertEquals("quote-today", viewModel.repricedInsights[shown.id]?.planChange?.quote)
        }

    private fun planChangeInsight(quote: String): MemoryInsight =
        decodeFixture(
            "memory-insight",
            "kind" to "planChange",
            "planChange" to
                buildJsonObject {
                    put("canApply", true)
                    put("effect", null as String?)
                    put("id", "6f1c2c1e-1b8a-4d8e-9a77-2d8f4b0f1d01")
                    put("quote", quote)
                    put("status", "proposed")
                },
        )
}
