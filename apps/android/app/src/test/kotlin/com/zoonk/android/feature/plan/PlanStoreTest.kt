package com.zoonk.android.feature.plan

import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.value
import com.zoonk.api.models.Plan
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.runTest
import kotlinx.datetime.TimeZone
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Test
import java.util.UUID
import kotlin.time.Duration.Companion.hours
import kotlin.time.Duration.Companion.minutes
import kotlin.time.Instant

@OptIn(ExperimentalCoroutinesApi::class)
class PlanStoreTest {
    private val ana = AuthenticatedSession("ana", "token-a", "local-a")
    private val goalId = UUID.fromString(GOAL)

    private class FakePlanApi : PlanApi {
        var plans = 0
        var changed = false
        val askedSince = mutableListOf<Instant>()

        override suspend fun plan(
            session: AuthenticatedSession,
            goalId: UUID,
        ): Plan {
            plans++
            return plan()
        }

        override suspend fun planChanged(
            session: AuthenticatedSession,
            goalId: UUID,
            since: Instant,
        ): Boolean {
            askedSince += since
            return changed
        }

        override suspend fun syllabus(
            session: AuthenticatedSession,
            goalId: UUID,
        ) = syllabus()
    }

    @Test
    fun aPlanThatDidntChangeSinceItWasReadIsKept() =
        runTest {
            var now = Instant.parse("2026-10-28T12:00:00Z")
            val api = FakePlanApi()
            val store = store(api) { now }
            val resource = store.plan[goalId]

            resource.load()
            val first = resource.state.value.value
            now += 10.minutes
            resource.refresh()

            assertEquals(1, api.plans)
            assertEquals(listOf(Instant.parse("2026-10-28T11:59:00Z")), api.askedSince)
            assertSame(first, resource.state.value.value)

            api.changed = true
            resource.refresh()
            assertEquals(2, api.plans)
        }

    @Test
    fun aNewDayReadsThePlanAgainWithoutAsking() =
        runTest {
            var now = Instant.parse("2026-10-28T20:00:00Z")
            val api = FakePlanApi()
            val store = store(api) { now }
            val resource = store.plan[goalId]

            resource.load()
            now += 6.hours
            resource.refresh()

            assertEquals(2, api.plans)
            assertEquals(emptyList<Instant>(), api.askedSince)
        }

    private fun kotlinx.coroutines.test.TestScope.store(
        api: PlanApi,
        now: () -> Instant,
    ): PlanStore {
        val scope = CoroutineScope(SupervisorJob() + StandardTestDispatcher(testScheduler))
        return PlanStore(api, AppCache(FakeSession(ana), scope), now, timeZone = { TimeZone.UTC })
    }
}
