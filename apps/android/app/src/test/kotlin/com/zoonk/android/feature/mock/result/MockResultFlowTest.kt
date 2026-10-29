package com.zoonk.android.feature.mock.result

import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.mock.runner.FakeMockRunApi
import com.zoonk.android.feature.mock.runner.MockRunStore
import com.zoonk.android.feature.mock.runner.MockScreen
import com.zoonk.android.feature.mock.runner.RUN_BLOCK
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.MockExam
import com.zoonk.api.models.MockPlanOfferInput
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class MockResultFlowTest {
    @get:Rule
    val rule: ComposeContentTestRule = createComposeRule()

    @get:Rule
    val folder = TemporaryFolder()

    private lateinit var navigator: AppNavigator

    private fun show(
        mock: MockExam,
        route: AppRoute.Mock = AppRoute.Mock(RUN_BLOCK),
    ): FakeMockRunApi {
        val api = FakeMockRunApi(mock)
        rule.setContent {
            ZoonkTheme {
                val context = LocalContext.current
                val app = remember { AppContainer.preview(context) }
                val scope = remember { CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate) }
                val store =
                    remember {
                        MockRunStore(
                            api,
                            AppCache(FakeSession(AuthenticatedSession("ana", "token", "local")), scope),
                            DraftStore(folder.root, scope),
                        ) {
                            "UTC"
                        }
                    }
                navigator = rememberAppNavigator()
                MockScreen(route, app, navigator, store)
            }
        }
        return api
    }

    @Test
    fun rightAnswersReadAsRightAnswers() {
        show(finishedMock())

        rule.onNodeWithText("Mock exam 3 done").assertIsDisplayed()
        rule.onNodeWithText("1 of 3").assertIsDisplayed()
        rule.onNodeWithText("Right answers · ENEM · Mathematics, Languages").assertIsDisplayed()
    }

    @Test
    fun aNetScoreReadsNetOfPenaltiesWithItsChange() {
        show(finishedMock(result = result(scoring = "net", extra = NET)))

        rule.onNodeWithText("41.5").assertIsDisplayed()
        rule.onNode(hasText("Net score out of 120", substring = true)).assertIsDisplayed()
        rule.onNodeWithText("+7 since the last one").assertIsDisplayed()
        rule.onNodeWithText("Wrong").assertIsDisplayed()
    }

    @Test
    fun anEstimatedScoreReadsAsARangeOnTheExamsScale() {
        show(finishedMock(result = result(scoring = "irt", extra = IRT)))

        rule.onNodeWithText("610–680").assertIsDisplayed()
        rule.onNode(hasText("Estimated score", substring = true)).assertIsDisplayed()
        rule.onNodeWithText("+33 since the last one").assertIsDisplayed()
    }

    @Test
    fun aPlanOfferChangesThePlanOnlyOnYes() {
        val api = show(finishedMock(extra = """"adapt":$SKIP_OFFER"""))

        rule.onNodeWithText("Continue").performClick()
        rule.onNodeWithText("You got everything right in 2 topics").assertIsDisplayed()
        rule.onNodeWithText("Keep my plan").performClick()
        rule.waitForIdle()

        assertEquals(emptyList<MockPlanOfferInput.Offer>(), api.offers)
        rule.onNodeWithText("Your plan stays as it is.").assertIsDisplayed()
    }

    @Test
    fun applyingAnOfferSaysWhatChanged() {
        val api = show(finishedMock(extra = """"adapt":$SKIP_OFFER"""))

        rule.onNodeWithText("Continue").performClick()
        rule.onNodeWithText("Apply").performClick()
        rule.waitForIdle()

        assertEquals(listOf(MockPlanOfferInput.Offer.SKIP), api.offers)
        rule.onNodeWithText("Done: 3 lessons off your plan.").assertIsDisplayed()
    }

    @Test
    fun mistakesAreReviewedInTheNotebook() {
        show(finishedMock(extra = """"review":[$MISSED]"""))

        rule.onNodeWithText("Continue").performClick()
        rule.onNodeWithText("1 mistake to review").assertIsDisplayed()
        rule.onNodeWithText("Review the mistake").performClick()
        rule.waitForIdle()

        assertEquals(AppRoute.Mistakes, navigator.currentRoute)
    }

    @Test
    fun continueLeadsBackToTheSessionItWasPlayedIn() {
        show(finishedMock(extra = """"purpose":"planned""""), AppRoute.Mock(RUN_BLOCK, sessionId = "session-1"))

        rule.onNodeWithText("Continue").performClick()
        rule.waitForIdle()

        assertEquals(AppRoute.Session(), navigator.currentRoute)
    }

    @Test
    fun continueLeadsToTodayOtherwise() {
        show(finishedMock())

        rule.onNodeWithText("Continue").performClick()
        rule.waitForIdle()

        assertEquals(AppRoute.Today, navigator.currentRoute)
    }

    @Test
    fun aPlacementMockLeadsBackToOnboardingsPlan() {
        show(finishedMock(extra = """"purpose":"placement","review":[$MISSED]"""))

        rule.onNodeWithText("See my plan").performClick()
        rule.waitForIdle()

        assertEquals(AppRoute.GoalSetup(GOAL), navigator.currentRoute)
    }
}
