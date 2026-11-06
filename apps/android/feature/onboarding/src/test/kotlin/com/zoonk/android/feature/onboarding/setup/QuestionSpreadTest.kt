package com.zoonk.android.feature.onboarding.setup

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsFocused
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.assertTextContains
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.StateRestorationTester
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.window.testing.layout.WindowLayoutInfoPublisherRule
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.SignInResult
import com.zoonk.android.feature.exam.FakeMockApi
import com.zoonk.android.feature.mock.MockStore
import com.zoonk.android.feature.onboarding.FakeOnboardingApi
import com.zoonk.android.feature.onboarding.GOAL_ID
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.placementOf
import com.zoonk.android.feature.onboarding.setupView
import com.zoonk.android.feature.onboarding.typedQuestion
import com.zoonk.android.feature.plan.FakePlanApi
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.scaffold.closeBook
import com.zoonk.android.ui.scaffold.unfoldBook
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

/**
 * A placement question spreads across an open book's fold, its answer on the page after it. An answer not yet
 * confirmed stays as the book opens, closes (which recreates the screen) and opens again.
 */
@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w852dp-h883dp")
class QuestionSpreadTest {
    @get:Rule(order = 0)
    val folds = WindowLayoutInfoPublisherRule()

    @get:Rule(order = 1)
    val rule = createAndroidComposeRule<ComponentActivity>()

    private val api = FakeOnboardingApi().apply { setup = { setupView(listOf("placement", "plan")) } }
    private val restoration = StateRestorationTester(rule)

    private fun showQuestion() {
        val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
        val cache = AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate))
        val store = OnboardingStore(api, cache, session) { SignInResult.SignedIn }
        restoration.setContent {
            ZoonkTheme {
                GoalSetupScreen(
                    AppRoute.GoalSetup(GOAL_ID),
                    store,
                    PlanStore(FakePlanApi(), cache),
                    MockStore(FakeMockApi(options = null), cache),
                    isGuest = false,
                    rememberAppNavigator(),
                )
            }
        }
        rule.onNodeWithText("Start").performScrollTo().performClick()
        rule.waitForIdle()
    }

    private fun open() = rule.unfoldBook(folds)

    private fun close() = rule.closeBook(folds)

    /** Android recreates the screen as the book folds; window-testing tells the new one of no fold. */
    private fun recreate() {
        restoration.emulateSavedInstanceStateRestore()
        rule.waitForIdle()
    }

    @Test
    fun aPickStaysPickedAsTheBookOpensClosesAndOpensAgain() {
        showQuestion()
        rule.onNodeWithText("A district court").performScrollTo().performClick()

        for (change in listOf(::open, ::close, ::open, ::recreate, ::open)) {
            change()
            rule.onNodeWithText("A district court").assertIsSelected()
            rule.onNodeWithText("Confirm").assertIsEnabled()
        }
    }

    @Test
    fun typedWordsStayWithTheirFocusAsTheBookOpensClosesAndOpensAgain() {
        api.placement = placementOf(next = typedQuestion())
        showQuestion()
        rule.onNode(hasSetTextAction()).performTextInput("Something said outside court")

        for (change in listOf(::open, ::close, ::open, ::recreate, ::open)) {
            change()
            rule.onNode(hasSetTextAction()).assertTextContains("Something said outside court").assertIsFocused()
            rule.onNodeWithText("Confirm").assertIsEnabled()
        }
    }
}
