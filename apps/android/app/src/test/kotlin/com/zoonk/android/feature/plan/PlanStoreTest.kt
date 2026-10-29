package com.zoonk.android.feature.plan

import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.value
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
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

    private fun kotlinx.coroutines.test.TestScope.store(
        api: PlanApi,
        now: () -> Instant,
    ): PlanStore {
        val scope = CoroutineScope(SupervisorJob() + StandardTestDispatcher(testScheduler))
        return PlanStore(api, AppCache(FakeSession(ana), scope), now)
    }
}
