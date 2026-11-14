package com.zoonk.android.feature.today

import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.value
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
import kotlinx.coroutines.launch
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
    private val before = decodeFixture<Today>("today", "goal" to goalNamed("Before"))
    private val after = decodeFixture<Today>("today", "goal" to goalNamed("After"))
    private val todayApi = FakeTodayApi(listOf(before))
    private lateinit var todayStore: TodayStore
    private lateinit var planStore: PlanStore
    private val read = TodayRead.Day(decodeFixture<Today>("today"), day())

    @Before
    fun main() = Dispatchers.setMain(dispatcher)

    @After
    fun reset() = Dispatchers.resetMain()

    private fun today(): TodayViewModel {
        val cache = AppCache(FakeSession(AuthenticatedSession("ana", "token-a", "local-a")), CoroutineScope(SupervisorJob() + dispatcher))
        val study = FakeStudyApi()
        todayStore = TodayStore(todayApi, cache, CoroutineScope(SupervisorJob() + dispatcher), timeZone = { "UTC" })
        planStore = PlanStore(plans, cache)
        return TodayViewModel(
            StudyOpener(study, study::writeLesson, cache, timeZone = { "UTC" }),
            todayStore,
            planStore,
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
    fun anAcceptedPlanChangeReadsTheDayAgain() =
        runTest(dispatcher) {
            val viewModel = today()
            val shown = backgroundScope.launch { todayStore.today.shown.collect {} }
            advanceUntilIdle()
            assertEquals("Before", shownGoal())
            todayApi.answers = listOf(after)

            viewModel.decidePlanChange(read, decodeFixture("plan-change", "canApply" to true), PlanChangeDecisionInput.Status.APPLIED)
            advanceUntilIdle()

            assertEquals("After", shownGoal())
            shown.cancel()
        }

    @Test
    fun anAcceptDuringAPollReadsTheDayInFull() =
        runTest(dispatcher) {
            val viewModel = today()
            val shown = backgroundScope.launch { todayStore.today.shown.collect {} }
            advanceUntilIdle()
            todayApi.answers = listOf(after)

            backgroundScope.launch { todayStore.refreshIfChanged() }
            viewModel.decidePlanChange(read, decodeFixture("plan-change", "canApply" to true), PlanChangeDecisionInput.Status.APPLIED)
            advanceUntilIdle()

            assertEquals("After", shownGoal())
            shown.cancel()
        }

    @Test
    fun anUndonePlanChangeReadsTheDayAgain() =
        runTest(dispatcher) {
            today()
            val shown = backgroundScope.launch { todayStore.today.shown.collect {} }
            advanceUntilIdle()
            assertEquals("Before", shownGoal())
            todayApi.answers = listOf(after)

            planStore.undo(read.today.goal.id, java.util.UUID.randomUUID())
            advanceUntilIdle()

            assertEquals("After", shownGoal())
            shown.cancel()
        }

    private fun shownGoal() = (todayStore.today.state.value.value as? TodayRead.Day)?.today?.goal?.displayName

    private fun goalNamed(name: String) =
        buildJsonObject {
            put("dateEstimated", false)
            put("daysLeft", null as Int?)
            put("id", "5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2d00")
            put("kind", "learn")
            put("targetDate", null as String?)
            put("title", name)
            put("displayName", name)
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
