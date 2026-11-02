package com.zoonk.android.feature.player

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlinx.coroutines.CompletableDeferred
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ExampleLineFlowTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    @get:Rule
    val folder = TemporaryFolder()

    private val harness = LessonPlayerHarness(rule) { folder.newFolder() }
    private val api get() = harness.api

    private val discount = "At the pharmacy where you work, 25% off a \$40 kit saves \$10."

    @Test
    fun writesTheLessonsExamplesFromTheLearnersFirstMoveNeverFromItsOpening() {
        val writing = CompletableDeferred<Unit>()

        harness.play(
            listOf(
                explanationStep("intro"),
                explanationStep("discount", exampleIdea = "A discount on something the learner buys."),
                explanationStep("interest", exampleIdea = "Interest on an installment plan the learner pays."),
                summaryStep("end"),
            ),
        ) {
            linesToWrite = mapOf("discount" to discount)
            linesGate = writing
        }

        rule.onNodeWithText("Idea intro").assertIsDisplayed()
        assertEquals(emptyList<String>(), api.lineWrites)
        harness.tap("Next")

        rule.onNodeWithText("Idea discount").assertIsDisplayed()
        assertEquals(listOf("discount"), api.lineWrites)
        assertEquals(emptyList<String>(), api.lineReads)
        rule.onNodeWithContentDescription("Your example").assertDoesNotExist()

        writing.complete(Unit)
        rule.waitUntil { rule.onAllNodesWithText(discount).fetchSemanticsNodes().isNotEmpty() }
        assertEquals(listOf("discount"), api.lineReads)
        harness.tap("Next")

        rule.onNodeWithText("Idea interest").assertIsDisplayed()
        rule.waitUntil { "interest" in api.lineReads }
        rule.onNodeWithContentDescription("Your example").assertDoesNotExist()
        assertEquals(listOf("discount"), api.lineWrites)
    }

    @Test
    fun readsTheLinesAgainWhenTheWritesResponseIsLostAndNeverAsksAgain() {
        harness.play(
            listOf(
                explanationStep("discount", exampleIdea = "A discount on something the learner buys."),
                explanationStep("interest", exampleIdea = "Interest on an installment plan the learner pays."),
                summaryStep("end"),
            ),
        ) {
            linesToWrite = mapOf("discount" to discount)
            linesResponseLost = true
        }

        rule.waitUntil { "discount" in api.lineReads }
        rule.onNodeWithContentDescription("Your example").assertDoesNotExist()
        harness.tap("Next")

        rule.onNodeWithText("Idea interest").assertIsDisplayed()
        rule.waitUntil { "interest" in api.lineReads }
        rule.onNodeWithContentDescription("Previous screen").performClick()

        rule.waitUntil { rule.onAllNodesWithText(discount).fetchSemanticsNodes().isNotEmpty() }
        harness.tap("Next")
        rule.onNodeWithText("Idea interest").assertIsDisplayed()
        assertEquals(listOf("discount"), api.lineWrites)
    }
}
