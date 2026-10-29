package com.zoonk.android.feature.activities

import androidx.activity.ComponentActivity
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsOn
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performKeyInput
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.pressKey
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

    private fun play(
        fixture: String,
        isCorrect: Boolean,
    ) = harness.play(listOf(ActivityFixtures.step(fixture))) {
        grade = { _, _ -> checkResult(isCorrect, expected = ActivityFixtures.expected(fixture)) }
    }

    private fun tap(text: String) = rule.onNodeWithText(text).performScrollTo().performClick()

    private fun shows(text: String) = rule.onNodeWithText(text, substring = true).performScrollTo().assertIsDisplayed()

    @Test
    fun chartReaderMeasuresATappedSpan() {
        play("chartReader", isCorrect = true)

        tap("2010 to 2020")
        rule.onNodeWithText("2010 to 2020").assertIsOn()
        rule.onNode(hasContentDescription("2010 to 2020: +", substring = true)).assertExists()
        tap("24 ppm")
        harness.tap("Check")

        rule.onNodeWithText("2010 to 2020").assertIsOn()
    }

    @Test
    fun decisionTreeFollowsTheCaseToItsOutcome() {
        play("decisionTree", isCorrect = true)

        shows("Oak")
        tap("Needles")
        rule.onNodeWithText("Oak").assertDoesNotExist()
        tap("In bundles")
        shows("The key leads to")
        harness.tap("Check")

        shows("It leads to Pine.")
    }

    @Test
    fun decisionTreeUndoesAStepAndShowsAWrongBranch() {
        play("decisionTree", isCorrect = false)

        tap("Broad leaves")
        tap("Undo")
        tap("Needles")
        tap("Single")
        harness.tap("Check")

        shows("You chose Single")
    }

    @Test
    fun findErrorShowsTheFixOfTheWrongStep() {
        play("findError", isCorrect = true)

        rule.onNode(hasContentDescription("Step 2: Down 20%", substring = true)).performClick()
        harness.tap("Check")

        shows("120 × 0.8 = 96, not 100.")
    }

    @OptIn(ExperimentalTestApi::class)
    @Test
    fun findErrorPointsToTheWrongStepAndTakesNumberKeys() {
        play("findError", isCorrect = false)

        rule.onRoot().performKeyInput { pressKey(Key.Three) }
        rule.onNode(hasContentDescription("Step 3: So the price", substring = true)).assertIsSelected()
        harness.tap("Check")

        shows("The wrong step is step 2.")
    }

    @Test
    fun stepSolverExplainsAWrongMoveAndGradesTheFirstPick() {
        play("stepSolver", isCorrect = false)

        tap("Add the tax")
        shows("Not quite:")
        tap("Take 25% off")
        tap("$45")
        harness.tap("Check")

        shows("Your first pick: Add the tax")
    }

    @Test
    fun patternTableTakesAnEndingForEachBlank() {
        play("patternTable", isCorrect = true)

        shows("Which ending does vosotros take?")
        tap("-éis")
        shows("Which ending does ellos, ustedes take?")
        tap("-en")
        harness.tap("Check")

        rule.onNodeWithText("Which ending does", substring = true).assertDoesNotExist()
    }

    @Test
    fun patternTableShowsTheRightFormOfAWrongEnding() {
        play("patternTable", isCorrect = false)

        tap("-áis")
        tap("-en")
        harness.tap("Check")

        rule.onNode(hasContentDescription("Correct answer: coméis", substring = true)).assertExists()
    }

    @Test
    fun dialogueSaysWhyForEveryReply() {
        play("dialogueSimulator", isCorrect = false)

        shows("Buenos días, dígame.")
        tap("Dame algo para la garganta.")
        harness.tap("Check")

        shows("No greeting and a bare command sound rude to a stranger.")
        shows("Good morning. Do you have anything for a sore throat?")
    }
}
