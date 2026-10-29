package com.zoonk.android.feature.planlink

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.onboarding.FakeOnboardingApi
import com.zoonk.android.feature.onboarding.GOAL_ID
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.planLinkOf
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class PlanLinkFlowTest {
    @get:Rule
    val rule: ComposeContentTestRule = createComposeRule()

    private val api = FakeOnboardingApi()
    private lateinit var navigator: AppNavigator

    private fun show(signedIn: Boolean = true) {
        val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a").takeIf { signedIn })
        val store = OnboardingStore(api, AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)), session) { true }
        rule.setContent {
            ZoonkTheme {
                navigator = rememberAppNavigator()
                PlanLinkScreen(AppRoute.PlanLink(PLAN_ID), store, signedIn, navigator)
            }
        }
    }

    @Test
    fun aLearnerStartsTheirOwnPlanAtTheTimeTheyPickAndLandsOnIt() {
        show()

        rule.onNodeWithText("A study plan someone shared with you").assertIsDisplayed()
        rule.onNodeWithText("Bar exam").assertIsDisplayed()
        rule.onNodeWithText("Foundations").performScrollTo().assertIsDisplayed()
        rule.onNodeWithText("45", substring = true).performClick()
        rule.onNodeWithText("Start from this plan").performClick()
        rule.waitForIdle()

        assertEquals(listOf(PLAN_ID to 45L), api.fromPlans.map { it.first to it.second.dailyMinutes })
        assertEquals(AppRoute.Plan(), navigator.currentRoute)
    }

    @Test
    fun aVisitorStartsFromTheWordsWithThisPlan() {
        show(signedIn = false)

        rule.onNodeWithText("Start from this plan").performClick()

        assertEquals(AppRoute.StartGoal(goal = "Bar exam", planId = PLAN_ID), navigator.currentRoute)
    }

    @Test
    fun theOwnerIsSentToTheirOwnPlan() {
        api.planLink = planLinkOf(owner = GOAL_ID)
        show()
        rule.waitForIdle()

        assertEquals(AppRoute.Plan(), navigator.currentRoute)
    }

    @Test
    fun aRefusedStartSaysWhyAndStaysHere() {
        api.refusal =
            ApiException(
                ApiError.Unavailable,
                "GOAL_LIMIT_REACHED",
                status = 403,
                details =
                    buildJsonObject {
                        put("period", "total")
                        put("resource", "activeGoals")
                        put("tier", "free")
                    },
            )
        show()

        rule.onNodeWithText("Start from this plan").performClick()

        rule.onNodeWithText("You can't start another goal right now. Finish or pause one first.").performScrollTo().assertIsDisplayed()
        assertTrue(navigator.currentRoute !is AppRoute.Plan)
    }

    private companion object {
        const val PLAN_ID = "3c4d5e6f-7a8b-4c9d-8e1f-2a3b4c5d6e7f"
    }
}
