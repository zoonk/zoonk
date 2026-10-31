package com.zoonk.android.feature.today

import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ANA
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.CountingApi
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.settle
import com.zoonk.android.data.waitFor
import com.zoonk.android.feature.mock.LiveMockApi
import com.zoonk.android.feature.mock.MockStore
import com.zoonk.android.feature.session.fixture
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.TodayGoal
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.UUID

@RunWith(AndroidJUnit4::class)
class TodayMockReadsTest {
    @get:Rule
    val rule = createComposeRule()

    private val api = CountingApi(mapOf(MOCKS to fixture("mock-options", "goalId" to GOAL.toString()).toString()))

    @After
    fun stop() = api.close()

    @Test
    fun todaysPracticeAndTheExamPageReadAGoalsMocksOnce() {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
        val cache = AppCache(FakeSession(AuthenticatedSession(ANA, "token-a", "local-a")), scope)
        val today = TodayStore(LiveTodayApi(api.clients), cache, scope, timeZone = { "UTC" })
        val mocks = MockStore(LiveMockApi(api.clients), cache)
        val goal =
            TodayGoal(dateEstimated = false, daysLeft = null, id = GOAL, kind = TodayGoal.Kind.EXAM, targetDate = null, title = "ENEM")
        var examPage by mutableStateOf(false)

        rule.setContent {
            ZoonkTheme {
                Column {
                    TodayPractice(today, mocks, goal) {}
                    if (examPage) mocks.options[GOAL].collectShown()
                }
            }
        }
        rule.waitFor { api.requests(MOCKS) == 1 }
        rule.runOnIdle { examPage = true }
        rule.settle(mocks.options[GOAL])

        assertEquals(1, api.requests(MOCKS))
    }

    private companion object {
        val GOAL: UUID = UUID.fromString("5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2d00")
        val MOCKS = "/goals/$GOAL/mocks"
    }
}
