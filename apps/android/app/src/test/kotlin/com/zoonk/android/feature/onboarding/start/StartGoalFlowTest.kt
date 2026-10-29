package com.zoonk.android.feature.onboarding.start

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.GenerationEvent
import com.zoonk.android.feature.onboarding.DRAFT_ID
import com.zoonk.android.feature.onboarding.FakeOnboardingApi
import com.zoonk.android.feature.onboarding.GOAL_ID
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.readingDraft
import com.zoonk.android.feature.onboarding.understoodDraft
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.flowOf
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class StartGoalFlowTest {
    @get:Rule
    val rule: ComposeContentTestRule = createComposeRule()

    private val api = FakeOnboardingApi()
    private lateinit var navigator: AppNavigator

    private fun show(
        route: AppRoute.StartGoal = AppRoute.StartGoal(),
        hasSession: Boolean = true,
    ) {
        val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
        val store = OnboardingStore(api, AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)), session) { true }
        rule.setContent {
            ZoonkTheme {
                navigator = rememberAppNavigator()
                StartGoalScreen(route, store, hasSession = hasSession, canAttach = hasSession, navigator)
            }
        }
    }

    private fun sendGoal(words: String) {
        rule.onNode(hasSetTextAction()).performTextInput(words)
        rule.onNodeWithText("Build my plan").performClick()
    }

    @Test
    fun aTypedGoalIsReadThenConfirmedIntoItsSetup() {
        show()
        sendGoal("pass the bar exam")

        rule.onNodeWithText("Here's what I understood").assertIsDisplayed()
        rule.onNodeWithText("Pass the bar exam").assertIsDisplayed()
        rule.onNodeWithText("Looks right").performScrollTo().performClick()

        assertEquals(listOf("pass the bar exam" to "en"), api.understandCalls)
        assertEquals(
            "Pass the bar exam",
            api.created
                .single()
                .goals
                .single()
                .title,
        )
        assertEquals(AppRoute.GoalSetup(GOAL_ID), navigator.currentRoute)
    }

    @Test
    fun aGoalBeingReadIsFollowedToWhatWasUnderstood() {
        api.understood = { readingDraft(prompt = it) }
        api.events =
            flowOf(
                GenerationEvent(status = "completed", step = "readGoal"),
                GenerationEvent(status = "completed", step = "understandingReady"),
            )
        api.draft = understoodDraft()
        show()
        sendGoal("pass the bar exam")

        rule.onNodeWithText("Here's what I understood").assertIsDisplayed()
        assertEquals(listOf(DRAFT_ID), api.drafts)
    }

    @Test
    fun anUnclearGoalGoesBackToItsWords() {
        api.understood = { understoodDraft(prompt = it, understanding = """{"status":"unclear"}""") }
        show()
        sendGoal("stuff")

        rule.onNodeWithText("Tell us a bit more").assertIsDisplayed()
        rule.onNodeWithText("Write my goal again").performScrollTo().performClick()

        rule.onNodeWithText("What do you want to achieve?").assertIsDisplayed()
        rule.onNode(hasSetTextAction() and hasText("stuff")).assertIsDisplayed()
    }

    @Test
    fun aDraftFromALinkIsOnlyReadNeverSent() {
        api.draft = readingDraft()
        show(AppRoute.StartGoal(draftId = DRAFT_ID))

        rule.onNodeWithText("Understanding your goal").assertIsDisplayed()
        rule.onNodeWithText("pass the bar exam").assertIsDisplayed()
        assertEquals(emptyList<Pair<String, String>>(), api.understandCalls)
    }

    @Test
    fun aVisitorCanLogInFromTheStart() {
        show(hasSession = false)

        rule.onNodeWithText("Log in").performClick()

        assertEquals(AppRoute.Login, navigator.currentRoute)
    }
}
