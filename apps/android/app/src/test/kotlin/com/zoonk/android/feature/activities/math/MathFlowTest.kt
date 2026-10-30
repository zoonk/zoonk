package com.zoonk.android.feature.activities.math

import androidx.activity.ComponentActivity
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.click
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performKeyInput
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.pressKey
import androidx.compose.ui.test.requestFocus
import androidx.compose.ui.test.swipeLeft
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.activities.ActivityFixtures
import com.zoonk.android.feature.activities.numericValue
import com.zoonk.android.feature.player.LessonPlayerHarness
import com.zoonk.android.feature.player.checkResult
import com.zoonk.android.feature.player.explanationStep
import com.zoonk.android.feature.player.model.ActivityFrame
import com.zoonk.android.feature.player.model.ActivityStepContent
import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.model.StepContent
import com.zoonk.api.ApiJson
import com.zoonk.api.models.ActivityExpected
import com.zoonk.api.models.LessonStepAnswer
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

/** Main's player tests for the math templates, played in the real player with core's expected end states. */
@RunWith(AndroidJUnit4::class)
@OptIn(ExperimentalTestApi::class)
class MathFlowTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    @get:Rule
    val folder = TemporaryFolder()

    private val harness = LessonPlayerHarness(rule) { folder.newFolder() }

    private fun play(
        steps: List<LessonStep>,
        isCorrect: Boolean,
        expected: ActivityExpected?,
    ) = harness.play(steps) { grade = { _, _ -> checkResult(isCorrect, expected = expected) } }

    private fun play(
        fixture: String,
        isCorrect: Boolean,
    ) = play(listOf(ActivityFixtures.step(fixture)), isCorrect, ActivityFixtures.expected(fixture))

    private val dot =
        hasContentDescription("Your answer on the number line") and SemanticsMatcher.keyIsDefined(SemanticsActions.SetProgress)

    private fun typedValue(text: String) =
        rule.onNode(hasSetTextAction()).assert(SemanticsMatcher.expectValue(SemanticsProperties.EditableText, AnnotatedString(text)))

    private fun sentValue(): Double? =
        (
            harness.api.checks
                .last()
                .second.answer as? LessonStepAnswer.LessonStepAnswerOneOf3Value
        )?.value?.answer.numericValue

    private fun press(
        key: Key,
        times: Int,
        handle: SemanticsMatcher = dot,
    ) {
        rule.onNode(handle).performScrollTo().requestFocus()
        repeat(times) { rule.onNode(handle).performKeyInput { pressKey(key) } }
    }

    @Test
    fun numberLineArrowKeysMoveTheDotToWhereTheChangeLands() {
        play("numberLine", isCorrect = true)

        press(Key.DirectionRight, 8)
        typedValue("5")
        rule.onNode(hasContentDescription("your dot is at 5\u00A0°C.", substring = true)).assertExists()
        harness.tap("Check")

        assertEquals(5.0, sentValue())
        rule.onNode(hasContentDescription("The jumps go +3, +5 and land at 5\u00A0°C.", substring = true)).assertExists()
    }

    @Test
    fun numberLineTakesTalkBacksAdjustActionsOnTheStepGrid() {
        play("numberLine", isCorrect = true)

        rule.onNode(dot).performSemanticsAction(SemanticsActions.SetProgress) { it(1.4f) }
        typedValue("1")
        rule.onNode(dot).assert(SemanticsMatcher.expectValue(SemanticsProperties.StateDescription, "1 °C"))
    }

    @Test
    fun numberLineDragMovesTheDotWithoutTurningTheScreen() {
        play(
            listOf(explanationStep("intro"), ActivityFixtures.step("numberLine")),
            isCorrect = true,
            ActivityFixtures.expected("numberLine"),
        )

        harness.tap("Next")
        rule.onNode(dot).performScrollTo().performTouchInput { swipeLeft(startX = centerX, endX = centerX - 2000f) }

        typedValue("\u22125")
        rule.onNodeWithText("At 7 am it's", substring = true).assertExists()
    }

    @Test
    fun numberLineTapOnTheTrackPlacesTheDot() {
        play("numberLine", isCorrect = true)

        val line =
            rule
                .onNode(hasContentDescription("A number line for", substring = true))
                .fetchSemanticsNode()
                .boundsInRoot
        val handle = rule.onNode(dot).fetchSemanticsNode().boundsInRoot
        val trackEnd = line.right - with(rule.density) { (CANVAS_PADDING + LINE_SIDE).toPx() }
        rule.onNode(dot).performTouchInput { click(Offset(trackEnd - 1f - handle.left, height / 2f)) }

        typedValue("7")
    }

    @Test
    @Config(qualifiers = "pt")
    fun numberLineKeepsACanvasProducedCloseMissDistinctInPortuguese() {
        play(
            listOf(precisionStep()),
            isCorrect = false,
            ApiJson.decodeFromString(ActivityExpected.serializer(), """{"kind":"numeric","value":0.125}"""),
        )

        press(Key.DirectionRight, 4, handle = SemanticsMatcher.keyIsDefined(SemanticsActions.SetProgress))
        typedValue("0,1254")
        harness.tap("Conferir")

        assertEquals(0.1254, sentValue())
        rule
            .onNode(
                hasText("0,1254") and !SemanticsMatcher.keyIsDefined(SemanticsProperties.EditableText),
            ).performScrollTo()
            .assertIsDisplayed()
        rule.onNodeWithText("0,125").performScrollTo().assertIsDisplayed()
    }

    private fun slider(label: String) = hasContentDescription(label) and SemanticsMatcher.keyIsDefined(SemanticsActions.SetProgress)

    private fun described(text: String) = rule.onNode(hasContentDescription(text, substring = true)).assertExists()

    @Test
    fun formulaModelMovingTheRateProducesTheValueToCheck() {
        play("formulaModel", isCorrect = true)

        press(Key.DirectionRight, 4, handle = slider("Rate per year"))
        typedValue("3869.68")
        harness.tap("Check")

        assertEquals(3869.68, sentValue()!!, 0.005)
    }

    @Test
    fun formulaModelCalculatorShowsTheChangeFromTheStart() {
        play("formulaModel.calculator", isCorrect = true)

        press(Key.DirectionRight, 4, handle = slider("Extra per month"))
        typedValue("251.54")
        described("from the start")
    }

    @Test
    fun formulaModelWhatIfAndPriceGiveTheProfit() {
        play("formulaModel.scenario", isCorrect = true)

        rule.onNodeWithText("Rent goes up $500").performScrollTo().performClick()
        rule.onNodeWithText("Rent goes up $500").assertIsSelected()
        press(Key.DirectionRight, 2, handle = slider("Price per cup"))

        typedValue("1000")
        described("$1,500 before")
        described("What-ifs switched on: Rent goes up $500.")
    }

    @Test
    fun formulaModelLeavingTheWhatIfOffGivesAnotherProfit() {
        play("formulaModel.scenario", isCorrect = false)

        press(Key.DirectionRight, 2, handle = slider("Price per cup"))

        typedValue("1500")
    }

    @Test
    fun formulaModelSimulationFindsTheFarthestThrow() {
        play("formulaModel.simulation", isCorrect = true)

        rule.onNodeWithText("Projectile").assertExists()
        described("Peak height:")
        press(Key.DirectionRight, 15, handle = slider("Launch angle"))
        typedValue("40.77")
        press(Key.DirectionLeft, 10, handle = slider("Launch angle"))
        typedValue("38.32")
    }

    @Test
    fun distributionExplorerCoveringTheTargetGivesItsShare() {
        play("distributionExplorer", isCorrect = true)

        press(Key.DirectionLeft, 4, handle = slider("Lower handle"))
        press(Key.DirectionRight, 4, handle = slider("Upper handle"))
        typedValue("95.45")
        harness.tap("Check")

        described("70 to 130: 95.4%")
    }

    @Test
    fun distributionExplorerHandlesKeepAStepBetweenThem() {
        play("distributionExplorer", isCorrect = false)

        rule.onNode(slider("Lower handle")).performSemanticsAction(SemanticsActions.SetProgress) { it(200f) }

        rule
            .onNode(
                slider("Lower handle"),
            ).assert(SemanticsMatcher.expectValue(SemanticsProperties.StateDescription, "105\u00A0IQ points. 11.7% between the handles."))
    }

    @Test
    fun areaModelMovingASplitKeepsTheSameTotal() {
        play("areaModel", isCorrect = true)

        described("Split into 4 parts: 200, 30, 80, 12. Together they make 322\u00A0m².")
        press(Key.DirectionLeft, 3, handle = slider("Split across the width"))
        described("Split into 4 parts: 170, 60, 68, 24.")
        rule.onNodeWithText("322\u00A0m²").performScrollTo().performClick()
        harness.tap("Check")

        assertEquals(1, harness.api.checks.size)
    }

    private fun precisionStep(): LessonStep {
        val json =
            """
            {"template":"numberLine","prompt":"Place it.","check":{"kind":"numeric","question":"What is the value?","answer":0.125,
             "tolerance":{"kind":"absolute","value":0.0001},"explanation":"Worked out by code."},
             "fields":{"label":"Value","min":0.124,"max":0.126,"moves":[{"by":0.0004}],"start":0.125,"step":0.0001}}
            """
        val content = ApiJson.decodeFromString(ActivityStepContent.serializer(), json)
        val frame = ApiJson.decodeFromString(ActivityFrame.serializer(), json)
        return LessonStep("precision", null, StepContent.Activity(content, frame, minTolerance = null))
    }

    private companion object {
        val CANVAS_PADDING = 16.dp
        val LINE_SIDE = 20.dp
    }
}
