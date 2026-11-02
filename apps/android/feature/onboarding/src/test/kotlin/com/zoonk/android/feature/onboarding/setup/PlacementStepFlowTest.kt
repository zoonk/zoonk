package com.zoonk.android.feature.onboarding.setup

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.hasProgressBarRangeInfo
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
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.SignInResult
import com.zoonk.android.feature.exam.FakeMockApi
import com.zoonk.android.feature.mock.MockStore
import com.zoonk.android.feature.onboarding.FakeOnboardingApi
import com.zoonk.android.feature.onboarding.GOAL_ID
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.placementOf
import com.zoonk.android.feature.onboarding.typedQuestion
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.CompletableDeferred
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
    private val mockApi = FakeMockApi(options = null)
    private var done = 0

    private fun show() {
        val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
        val cache = AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate))
        val store = OnboardingStore(api, cache, session) { SignInResult.SignedIn }
        val mocks = MockStore(mockApi, cache)
        rule.setContent {
            ZoonkTheme {
                Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
                    PlacementStep(
                        GOAL_ID,
                        "bar exam",
                        areaCount = 3,
                        GenerationRun(),
                        onRetryRun = null,
                        store,
                        mocks,
                        rememberAppNavigator(),
                        onProgress = {},
                        onDone = { done++ },
                    )
                }
            }
        }
    }

    private fun tap(text: String) = rule.onNodeWithText(text).performScrollTo().performClick()

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
    fun aFinishThatFailedKeepsTheLearnerHere() {
        api.writeFailure = ApiException(ApiError.Network)
        show()
        tap("Skip and start from the basics")

        rule.onNodeWithText("We couldn't save that. Try again.").assertIsDisplayed()
        assertEquals(0, done)
    }

    @Test
    fun startReadsThePlacementFirstSoQuestionsWrittenMeanwhileOpenWithoutTheWait() {
        api.placement = placementOf(status = "preparing", next = null)
        show()
        api.placement = placementOf()
        val read = CompletableDeferred<Unit>()
        api.placementGate = read
        tap("Start")

        rule.onNodeWithText("Getting your questions ready").assertDoesNotExist()
        rule.onNodeWithText("Let's see what you already know").assertIsDisplayed()
        rule.onNodeWithText("Start").assertIsNotEnabled()
        rule.onNode(hasProgressBarRangeInfo(ProgressBarRangeInfo.Indeterminate), useUnmergedTree = true).assertExists()

        read.complete(Unit)

        rule.onNodeWithText("Bar exam\u00A0· Question 1").assertIsDisplayed()
    }

    @Test
    fun aStartWhoseReadFailedWaitsAndReadsAgainInsteadOfOpeningQuestionsReadBefore() {
        show()
        api.placementGate = CompletableDeferred<Unit>().apply { completeExceptionally(ApiException(ApiError.Network)) }
        tap("Start")

        rule.onNodeWithText("Getting your questions ready").assertIsDisplayed()
        rule.onNodeWithText("Which court hears appeals from state courts?").assertDoesNotExist()

        api.placementGate = null
        api.placement = placementOf(next = typedQuestion())
        rule.mainClock.advanceTimeBy(POLL_MS)

        rule.onNodeWithText("In your own words, what is hearsay?").assertIsDisplayed()
    }

    private companion object {
        const val POLL_MS = 3_500L
    }
}
