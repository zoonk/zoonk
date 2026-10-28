package com.zoonk.android.navigation

import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.AppContainer
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ShellGateTest {
    @get:Rule
    val rule = createComposeRule()

    private lateinit var navigator: AppNavigator
    private var access by mutableStateOf(LearnerAccess.Learner)

    private fun show(route: AppRoute) {
        rule.setContent {
            navigator = rememberAppNavigator()
            ShellGate(route, access, AppContainer(), navigator) { Text("The screen") }
        }
    }

    @Test
    fun aVisitorLogsInOrStartsFree() {
        access = LearnerAccess.Visitor
        show(AppRoute.Session())

        rule.onNodeWithText("Log in to continue").assertIsDisplayed()
        rule.onNodeWithText("Start free").assertIsDisplayed()
        rule.onNodeWithText("The screen").assertDoesNotExist()

        rule.onNodeWithText("Log in").performClick()
        rule.runOnIdle { assertEquals(AppRoute.Login, navigator.currentRoute) }
    }

    @Test
    fun anEndedSessionLogsInAgain() {
        access = LearnerAccess.SessionEnded
        show(AppRoute.Statistics)

        rule.onNodeWithText("Your session ended").assertIsDisplayed()
        rule.onNodeWithText("Log in to pick up your plan.").assertIsDisplayed()
        rule.onNodeWithText("Start something new").performClick()
        rule.runOnIdle { assertEquals(AppRoute.StartGoal(), navigator.currentRoute) }
    }

    @Test
    fun aLearnerWithoutAGoalStartsOneOnGoalPagesOnly() {
        access = LearnerAccess.NoGoal
        show(AppRoute.Plan())

        rule.onNodeWithText("Start with a goal").assertIsDisplayed()

        rule.onNodeWithText("Start a goal").performClick()
        rule.runOnIdle { assertEquals(AppRoute.Today, navigator.currentRoute) }
    }

    @Test
    fun accountPagesOpenWithoutAGoal() {
        access = LearnerAccess.NoGoal
        show(AppRoute.Statistics)

        rule.onNodeWithText("The screen").assertIsDisplayed()
    }

    @Test
    fun theScreenShowsOnceTheLearnerQualifies() {
        access = LearnerAccess.Restoring
        show(AppRoute.Mistakes)

        rule.onNodeWithText("The screen").assertDoesNotExist()
        rule.onNodeWithText("Log in to continue").assertDoesNotExist()

        access = LearnerAccess.SignedIn
        rule.onNodeWithText("The screen").assertIsDisplayed()
    }

    @Test
    fun openPagesNeverGate() {
        access = LearnerAccess.Visitor
        show(AppRoute.Lesson("lesson-1"))

        rule.onNodeWithText("The screen").assertIsDisplayed()
    }
}
