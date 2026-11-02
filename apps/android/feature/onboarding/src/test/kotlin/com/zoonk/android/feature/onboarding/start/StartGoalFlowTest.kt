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
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.SignInResult
import com.zoonk.android.feature.onboarding.DRAFT_ID
import com.zoonk.android.feature.onboarding.FakeOnboardingApi
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.failedDraft
import com.zoonk.android.feature.onboarding.noAllowance
import com.zoonk.android.feature.onboarding.readingDraft
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
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
    private var sessionKey by mutableStateOf<String?>("local-a")

    private fun show(route: AppRoute.StartGoal = AppRoute.StartGoal()) {
        val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
        val cache = AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate))
        store = OnboardingStore(api, cache, session) { SignInResult.SignedIn }
        rule.setContent {
            ZoonkTheme {
                StartGoalScreen(
                    route,
                    store,
                    cache.noAllowance(),
                    sessionKey = sessionKey,
                    canAttach = sessionKey != null,
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
}
