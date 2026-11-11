package com.zoonk.android.feature.onboarding.start

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.SignInResult
import com.zoonk.android.feature.onboarding.DRAFT_ID
import com.zoonk.android.feature.onboarding.FakeOnboardingApi
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.failedDraft
import com.zoonk.android.feature.onboarding.goalsUnderstanding
import com.zoonk.android.feature.onboarding.noAllowance
import com.zoonk.android.feature.onboarding.readingDraft
import com.zoonk.android.feature.onboarding.understoodDraft
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
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
    private lateinit var store: OnboardingStore
    private lateinit var cache: AppCache
    private val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
    private var sessionKey by mutableStateOf<String?>("local-a")
    private var hasAccount by mutableStateOf(true)

    private fun show(route: AppRoute.StartGoal = AppRoute.StartGoal()) {
        cache = AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate))
        store = OnboardingStore(api, cache, session) { SignInResult.SignedIn }
        rule.setContent {
            ZoonkTheme {
                StartGoalScreen(
                    route,
                    store,
                    cache.noAllowance(),
                    sessionKey = sessionKey,
                    canAttach = sessionKey != null && hasAccount,
                    rememberAppNavigator(),
                )
            }
        }
    }

    private fun sendGoal(words: String) {
        rule.onNode(hasSetTextAction()).performTextInput(words)
        rule.onNodeWithText("Build my plan").performClick()
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
    fun anotherLearnerSeesNoneOfThePreviousOnesWork() {
        show()
        sendGoal("pass the bar exam")
        rule.onNodeWithText("Here's what I understood").assertIsDisplayed()

        sessionKey = "local-b"

        rule.onNodeWithText("What do you want to achieve?").assertIsDisplayed()
        rule.onNodeWithText("pass the bar exam").assertDoesNotExist()
    }

    @Test
    fun aGuestWhoSignsUpFromTheCardComesBackToItWithTheAccountsRoom() {
        fun card(left: Int) = understoodDraft(understanding = twoGoals(), activeGoalsLeft = left)
        hasAccount = false
        api.draft = card(left = 1)
        show(AppRoute.StartGoal(draftId = DRAFT_ID))
        rule.onNodeWithText("Create a free account").assertIsDisplayed()

        api.draft = card(left = 2)
        session.session = AuthenticatedSession("bia", "token-b", "local-b")
        cache.followSession()
        sessionKey = "local-b"
        hasAccount = true

        rule.onNodeWithText("Create a free account").assertDoesNotExist()
        rule.onNodeWithText("Looks right").performClick()
        rule.waitForIdle()
        assertEquals(
            listOf(listOf("Pass the bar exam", "Learn statistics")),
            api.created.map { input -> input.goals.map { it.title } },
        )
    }

    @Test
    fun leavingADraftTakesBackWhatItsTapAllowed() {
        api.understood = { readingDraft(prompt = it) }
        show()
        sendGoal("how does inflation work")
        assertTrue(store.wasSentHere(DRAFT_ID))

        rule.onNodeWithContentDescription("Back").performClick()

        rule.onNodeWithText("What do you want to achieve?").assertIsDisplayed()
        assertFalse(store.wasSentHere(DRAFT_ID))
    }

    @Test
    fun aReadIsStartedAgainOnceHoweverOftenTryAgainIsTapped() {
        api.draft = failedDraft()
        api.readAgainGate = CompletableDeferred()
        show(AppRoute.StartGoal(draftId = DRAFT_ID))

        rule.onNodeWithText("Try again").performClick()
        rule.onNodeWithText("Try again").assertDoesNotExist()
        api.readAgainGate?.complete(Unit)
        rule.waitForIdle()

        assertEquals(1, api.readsAgain)
    }

    @Test
    fun aRefusalForTheGoalsFollowedHoldsUntilARereadDraftHasRoom() {
        fun card(left: Int) = understoodDraft(understanding = twoGoals(), activeGoalsLeft = left)
        api.draft = card(left = 1)
        show(AppRoute.StartGoal(draftId = DRAFT_ID))

        api.refusal = ApiException(ApiError.Unavailable, "GOAL_LIMIT_REACHED", status = 429, details = activeGoalsLimit())
        api.draft = card(left = 0)
        rule.onNodeWithText("Looks right").performClick()

        rule.onNodeWithText("Looks right").assertDoesNotExist()
        rule.onNodeWithText("See Plus").assertIsDisplayed()
        assertEquals(listOf(listOf("Pass the bar exam")), api.created.map { input -> input.goals.map { it.title } })

        api.refusal = null
        api.draft = card(left = 1)
        cache.invalidate(setOf(DataDomain.Goals))

        rule.onNodeWithText("Looks right").assertIsDisplayed()
    }

    @Test
    fun aFullCardOpensEveryGoalOnceTheLearnerGetsPlus() {
        api.draft = understoodDraft(understanding = twoGoals(), activeGoalsLeft = 0)
        show(AppRoute.StartGoal(draftId = DRAFT_ID))
        rule.onNodeWithText("See Plus").assertIsDisplayed()
        rule.onNodeWithText("Looks right").assertDoesNotExist()

        api.draft = understoodDraft(understanding = twoGoals(), activeGoalsLeft = null)
        cache.invalidate(setOf(DataDomain.UserSubscription, DataDomain.Allowance, DataDomain.UserSession, DataDomain.Certificates))

        rule.onNodeWithText("Looks right").performClick()
        rule.waitForIdle()
        assertEquals(
            listOf(listOf("Pass the bar exam", "Learn statistics")),
            api.created.map { input -> input.goals.map { it.title } },
        )
    }
}

private fun twoGoals() =
    goalsUnderstanding().replace(
        "]}",
        """,{"cutoff":null,"examDates":[],"draft":{"kind":"learn","language":"en","prompt":"learn statistics","title":"Learn statistics","details":{}}}]}""",
    )

private fun activeGoalsLimit() =
    buildJsonObject {
        put("period", "total")
        put("resource", "activeGoals")
        put("tier", "free")
    }
