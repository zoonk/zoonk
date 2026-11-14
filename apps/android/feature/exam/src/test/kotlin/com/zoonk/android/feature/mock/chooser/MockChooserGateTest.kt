package com.zoonk.android.feature.mock.chooser

import androidx.activity.ComponentActivity
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.isSelectable
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performKeyInput
import androidx.compose.ui.test.pressKey
import androidx.compose.ui.test.requestFocus
import androidx.navigation3.runtime.NavBackStack
import androidx.navigation3.runtime.NavKey
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.exam.GOAL
import com.zoonk.android.feature.exam.mockOptions
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** A free learner's Start turns into Subscribe; Enter does what the bar's button says, and a purchase lifts the gate. */
@RunWith(AndroidJUnit4::class)
@OptIn(ExperimentalTestApi::class)
class MockChooserGateTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private val view = mutableStateOf(mockOptions(""""access":"plusRequired""""))
    private val navigator =
        AppNavigator(
            stacks = AppTab.entries.associateWith { NavBackStack<NavKey>(it.root) },
            selected = mutableStateOf(AppTab.Today),
            tasks = NavBackStack(),
            openWebPage = {},
        )

    private fun show() {
        val session = FakeSession(AuthenticatedSession("ana", "token", "local"))
        val cache = AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate))
        val viewModel = MockChooserViewModel(GOAL, MockStarter(FakeMockStartApi(), cache), session) { ReadyRuns() }
        rule.setContent { ZoonkTheme { PracticeChooser(view.value, viewModel, navigator, rememberLazyListState()) } }
        rule.onAllNodes(isSelectable()).onFirst().performClick()
        rule.onNodeWithText("Start").performClick()
    }

    @Test
    fun enterOnTheGateOpensTheSubscription() {
        show()

        rule.onNodeWithText("Subscribe").requestFocus().performKeyInput { pressKey(Key.Enter) }

        rule.runOnIdle { assertEquals(AppRoute.Subscription, navigator.currentRoute) }
    }

    @Test
    fun aPurchaseLiftsTheGateAndKeepsThePick() {
        show()
        rule.onNodeWithText("Subscribe").assertExists()

        view.value = mockOptions("")

        rule.onNodeWithText("Subscribe").assertDoesNotExist()
        rule.onNodeWithText("Start").assertIsEnabled()
    }
}
