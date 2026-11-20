package com.zoonk.android.feature.mock.chooser

import com.zoonk.android.data.ANA
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.value
import com.zoonk.android.feature.exam.FakeMockApi
import com.zoonk.android.feature.exam.GOAL
import com.zoonk.android.feature.exam.mockOptions
import com.zoonk.android.feature.mock.MockStore
import com.zoonk.api.models.MockOptionsRequested
import com.zoonk.api.models.MockShape
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class MockStarterTest {
    private val dispatcher = StandardTestDispatcher()
    private val api = FakeMockStartApi()
    private val full = MockShape(area = null, day = 1, kind = MockShape.Kind.FULL)

    private fun TestScope.cache() =
        AppCache(
            FakeSession(AuthenticatedSession(ANA, "token", "local")),
            CoroutineScope(SupervisorJob() + dispatcher),
        )

    private fun TestScope.starter(cache: AppCache = cache()) = MockStarter(api, cache, MockStore(FakeMockApi(mockOptions("")), cache))

    @Test
    fun onlyAStartedMockRefreshesTheLearnerModel() =
        runTest(dispatcher) {
            val cache = cache()
            var reads = 0
            val model = cache.resource<Int>(Audience.SignedIn, setOf(DataDomain.LearnerModel)) { ++reads }
            val starter = starter(cache)
            model.load()

            api.starts = listOf({ preparing() }, { started() })
            starter.start(GOAL, full)
            model.load()
            assertEquals(1, reads)

            assertEquals(MutationResult.Done(MockStartOutcome.Opened(STARTED)), starter.start(GOAL, full))
            model.load()
            assertEquals(2, reads)
        }

    @Test
    fun aMockStillPreparedIsTheOptionsRequestAtOnce() =
        runTest(dispatcher) {
            val cache = cache()
            val store = MockStore(FakeMockApi(mockOptions("")), cache)
            val options = store.options[GOAL]
            options.load()
            api.starts = listOf { preparing() }

            assertEquals(MutationResult.Done(MockStartOutcome.Preparing), MockStarter(api, cache, store).start(GOAL, full))
            assertEquals(MockOptionsRequested(full, MockOptionsRequested.Status.PREPARING), options.state.value.value?.requested)
        }

    @Test
    fun aLapsedPlusIsAnAnswerNotAFailure() =
        runTest(dispatcher) {
            val starter = starter()

            api.starts = listOf { throw refusal("PLUS_REQUIRED") }
            assertEquals(MutationResult.Done(MockStartOutcome.PlusRequired), starter.start(GOAL, full))

            api.starts = listOf { throw refusal("GOAL_NOT_ACTIVE") }
            assertEquals(MutationResult.Failed::class, starter.start(GOAL, full)::class)
        }
}
