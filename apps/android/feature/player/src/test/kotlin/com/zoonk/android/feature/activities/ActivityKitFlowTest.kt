package com.zoonk.android.feature.activities

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertHasClickAction
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.StateRestorationTester
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.player.LessonPlayerHarness
import com.zoonk.android.feature.player.checkResult
import com.zoonk.android.feature.player.runAnswerJson
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith

/** Main's player tests for the kit's templates, played in the real player with core's expected end states. */
@RunWith(AndroidJUnit4::class)
class ActivityKitFlowTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    @get:Rule
    val folder = TemporaryFolder()

    private val harness = LessonPlayerHarness(rule) { folder.newFolder() }

    private fun tap(text: String) = rule.onNodeWithText(text).performScrollTo().performClick()

    private fun shows(text: String) = rule.onNodeWithText(text, substring = true).performScrollTo().assertIsDisplayed()

    @Test
    fun aPartialCanvasComesBackAfterAndroidClosesTheAppInTheBackground() {
        val restoration = StateRestorationTester(rule)
        harness.play(listOf(ActivityFixtures.step("stepSolver")), restoration = restoration) {
            grade = { _, _ -> checkResult(true, expected = ActivityFixtures.expected("stepSolver")) }
        }
        tap("Take 25% off")

        harness.viewModel = harness.openAgain()
        restoration.emulateSavedInstanceStateRestore()

        rule.onNodeWithContentDescription("Step 2 of 2.").assertExists()
        rule.onNodeWithText("Check").assertIsNotEnabled()
        tap("$45")
        rule.onNodeWithText("Check").assertIsEnabled()
        harness.tap("Check")
        shows("You pay tax on what you pay.")
    }

    @Test
    fun aCanvasInALaterRoundComesBackWholeAfterAndroidClosesTheAppInTheBackground() {
        val restoration = StateRestorationTester(rule)
        harness.play(listOf(ActivityFixtures.step("stepSolver", id = ACTIVITY)), restoration = restoration) {
            grade = { _, _ -> checkResult(false, expected = ActivityFixtures.expected("stepSolver")) }
        }
        tap("Take 25% off")
        tap("$45")
        harness.tap("Check")
        harness.tap("Continue")
        tap("Take 25% off")

        // The server has the missed check, so the run it resumes is rebuilt from it.
        harness.api.runAnswers = "[${runAnswerJson(ACTIVITY, isCorrect = false)}]"
        harness.viewModel = harness.openAgain()
        restoration.emulateSavedInstanceStateRestore()

        rule.onNodeWithContentDescription("Step 2 of 2.").assertExists()
        rule.onNodeWithText("Check").assertIsNotEnabled()
        tap("$45")
        rule.onNodeWithText("Check").assertIsEnabled()
    }

    @Test
    fun aMissedChecksRetryStartsOverAfterAndroidClosesTheAppOnItsFeedback() {
        val restoration = StateRestorationTester(rule)
        harness.play(listOf(ActivityFixtures.step("stepSolver", id = ACTIVITY)), restoration = restoration) {
            grade = { _, _ -> checkResult(false, expected = ActivityFixtures.expected("stepSolver")) }
        }
        tap("Take 25% off")
        tap("$45")
        harness.tap("Check")

        harness.api.runAnswers = "[${runAnswerJson(ACTIVITY, isCorrect = false)}]"
        harness.viewModel = harness.openAgain()
        restoration.emulateSavedInstanceStateRestore()

        rule.onNodeWithContentDescription("Step 1 of 2.").assertExists()
        rule.onNodeWithText("Take 25% off").assertHasClickAction()
        rule.onNodeWithText("Check").assertIsNotEnabled()
    }

    private companion object {
        const val ACTIVITY = "00000000-0000-4000-8000-000000000201"
    }
}
