package com.zoonk.android.feature.onboarding.start

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ANA
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.CountingApi
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.FakeSessionApi
import com.zoonk.android.data.MemoryCredentials
import com.zoonk.android.data.SessionStore
import com.zoonk.android.data.StoredSession
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.settle
import com.zoonk.android.data.waitFor
import com.zoonk.android.feature.onboarding.LiveOnboardingApi
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.subscription.LiveSubscriptionApi
import com.zoonk.android.feature.subscription.NoPlayBilling
import com.zoonk.android.feature.subscription.SubscriptionStore
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class AllowanceReadsTest {
    @get:Rule
    val rule = createComposeRule()

    @get:Rule
    val folder = TemporaryFolder()

    private val api = CountingApi(mapOf(ALLOWANCE to ALLOWANCE_BODY))

    @After
    fun stop() = api.close()

    @Test
    fun startingAGoalAndTheSubscriptionPageReadTheAllowanceOnce() {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
        val ana = AuthenticatedSession(ANA, "token-a", "local-a")
        val sessions =
            SessionStore(
                FakeSessionApi().apply { accounts += "token-a" to ANA },
                MemoryCredentials(StoredSession(ana, false)),
                DraftStore(folder.newFolder(), scope, io = Dispatchers.Main.immediate),
                onChange = { _, _ -> },
                clearCredentialState = {},
            )
        runBlocking { sessions.restore() }
        val cache = AppCache(sessions, scope)
        val onboarding = OnboardingStore(LiveOnboardingApi(api.clients), cache, sessions) { error("Not used") }
        val subscriptions = SubscriptionStore(LiveSubscriptionApi(api.clients), NoPlayBilling, sessions, cache, scope, flowOf(false))
        var subscriptionPage by mutableStateOf(false)

        rule.setContent {
            ZoonkTheme {
                if (subscriptionPage) {
                    subscriptions.allowance.collectShown()
                } else {
                    StartGoalScreen(
                        AppRoute.StartGoal(),
                        onboarding,
                        subscriptions.allowance,
                        "local-a",
                        canAttach = true,
                        rememberAppNavigator(),
                    )
                }
            }
        }
        rule.waitFor { api.requests(ALLOWANCE) == 1 }
        rule.waitForIdle()
        rule.runOnIdle { subscriptionPage = true }
        rule.settle(subscriptions.allowance)

        assertEquals(1, api.requests(ALLOWANCE))
    }

    private companion object {
        const val ALLOWANCE = "/me/allowance"
        const val ALLOWANCE_BODY =
            """{"tier":"free","activeGoals":{"limit":1,"used":0},"callTime":{"limitSeconds":null,"monthLimitSeconds":null,"usedSeconds":0,"usedSecondsThisMonth":0},"examPrep":{"includesMockExams":false,"studyDays":null},"generatedLessons":null,"resets":{"day":"2026-10-29T00:00:00Z","month":"2026-11-01T00:00:00Z"},"items":[]}"""
    }
}
