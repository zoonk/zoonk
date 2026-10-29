package com.zoonk.android.feature.account

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class VisitorWelcomeTest {
    @get:Rule
    val rule: ComposeContentTestRule = createComposeRule()

    private lateinit var navigator: AppNavigator

    @Before
    fun show() {
        rule.setContent {
            ZoonkTheme {
                navigator = rememberAppNavigator()
                VisitorWelcome(navigator, PaddingValues())
            }
        }
    }

    @Test
    fun typedGoalStartsIt() {
        rule.onNode(hasSetTextAction()).performTextInput("  pass the bar exam ")
        rule.onNodeWithText("Build my plan").performClick()

        assertEquals(AppRoute.StartGoal(goal = "pass the bar exam"), navigator.currentRoute)
    }

    @Test
    fun emptyBoxAsksForWordsInsteadOfStarting() {
        rule.onNodeWithText("Build my plan").performClick()

        rule.onNodeWithText("Write your goal in the box first, in your own words.").assertIsDisplayed()
        assertEquals(AppRoute.Today, navigator.currentRoute)
    }

    @Test
    fun exampleStartsThatGoal() {
        rule.onNodeWithText("Understand quantum physics").performScrollTo().performClick()

        assertEquals(AppRoute.StartGoal(goal = "Understand quantum physics"), navigator.currentRoute)
    }
}
