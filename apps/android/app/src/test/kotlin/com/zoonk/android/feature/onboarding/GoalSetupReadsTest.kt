package com.zoonk.android.feature.onboarding

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
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.settle
import com.zoonk.android.data.waitFor
import com.zoonk.android.feature.plan.SetupLeft
import com.zoonk.android.feature.plan.setupLeft
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
class GoalSetupReadsTest {
    @get:Rule
    val rule = createComposeRule()

    private val api = CountingApi(mapOf(SETUP to ApiJson.encodeToString(setupView(listOf("purpose", "plan")))))

    @After
    fun stop() = api.close()

    @Test
    fun todayAndThePlanTabReadAGoalsSetupOnce() {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
        val session = FakeSession(AuthenticatedSession(ANA, "token-a", "local-a"))
        val cache = AppCache(session, scope)
        val onboarding = OnboardingStore(LiveOnboardingApi(api.clients), cache, session) { error("Not used") }
        var planTab by mutableStateOf(false)
        var planLeft = SetupLeft.Unknown

        rule.setContent {
            ZoonkTheme {
                Column {
                    onboarding.onboardings[GOAL_ID].collectShown()
                    if (planTab) planLeft = setupLeft(onboarding, GOAL)
                }
            }
        }
        rule.waitFor { onboarding.onboardings[GOAL_ID].state.value is LoadState.Loaded }
        rule.runOnIdle { planTab = true }
        rule.settle(onboarding.onboardings[GOAL_ID])
        assertEquals(SetupLeft.Yes, planLeft)

        assertEquals(1, api.requests(SETUP))
    }

    private companion object {
        val GOAL: UUID = UUID.fromString(GOAL_ID)
        val SETUP = "/goals/$GOAL/onboarding"
    }
}
