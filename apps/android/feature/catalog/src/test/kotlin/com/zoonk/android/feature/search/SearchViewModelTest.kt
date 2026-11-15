package com.zoonk.android.feature.search

import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.session.FakeStudyApi
import com.zoonk.android.feature.session.StudyOpener
import com.zoonk.android.feature.session.decodeFixture
import com.zoonk.android.feature.session.fixture
import com.zoonk.android.feature.today.FakeTodayApi
import com.zoonk.android.feature.today.TodayStore
import com.zoonk.api.models.StudyBlockOpeningTarget
import com.zoonk.api.models.Today
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlinx.serialization.json.JsonArray
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.util.UUID

@OptIn(ExperimentalCoroutinesApi::class)
class SearchViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))

    @Before
    fun main() = Dispatchers.setMain(dispatcher)

    @After
    fun reset() = Dispatchers.resetMain()

    private val study = FakeStudyApi()

    @Test
    fun continuingAgainWhileTheDayStillOpensSendsOneRequest() =
        runTest(dispatcher) {
            val vm = searchWithADayToContinue()

            vm.continueToday()
            vm.continueToday()
            advanceUntilIdle()

            assertEquals(listOf(UUID.fromString(BLOCK)), openedBlocks())
        }

    @Test
    fun aStepThatOpensWhileThePageIsRecreatedOpensOnce() =
        runTest(dispatcher) {
            val vm = searchWithADayToContinue()

            // No page shows while the step opens, as when the window is recreated.
            vm.continueToday()
            advanceUntilIdle()

            assertTrue(vm.continued.value?.also(vm.continued::acted) is Continued.Open)
            assertNull(vm.continued.value)
        }

    @Test
    fun aStepThatOpensAfterThePageLeftOpensNothingOnReturn() =
        runTest(dispatcher) {
            val vm = searchWithADayToContinue()

            vm.continueToday()
            vm.visit.end()
            advanceUntilIdle()

            assertEquals(listOf(UUID.fromString(BLOCK)), openedBlocks())
            assertNull(vm.continued.value)
        }

    /** Search over a Today read whose day has a next step, its opening run by the test's scheduler. */
    private suspend fun TestScope.searchWithADayToContinue(): SearchViewModel {
        val cache = AppCache(session, CoroutineScope(SupervisorJob() + dispatcher))
        val day =
            fixture(
                "study-session",
                "status" to "active",
                "blocks" to JsonArray(listOf(fixture("study-block", "id" to BLOCK))),
                "nextPosition" to 0,
            )
        val today = TodayStore(FakeTodayApi(listOf(decodeFixture<Today>("today", "session" to day))), cache, backgroundScope, { "UTC" })
        val vm = SearchViewModel(today, StudyOpener(study, { _, _ -> error("Not used") }, cache, { "UTC" }))
        today.today.load()
        return vm
    }

    private fun openedBlocks() = study.targets.map { (it as StudyBlockOpeningTarget.NextWrapper).value.expectedBlockId }

    private companion object {
        const val BLOCK = "5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2d77"
    }
}
