package com.zoonk.android.feature.onboarding.setup

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.feature.onboarding.FakeOnboardingApi
import com.zoonk.android.feature.onboarding.GOAL_ID
import com.zoonk.android.feature.onboarding.MOCK_ID
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.mockOptionsOf
import com.zoonk.android.feature.onboarding.placementOf
import com.zoonk.android.feature.onboarding.runningMock
import com.zoonk.android.feature.onboarding.typedQuestion
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.PlacementAnswer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class PlacementStepFlowTest {
    @get:Rule
    val rule: ComposeContentTestRule = createComposeRule()

    private val api = FakeOnboardingApi()
    private lateinit var navigator: AppNavigator
    private var done = 0

    private fun show(run: GenerationRun = GenerationRun()) {
        val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
        val store = OnboardingStore(api, AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)), session) { true }
        rule.setContent {
            ZoonkTheme {
                navigator = rememberAppNavigator()
                Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
                    PlacementStep(GOAL_ID, "bar exam", areaCount = 3, run, onRetryRun = null, store, navigator, onDone = { done++ })
                }
            }
        }
    }

    private fun tap(text: String) = rule.onNodeWithText(text).performScrollTo().performClick()

    private fun sentAnswer() = ApiJson.encodeToString<PlacementAnswer>(api.placementAnswers.single().answer)

    @Test
    fun openingItOnlyReads() {
        show()

        rule.onNodeWithText("Let's see what you already know").assertIsDisplayed()
        rule.onNodeWithText("A few quick questions about the 3 areas", substring = true).assertIsDisplayed()
        assertEquals(emptyList<Any>(), api.placementAnswers)
        assertEquals(emptyList<Boolean>(), api.finishedPlacements)
    }

    @Test
    fun aPickedAnswerIsSentThenThePlanFollows() {
        show()
        tap("Start")

        rule.onNodeWithText("Bar exam · Question 1").assertIsDisplayed()
        rule.onNodeWithText("Confirm").performScrollTo().assertIsNotEnabled()
        tap("A district court")
        tap("Confirm")

        assertEquals("""{"selectedIndex":1}""", sentAnswer())
        rule.onNodeWithText("1 question answered").assertIsDisplayed()
        rule.onNodeWithText("Your starting point is set").assertIsDisplayed()
        tap("See my plan")

        assertEquals(listOf(false), api.finishedPlacements)
        assertEquals(1, done)
    }

    @Test
    fun notKnowingIsAnAnswer() {
        show()
        tap("Start")
        tap("I don't know yet")

        assertEquals("""{"dontKnow":true}""", sentAnswer())
    }

    @Test
    fun aTypedAnswerSendsTheLearnersWords() {
        api.placement = placementOf(next = typedQuestion())
        show()
        tap("Start")

        rule.onNode(hasSetTextAction()).performTextInput("  Something said outside court  ")
        tap("Confirm")

        assertEquals("""{"text":"Something said outside court"}""", sentAnswer())
    }

    @Test
    fun anAnswerThatDidNotGoThroughIsSentAgainAsItWas() {
        api.writeFailure = ApiException(ApiError.Network)
        show()
        tap("Start")
        tap("The Supreme Court")
        tap("Confirm")

        rule.onNodeWithText("That didn't go through. Your answers are kept.").assertIsDisplayed()
        api.writeFailure = null
        tap("Try again")

        assertEquals(2, api.placementAnswers.size)
        assertEquals(api.placementAnswers[0], api.placementAnswers[1])
        rule.onNodeWithText("Your starting point is set").assertIsDisplayed()
    }

    @Test
    fun skippingStartsFromTheBasics() {
        show()
        tap("Skip and start from the basics")

        assertEquals(listOf(true), api.finishedPlacements)
        assertEquals(1, done)
    }

    @Test
    fun aFinishThatFailedKeepsTheLearnerHere() {
        api.writeFailure = ApiException(ApiError.Network)
        show()
        tap("Skip and start from the basics")

        rule.onNodeWithText("We couldn't save that. Try again.").assertIsDisplayed()
        assertEquals(0, done)
    }

    @Test
    fun questionsStillBeingWrittenShowTheirWait() {
        api.placement = placementOf(status = "preparing", next = null)
        show()
        tap("Start")

        rule.onNodeWithText("Getting your questions ready").assertIsDisplayed()
        rule.onNodeWithText("They come from the skills your goal needs. It usually takes a minute or two.").assertIsDisplayed()
    }

    @Test
    fun aMockExamOfferOpensTheMockChooser() {
        api.mockOptions = mockOptionsOf()
        show()
        tap("Or take a mock exam")

        assertEquals(AppRoute.PlacementMock(GOAL_ID), navigator.currentRoute)
    }

    @Test
    fun aMockExamLeftRunningGoesOnOrStops() {
        api.mockOptions = mockOptionsOf(mock = runningMock())
        show()

        tap("Continue the mock exam")
        assertEquals(AppRoute.Mock(MOCK_ID), navigator.currentRoute)

        tap("Stop and see my plan")
        assertEquals(listOf(MOCK_ID), api.finishedMocks)
        assertEquals(listOf(false), api.finishedPlacements)
        assertEquals(1, done)
    }
}
