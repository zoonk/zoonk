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
import kotlinx.serialization.json.JsonArray
import org.junit.After
import org.junit.Assert.assertEquals
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

    @Test
    fun continuingAgainWhileTheDayStillOpensSendsOneRequest() =
        runTest(dispatcher) {
            val cache = AppCache(session, CoroutineScope(SupervisorJob() + dispatcher))
            val day =
                fixture(
                    "study-session",
                    "status" to "active",
                    "blocks" to JsonArray(listOf(fixture("study-block", "id" to BLOCK))),
                    "nextPosition" to 0,
                )
            val today = TodayStore(FakeTodayApi(listOf(decodeFixture<Today>("today", "session" to day))), cache, backgroundScope, { "UTC" })
            val study = FakeStudyApi()
            val vm = SearchViewModel(today, StudyOpener(study, { _, _ -> error("Not used") }, cache, { "UTC" }, backgroundScope))
            today.today.load()

            vm.continueToday(open = {}, failed = {})
            vm.continueToday(open = {}, failed = {})
            advanceUntilIdle()

            assertEquals(listOf(UUID.fromString(BLOCK)), study.started)
        }

    private companion object {
        const val BLOCK = "5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2d77"
    }
}
