package com.zoonk.android.feature.onboarding.setup

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
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.waitFor
import com.zoonk.android.feature.mock.LiveMockApi
import com.zoonk.android.feature.mock.MockStore
import com.zoonk.android.feature.onboarding.GOAL_ID
import com.zoonk.android.feature.onboarding.LiveOnboardingApi
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.mockOptionsOf
import com.zoonk.android.feature.onboarding.placementOf
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
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
class PlacementMockReadsTest {
    @get:Rule
    val rule = createComposeRule()

    private val goal = UUID.fromString(GOAL_ID)
    private val mocks = "/goals/$goal/mocks"
    private val api =
        CountingApi(
            mapOf(
                "/goals/$goal/placement" to ApiJson.encodeToString(placementOf()),
                mocks to ApiJson.encodeToString(mockOptionsOf()),
            ),
        )

    @After
    fun stop() = api.close()

    @Test
    fun thePlacementStepAndThePlacementMockReadAGoalsMockOptionsOnce() {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
        val session = FakeSession(AuthenticatedSession(ANA, "token-a", "local-a"))
        val cache = AppCache(session, scope)
        val store = OnboardingStore(LiveOnboardingApi(api.clients), cache, session) { error("Not used") }
        val mockStore = MockStore(LiveMockApi(api.clients), cache)
        var chooser by mutableStateOf(false)

        rule.setContent {
            ZoonkTheme {
                Column {
                    if (chooser) {
                        mockStore.options[goal].collectShown()
                    } else {
                        PlacementStep(GOAL_ID, "bar exam", 3, GenerationRun(), null, store, mockStore, rememberAppNavigator(), {}, {})
                    }
                }
            }
        }
        rule.waitFor { api.requests(mocks) == 1 }
        rule.waitForIdle()
        rule.runOnIdle { chooser = true }
        rule.waitFor { mockStore.options[goal].state.value is LoadState.Loaded }

        assertEquals(1, api.requests(mocks))
    }
}
