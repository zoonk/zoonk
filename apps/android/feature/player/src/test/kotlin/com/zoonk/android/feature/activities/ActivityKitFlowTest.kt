package com.zoonk.android.feature.activities

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.junit4.StateRestorationTester
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.player.LessonPlayerHarness
import com.zoonk.android.feature.player.checkResult
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
    fun aCanvasAnswerComesBackAfterAndroidClosesTheAppInTheBackground() {
        val restoration = StateRestorationTester(rule)
        harness.play(listOf(ActivityFixtures.step("decisionTree")), restoration = restoration) {
            grade = { _, _ -> checkResult(true, expected = ActivityFixtures.expected("decisionTree")) }
        }
        tap("Needles")
        tap("In bundles")

        harness.viewModel = harness.openAgain()
        restoration.emulateSavedInstanceStateRestore()

        rule.onNodeWithText("Check").assertIsEnabled()
        harness.tap("Check")
        shows("It leads to Pine.")
    }

    /** A missed check that comes back starts a new round, which Android keeps when it closes the app, so its path and answer come back together. */
    @Test
    fun aCanvasInALaterRoundComesBackWholeAfterAndroidClosesTheAppInTheBackground() {
        val restoration = StateRestorationTester(rule)
        harness.play(listOf(ActivityFixtures.step("decisionTree", id = TREE)), restoration = restoration) {
            grade = { _, _ -> checkResult(false, expected = ActivityFixtures.expected("decisionTree")) }
        }
        tap("Needles")
        tap("In bundles")
        harness.tap("Check")
        harness.tap("Continue")
        tap("Needles")
        tap("In bundles")

        // The server has the missed check, so the run it resumes is rebuilt from it.
        harness.api.runAnswers = """[{"answeredAt":"2026-10-28T10:01:00Z","isCorrect":false,"stepId":"$TREE"}]"""
        harness.viewModel = harness.openAgain()
        restoration.emulateSavedInstanceStateRestore()

        rule.onNodeWithContentDescription("Your answers").assertExists()
        rule.onNodeWithText("Check").assertIsEnabled()
    }

    private companion object {
        const val TREE = "00000000-0000-4000-8000-000000000201"
    }
}
