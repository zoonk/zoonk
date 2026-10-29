package com.zoonk.android.feature.activities.reasoning

import androidx.activity.ComponentActivity
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.click
import androidx.compose.ui.test.hasAnyAncestor
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.percentOffset
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performCustomAccessibilityActionWithLabel
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performTouchInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.activities.ActivityFixtures
import com.zoonk.android.feature.activities.gridCells
import com.zoonk.android.feature.activities.selectionIds
import com.zoonk.android.feature.player.LessonPlayerHarness
import com.zoonk.android.feature.player.checkResult
import com.zoonk.api.models.LessonStepAnswer
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

/** Main's player tests for the reasoning templates, played in the real player with core's expected end states. */
@OptIn(ExperimentalTestApi::class)
@RunWith(AndroidJUnit4::class)
class ReasoningFlowTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    @get:Rule
    val folder = TemporaryFolder()

    private val harness = LessonPlayerHarness(rule) { folder.newFolder() }

    private var sent: List<String>? = null
    private var picked: List<String>? = null

    private fun play(
        fixture: String,
        isCorrect: Boolean,
    ) = harness.play(listOf(ActivityFixtures.step(fixture))) {
        grade = { _, input ->
            val answer = (input.answer as? LessonStepAnswer.LessonStepAnswerOneOf3Value)?.value?.answer
            sent = answer.gridCells
            picked = answer.selectionIds
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

    private val regulars = hasContentDescription("The regulars fired on us without any provocation.")
    private val rebels = hasContentDescription("Some of the rebels fired first from behind a wall.")

    private fun states(state: String) = SemanticsMatcher.expectValue(SemanticsProperties.StateDescription, state)

    @Test
    fun sourceComparisonMarkingBothClaimsSendsThem() {
        play("sourceComparison", isCorrect = true)

        rule.onNode(regulars).performScrollTo().performCustomAccessibilityActionWithLabel("Mark: The regulars fired on us")
        rule.onNode(rebels).performScrollTo().performCustomAccessibilityActionWithLabel("Mark: the rebels fired first")
        rule.onNode(rebels).assert(states("You marked: the rebels fired first."))
        harness.tap("Check")

        assertEquals(listOf("p1", "p2"), picked)
    }

    @Test
    fun sourceComparisonATapMarksAPassageAndCheckingNamesTheOneMissed() {
        play("sourceComparison", isCorrect = false)

        rule.onNode(regulars).performScrollTo().performTouchInput { click(percentOffset(0.05f, 0.25f)) }
        rule.onNode(regulars).assert(states("You marked: The regulars fired on us."))
        harness.tap("Check")

        rule.onNode(rebels).performScrollTo().assert(states("Nothing marked yet. Missed: the rebels fired first."))
    }

    @Test
    fun mapExplorerTappingPlacesUncoversWhatIsThere() {
        play("mapExplorer", isCorrect = true)

        rule.onNode(hasContentDescription("2. Brewery on Broad Street")).performScrollTo().performClick()
        shows("Over 70 workers and no cholera deaths")
        rule.onNode(hasContentDescription("3. Poland Street workhouse")).performScrollTo().performClick()
        shows("535 people lived here")
        shows("2 of 3 explored")
        tap("Their water didn't come from the Broad Street pump")
        harness.tap("Check")
    }

    @Test
    fun mapExplorerListsItsPlacesForKeyboardAndTalkBack() {
        play("mapExplorer", isCorrect = false)

        rule.onNode(hasText("Broad Street pump") and hasAnyAncestor(hasContentDescription("Places"))).performScrollTo().performClick()
        shows("Most of the deaths were in houses a few streets from this pump.")
        rule.onNode(hasContentDescription("1. Broad Street pump")).assertIsSelected()
        shows("1 of 3 explored")
    }

    private fun candidate(text: String) = rule.onNode(hasText(text, substring = true) and hasClickAction())

    @Test
    fun argumentBuilderTheStrongQuoteAndReasoningAreRight() {
        play("argumentBuilder", isCorrect = true)

        candidate("It is too rash").performScrollTo().performClick()
        candidate("Juliet herself").performScrollTo().performClick()
        shows("Your argument is ready.")
        harness.tap("Check")

        assertEquals(listOf("e1", "r1"), picked)
        shows("It names the speed.")
    }

    @Test
    fun argumentBuilderAWeakQuoteNamesTheStrongerOne() {
        play("argumentBuilder", isCorrect = false)

        candidate("O brawling love").performScrollTo().performClick()
        rule.onNode(hasContentDescription("Take the quote out")).performClick()
        candidate("O brawling love").performScrollTo().performClick()
        candidate("Juliet herself").performScrollTo().performClick()
        harness.tap("Check")

        shows("Stronger evidence")
        shows("It is about Rosaline.")
    }

    @Test
    @Config(qualifiers = "w411dp-h1400dp")
    fun argumentBuilderTakesAQuoteDraggedOntoTheEvidence() {
        play("argumentBuilder", isCorrect = true)

        val quote = candidate("It is too rash")
        val from = quote.fetchSemanticsNode().boundsInRoot
        val slot = rule.onNode(hasText("Pick the quote that best supports the claim")).fetchSemanticsNode().boundsInRoot
        quote.performTouchInput {
            down(center)
            advanceEventTime(viewConfiguration.longPressTimeoutMillis + 100)
            moveBy((slot.center - from.center) / 2f)
            moveBy((slot.center - from.center) / 2f)
            up()
        }

        rule.onNode(hasContentDescription("Take the quote out")).assertExists()
        shows("Pick how the quote proves the claim")
    }
}
