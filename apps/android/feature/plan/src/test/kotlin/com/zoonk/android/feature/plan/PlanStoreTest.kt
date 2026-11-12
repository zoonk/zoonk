package com.zoonk.android.feature.plan

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.LearnerSummaryStore
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.value
import com.zoonk.api.models.GoalContentCountry
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.UUID
import kotlin.time.Duration.Companion.minutes
import kotlin.time.Instant

@OptIn(ExperimentalCoroutinesApi::class)
class PlanStoreTest {
    private val ana = AuthenticatedSession("ana", "token-a", "local-a")
    private val goalId = UUID.fromString(GOAL)

    @Test
    fun whileLessonsAreWrittenThePlanIsReadAgainOnlyOnceItChanged() =
        runTest {
            var now = Instant.parse("2026-10-28T12:00:00Z")
            val api = FakePlanApi()
            val store = store(api) { now }
            val resource = store.plan[goalId]

            resource.load()
            val first = resource.state.value.value
            now += 10.minutes
            store.refreshIfChanged(goalId)

            assertEquals(1, api.plans)
            assertEquals(listOf(Instant.parse("2026-10-28T11:59:00Z")), api.askedSince)
            assertSame(first, resource.state.value.value)

            api.changed = true
            store.refreshIfChanged(goalId)
            assertEquals(2, api.plans)
        }

    @Test
    fun anyOtherReadReadsThePlanWithoutAsking() =
        runTest {
            val api = FakePlanApi()
            val store = store(api) { Instant.parse("2026-10-28T12:00:00Z") }
            val resource = store.plan[goalId]

            resource.load()
            store.refreshIfChanged(goalId)
            resource.refresh()
            resource.invalidate()
            resource.load()

            assertEquals(3, api.plans)
            assertEquals(1, api.askedSince.size)
        }

    @Test
    fun continuingAtTheNextLevelReadsTheLearnersGoalsAgain() =
        runTest {
            val api = FakePlanApi()
            val store = store(api) { Instant.parse("2026-10-28T12:00:00Z") }
            val next = store.end[goalId]

            next.load()
            next.load()
            assertEquals(1, api.studyNextReads)

            store.continueAtNextLevel(goalId)
            next.load()

            assertEquals(1, api.continued)
            assertEquals(2, api.studyNextReads)
        }

    @Test
    fun aSavedCountryAndNameStayShownWhenTheGoalsCantBeReadAgain() =
        runTest {
            val cache = AppCache(FakeSession(ana), CoroutineScope(SupervisorJob() + StandardTestDispatcher(testScheduler)))
            var reads = 0
            val argentine =
                learnerSummary().let {
                    it.copy(
                        goals =
                            it.goals.map { goal ->
                                goal.copy(targetLanguage = "es", targetRegion = "AR", languageFlag = "ar")
                            },
                    )
                }
            val summary =
                LearnerSummaryStore(
                    api = {
                        if (reads++ > 0) throw ApiException(ApiError.Network)
                        argentine
                    },
                    cache = cache,
                    scope = backgroundScope,
                ).summary
            val screen = launch { summary.shown.collect {} }
            advanceUntilIdle()
            val store = PlanStore(FakePlanApi(), cache, summary)

            fun shown() =
                summary.state.value.value!!
                    .goals
                    .single()

            assertTrue(store.setRegion(goalId, null) is MutationResult.Done)
            advanceUntilIdle()
            assertEquals(null, shown().targetRegion)
            assertEquals("es", shown().languageFlag)

            assertTrue(store.setRegion(goalId, "MX") is MutationResult.Done)
            assertTrue(store.rename(goalId, "Spanish for Mexico City") is MutationResult.Done)
            advanceUntilIdle()

            assertEquals(4, reads)
            assertEquals("MX", shown().targetRegion)
            assertEquals("mx", shown().languageFlag)
            assertEquals("Spanish for Mexico City", shown().displayName)

            assertTrue(store.setContentCountry(goalId, "PT") is MutationResult.Done)
            advanceUntilIdle()
            assertEquals("PT", shown().contentCountry?.code)
            assertEquals(GoalContentCountry.Rebuild.PREPARING, shown().contentCountry?.rebuild)
            screen.cancel()
        }

    private fun kotlinx.coroutines.test.TestScope.store(
        api: PlanApi,
        now: () -> Instant,
    ): PlanStore {
        val cache = AppCache(FakeSession(ana), CoroutineScope(SupervisorJob() + StandardTestDispatcher(testScheduler)))
        return PlanStore(api, cache, cache.resource(Audience.SignedIn) { null }, now)
    }
}
