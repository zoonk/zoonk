package com.zoonk.android.feature.onboarding.start

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.StateRestorationTester
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.GenerationEvent
import com.zoonk.android.data.SignInResult
import com.zoonk.android.feature.onboarding.DRAFT_ID
import com.zoonk.android.feature.onboarding.FakeOnboardingApi
import com.zoonk.android.feature.onboarding.GOAL_ID
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.failedDraft
import com.zoonk.android.feature.onboarding.noAllowance
import com.zoonk.android.feature.onboarding.readingDraft
import com.zoonk.android.feature.onboarding.understoodDraft
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.flowOf
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
    private lateinit var navigator: AppNavigator
    private lateinit var store: OnboardingStore
    private var sessionKey by mutableStateOf<String?>("local-a")

    private fun show(
        route: AppRoute.StartGoal = AppRoute.StartGoal(),
        hasSession: Boolean = true,
        restoration: StateRestorationTester? = null,
    ) {
        sessionKey = if (hasSession) "local-a" else null
        val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a").takeIf { hasSession })
        val cache = AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate))
        store = OnboardingStore(api, cache, session) { SignInResult.SignedIn }
        val setContent: (@Composable () -> Unit) -> Unit = restoration?.let { it::setContent } ?: rule::setContent
        setContent {
            ZoonkTheme {
                navigator = rememberAppNavigator()
                StartGoalScreen(route, store, cache.noAllowance(), sessionKey = sessionKey, canAttach = sessionKey != null, navigator)
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
    fun theReadingsBarGoesOnFromWhereTheSendLeftItWhenTheDraftArrives() {
        val sent = CompletableDeferred<Unit>()
        api.understandGate = sent
        api.understood = { readingDraft(prompt = it) }
        show()
        sendGoal("pass the bar exam")

        assertTheBarGoesOnOnceTheRunIsFollowed(released = sent)
    }

    @Test
    fun theReadingsBarGoesOnFromWhereTryAgainLeftItWhenTheReadStarts() {
        val readAgain = CompletableDeferred<Unit>()
        api.draft = failedDraft()
        api.readAgainGate = readAgain
        show(AppRoute.StartGoal(draftId = DRAFT_ID))
        api.draft = readingDraft()
        rule.onNodeWithText("Try again").performClick()

        assertTheBarGoesOnOnceTheRunIsFollowed(released = readAgain)
    }

    @Test
    fun aDraftOpenedOnItsReadKeepsItsBarThroughRecreation() {
        api.draft = readingDraft()
        val restoration = StateRestorationTester(rule)
        show(AppRoute.StartGoal(draftId = DRAFT_ID), restoration = restoration)
        val before = barAfterHalfASecond()

        restoration.emulateSavedInstanceStateRestore()

        val after = shownProgress()
        assertTrue("The bar went back from $before to $after", after >= before)
    }

    @Test
    fun aReadStartedAgainAfterItStoppedIsANewWait() {
        val events = MutableSharedFlow<GenerationEvent>(replay = 1)
        api.events = events
        api.understood = { readingDraft(prompt = it) }
        show()
        sendGoal("pass the bar exam")
        barAfterHalfASecond()
        events.tryEmit(GenerationEvent(status = "error", step = "workflowError"))
        rule.onNodeWithText("This didn't finish").assertIsDisplayed()

        api.events = flowOf()
        api.draft = readingDraft(generationId = "run-2")
        rule.onNodeWithText("Try again").performClick()

        val restarted = shownProgress()
        assertTrue("A new wait should start its bar, not $restarted", restarted < 0.05f)
    }

    /** The wait shown before [released] completes gives way to the run's own, whose bar never goes back. */
    private fun assertTheBarGoesOnOnceTheRunIsFollowed(released: CompletableDeferred<Unit>) {
        val before = barAfterHalfASecond()

        released.complete(Unit)
        rule.waitForIdle()

        assertTrue(api.generationSessions.isNotEmpty())
        val after = shownProgress()
        assertTrue("The bar went back from $before to $after", after >= before)
    }

    private fun barAfterHalfASecond(): Float {
        rule.waitForIdle()
        // The bar drifts on the device's clock, which the test clock doesn't move.
        Thread.sleep(500)
        rule.mainClock.advanceTimeBy(1_000)
        return shownProgress().also { assertTrue("Half a second of the read should move the bar, not $it", it > 0.05f) }
    }

    private fun shownProgress() =
        rule
            .onNode(hasContentDescription("Reading your goal") and SemanticsMatcher.keyIsDefined(SemanticsProperties.ProgressBarRangeInfo))
            .fetchSemanticsNode()
            .config[SemanticsProperties.ProgressBarRangeInfo]
            .current

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

    @Test
    fun aDraftLinkWithoutASessionStartsFromTheWords() {
        api.draft = understoodDraft()
        show(AppRoute.StartGoal(draftId = DRAFT_ID), hasSession = false)

        rule.onNodeWithText("What do you want to achieve?").assertIsDisplayed()
        assertEquals(emptyList<String>(), api.drafts)
    }
}
