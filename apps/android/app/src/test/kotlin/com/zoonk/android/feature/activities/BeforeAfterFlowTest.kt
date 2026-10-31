package com.zoonk.android.feature.activities

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsFocused
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.player.LessonPlayerHarness
import com.zoonk.android.feature.player.checkResult
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class BeforeAfterFlowTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    @get:Rule
    val folder = TemporaryFolder()

    private val harness = LessonPlayerHarness(rule) { folder.newFolder() }

    private fun play(isCorrect: Boolean) =
        harness.play(listOf(ActivityFixtures.step("beforeAfter"))) {
            grade = { _, _ -> checkResult(isCorrect, expected = ActivityFixtures.expected("beforeAfter")) }
        }

    private val after = hasContentDescription("1914")

    @Test
    fun theChangeIsComputedOnceChecked() {
        play(isCorrect = true)

        rule.onNode(after).assertDoesNotExist()
        rule.onNodeWithText("Show after: 1914").performScrollTo().performClick()
        rule.onNode(after).assertIsFocused()
        rule.onNodeWithText("1.5").assertIsDisplayed()

        rule.onNode(hasSetTextAction()).performTextInput("0.12")
        harness.tap("Check")

        rule.onNodeWithText("8.3 times less").performScrollTo().assertIsDisplayed()
    }

    @Test
    fun checkingShowsTheAfterStateEvenUnopened() {
        play(isCorrect = false)

        rule.onNode(hasSetTextAction()).performTextInput("8")
        harness.tap("Check")

        rule.onNode(after).performScrollTo().assertIsDisplayed()
    }
}
