package com.zoonk.android.feature.activities.reasoning

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasAnyAncestor
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.activities.ActivityFixtures
import com.zoonk.android.feature.activities.gridCells
import com.zoonk.android.feature.player.LessonPlayerHarness
import com.zoonk.android.feature.player.checkResult
import com.zoonk.api.models.LessonStepAnswer
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith

/** Main's player tests for the reasoning templates, played in the real player with core's expected end states. */
@RunWith(AndroidJUnit4::class)
class ReasoningFlowTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    @get:Rule
    val folder = TemporaryFolder()

    private val harness = LessonPlayerHarness(rule) { folder.newFolder() }

    private var sent: List<String>? = null

    private fun play(
        fixture: String,
        isCorrect: Boolean,
    ) = harness.play(listOf(ActivityFixtures.step(fixture))) {
        grade = { _, input ->
            sent = (input.answer as? LessonStepAnswer.LessonStepAnswerOneOf3Value)?.value?.answer.gridCells
            checkResult(isCorrect, expected = ActivityFixtures.expected(fixture))
        }
    }

    private fun tap(text: String) = rule.onNodeWithText(text).performScrollTo().performClick()

    private fun shows(text: String) = rule.onNodeWithText(text, substring = true).performScrollTo().assertIsDisplayed()

    private fun fillSquare(values: List<String>) =
        values.forEachIndexed { index, value ->
            rule
                .onNode(hasText(value) and hasClickAction() and hasAnyAncestor(hasContentDescription(squareQuestion(index + 1, value))))
                .performScrollTo()
                .performClick()
        }

    private fun squareQuestion(
        square: Int,
        value: String,
    ) = if (value.all(Char::isLetter)) "Which genotype goes in square $square?" else "What goes in square $square?"

    @Test
    fun punnettFillingTheSquareAnswersTheShareOfWhiteFlowers() {
        play("combinationGrid", isCorrect = true)

        fillSquare(listOf("Pp", "Pp", "pp", "pp"))
        shows("Purple: 2 of 4 · White: 2 of 4")
        tap("1 in 2")
        harness.tap("Check")

        shows("2 of 4 squares: White")
    }

    @Test
    fun timesTableFillingEveryProductSendsTheFill() {
        val products = listOf("2", "4", "6", "3", "6", "9", "4", "8", "12")
        play("combinationGrid.timesTable", isCorrect = true)

        fillSquare(products)
        shows("9 of 9 squares filled")
        harness.tap("Check")

        assertEquals(products, sent)
        shows("9 of 9 squares right")
    }

    @Test
    fun timesTableShowsTheLearnersWrongSquareStruckOut() {
        play("combinationGrid.timesTable", isCorrect = false)

        fillSquare(listOf("2", "4", "6", "3", "6", "9", "4", "8", "8"))
        harness.tap("Check")

        shows("8 of 9 squares right")
        rule.onNode(hasContentDescription("12. Your answer: 8")).performScrollTo().assertIsDisplayed()
    }

    @Test
    fun twoDiceAreShownFilledToReadThenTheSevensAreCounted() {
        play("combinationGrid.dice", isCorrect = true)

        rule.onNodeWithText("goes in square", substring = true).assertDoesNotExist()
        rule.onNode(hasSetTextAction()).performTextInput("0.1667")
        harness.tap("Check")

        shows("6 of 36 squares: 7")
    }
}
