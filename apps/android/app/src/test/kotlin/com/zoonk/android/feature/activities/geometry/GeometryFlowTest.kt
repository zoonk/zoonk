package com.zoonk.android.feature.activities.geometry

import androidx.activity.ComponentActivity
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.click
import androidx.compose.ui.test.hasAnyAncestor
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.StateRestorationTester
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performKeyInput
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performTextReplacement
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.pressKey
import androidx.compose.ui.test.swipe
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.activities.ActivityFixtures
import com.zoonk.android.feature.player.LessonPlayerHarness
import com.zoonk.android.feature.player.checkResult
import com.zoonk.api.ApiJson
import com.zoonk.api.models.LessonStepAnswer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
class GeometryFlowTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    @get:Rule
    val folder = TemporaryFolder()

    private val harness = LessonPlayerHarness(rule) { folder.newFolder() }

    private fun play(
        fixture: String,
        isCorrect: Boolean,
        restoration: StateRestorationTester? = null,
    ) = harness.play(listOf(ActivityFixtures.step(fixture)), restoration = restoration) {
        grade = { _, _ -> checkResult(isCorrect, expected = ActivityFixtures.expected(fixture)) }
    }

    private fun handle(name: String): SemanticsNodeInteraction = rule.onNodeWithContentDescription(name).performScrollTo()

    @OptIn(ExperimentalTestApi::class)
    private fun SemanticsNodeInteraction.press(
        key: Key,
        times: Int = 1,
    ) = apply {
        performSemanticsAction(SemanticsActions.RequestFocus)
        repeat(times) { performKeyInput { pressKey(key) } }
    }

    private fun SemanticsNodeInteraction.act(label: String) {
        val action = fetchSemanticsNode().config[SemanticsActions.CustomActions].single { it.label == label }
        rule.runOnIdle { action.action() }
    }

    private fun shows(text: String) = rule.onNodeWithText(text, substring = true).performScrollTo().assertIsDisplayed()

    private fun SemanticsNodeInteraction.state(): String? = fetchSemanticsNode().config.getOrNull(SemanticsProperties.StateDescription)

    private fun typedAnswer() =
        rule
            .onNode(hasSetTextAction())
            .fetchSemanticsNode()
            .config
            .getOrNull(SemanticsProperties.EditableText)
            ?.text

    @Test
    fun unitCircleTurnedToTheChecksAngleAnswersIt() {
        play("unitCircle", isCorrect = true)

        handle(POINT).press(Key.DirectionRight, times = 6)
        assertEquals("0.5", typedAnswer())
        harness.tap("Check")

        rule.onNode(hasContentDescription("The question asks about 30°, where sin = 0.5.", substring = true)).assertExists()
        handle(POINT).assertIsNotEnabled()
    }

    @Test
    fun unitCircleReadAtAnotherAngleIsWrong() {
        play("unitCircle", isCorrect = false)

        handle(POINT).press(Key.DirectionRight, times = 3)
        assertEquals("15°. sin = 0.26, cos = 0.97", handle(POINT).state())
        harness.tap("Check")

        rule.onNode(hasText("Not quite", substring = true)).assertExists()
    }

    @Test
    fun unitCircleTurnsByTapTalkBackAndDrag() {
        play("unitCircle", isCorrect = true)

        val point = handle(POINT).fetchSemanticsNode().boundsInRoot.center
        val dial =
            Offset(
                rule
                    .onRoot()
                    .fetchSemanticsNode()
                    .size.width / 2f,
                point.y,
            )
        rule.onRoot().performTouchInput { click(dial - Offset(0f, (point.x - dial.x) / 2)) }
        assertEquals("1", typedAnswer())

        handle(POINT).performSemanticsAction(SemanticsActions.SetProgress) { it(30f) }
        assertEquals("0.5", typedAnswer())

        handle(POINT).performTouchInput {
            down(center)
            moveBy(Offset(-width * 2f, 0f))
            up()
        }
        assertEquals(false, handle(POINT).state()?.startsWith("30°"))
    }

    @Test
    fun unitCircleTurnedToTheSameAngleAnswersWithItsValueAgain() {
        play("unitCircle", isCorrect = true)

        handle(POINT).performSemanticsAction(SemanticsActions.SetProgress) { it(30f) }
        rule.onNode(hasSetTextAction()).performTextReplacement("0.25")
        handle(POINT).performSemanticsAction(SemanticsActions.SetProgress) { it(30f) }

        assertEquals("0.5", typedAnswer())
    }

    @Test
    @Config(qualifiers = "ldrtl")
    fun unitCircleKeepsItsPointOnTheDrawingRightToLeft() {
        play("unitCircle", isCorrect = true)

        val point = handle(POINT).fetchSemanticsNode().boundsInRoot.center
        assertTrue(
            point.x > rule
                .onRoot()
                .fetchSemanticsNode()
                .size.width / 2f,
        )
    }

    @Test
    fun geometryBoardWorksTheAnglesOutFromTheParts() {
        play("geometryBoard", isCorrect = true)

        assertEquals(true, handle(CORNER_C).state()?.endsWith("Angles: 72°, 45°, 63°."))
        rule.onNode(hasSetTextAction()).performTextInput("180")
        harness.tap("Check")

        shows("The angles always add to 180°.")
    }

    @Test
    fun geometryBoardShowsTheRealSumAfterAWrongOne() {
        play("geometryBoard", isCorrect = false)

        rule.onNode(hasSetTextAction()).performTextInput("90")
        harness.tap("Check")

        rule
            .onNode(
                hasText("180") and hasAnyAncestor(SemanticsMatcher.expectValue(SemanticsProperties.PaneTitle, "Answer feedback")),
            ).assertExists()
    }

    @Test
    fun geometryBoardCornersMoveByKeyTalkBackDragAndTap() {
        play("geometryBoard", isCorrect = true)

        handle(CORNER_C).press(Key.DirectionUp)
        assertEquals("At 1, 4. Angles: 76°, 53°, 51°.", handle(CORNER_C).state())
        rule.onNodeWithText("Back to the start").performScrollTo().performClick()
        assertEquals(true, handle(CORNER_C).state()?.startsWith("At 1, 3."))

        handle(CORNER_C).act("Move up")
        assertEquals(true, handle(CORNER_C).state()?.startsWith("At 1, 4."))

        handle(CORNER_C).performTouchInput { swipe(center, center + Offset(60f, 60f)) }
        assertEquals(false, handle(CORNER_C).state()?.startsWith("At 1, 4."))

        rule.onNodeWithText("Back to the start").performScrollTo().performClick()
        val corner = handle(CORNER_C).fetchSemanticsNode().boundsInRoot
        rule.onRoot().performTouchInput { click(corner.center + Offset(0f, corner.height * 0.75f)) }
        assertEquals(true, handle(CORNER_C).state()?.startsWith("At 1, 2."))
    }

    private fun add(element: String) = rule.onNodeWithContentDescription(element).performScrollTo().performClick()

    private fun buildCarbonDioxide(doubleBonds: Boolean) {
        add("Add Carbon")
        add("Add Oxygen bonded to Carbon 1")
        add("Add Oxygen bonded to Carbon 1")
        if (doubleBonds) {
            rule.onNodeWithContentDescription("Oxygen 1: 1 of 2 bonds").performClick()
            rule.onNodeWithContentDescription("Oxygen 2: 1 of 2 bonds").performClick()
        }
    }

    private fun sentAnswer() =
        ApiJson.encodeToString(
            LessonStepAnswer.serializer(),
            harness.api.checks
                .single()
                .second.answer,
        )

    @Test
    fun moleculeBuilderTwoDoubleBondsMakeCarbonDioxide() {
        play("moleculeBuilder", isCorrect = true)

        buildCarbonDioxide(doubleBonds = true)
        shows("Every atom has all its bonds.")
        harness.tap("Check")

        val answer = sentAnswer()
        assertTrue(answer, answer.contains(""""from":"c1","order":2,"to":"o1"""") && answer.contains(""""from":"c1","order":2,"to":"o2""""))
        rule.onNodeWithText("One correct build").assertDoesNotExist()
    }

    @Test
    fun moleculeBuilderShowsACorrectBuildAfterOpenBonds() {
        play("moleculeBuilder", isCorrect = false)

        buildCarbonDioxide(doubleBonds = false)
        shows("3 atoms have open bonds, shown as dots.")
        harness.tap("Check")

        shows("One correct build")
        shows("4 bonds in all, counting a double bond as two.")
    }

    @Test
    fun moleculeBuilderUndoesAndRemovesAtoms() {
        play("moleculeBuilder", isCorrect = true)

        buildCarbonDioxide(doubleBonds = false)
        rule.onNodeWithContentDescription("Undo").performScrollTo().performClick()
        rule.onNodeWithContentDescription("Oxygen 2:", substring = true).assertDoesNotExist()
        rule.onNodeWithContentDescription("Remove Carbon 1").performScrollTo().performClick()
        rule.onNodeWithContentDescription("Carbon 1:", substring = true).assertDoesNotExist()
        shows("1 atom has open bonds, shown as dots.")
    }

    @Test
    fun lineCrossingMovingSupplyLeftExplainsTheSpike() {
        play("lineCrossing", isCorrect = true)

        handle(SUPPLY).press(Key.DirectionLeft)
        assertEquals("Supply moved left. Price per dozen goes up. Eggs sold goes down.", handle(SUPPLY).state())
        harness.tap("Check")

        val answer = sentAnswer()
        assertTrue(answer, answer.contains(""""answer":{"curve":"supply","direction":"left","kind":"curveShift"}"""))
        handle(SUPPLY).assertIsNotEnabled()
    }

    @Test
    fun lineCrossingMovingDemandGetsTheWrongLineFeedback() {
        play("lineCrossing", isCorrect = false)

        handle(DEMAND).press(Key.DirectionRight, times = 2)
        harness.tap("Check")

        shows("Supply moved left.")
        shows("People didn't want more eggs.")
    }

    @Test
    fun lineCrossingMovingTheCostLineUpGivesTheNewBreakEven() {
        play("lineCrossing.breakEven", isCorrect = true)

        handle(COST).press(Key.DirectionUp, times = 4)
        assertEquals(true, handle(COST).state()?.contains("Lamps sold goes up"))
        assertEquals("250", typedAnswer())
        harness.tap("Check")

        rule.onNode(hasContentDescription("The new crossing is at 250.", substring = true)).assertExists()
    }

    @Test
    fun lineCrossingMovesByDragTalkBackAndTap() {
        play("lineCrossing", isCorrect = true)

        handle(SUPPLY).performTouchInput { swipe(center, center - Offset(60f, 0f)) }
        assertEquals(true, handle(SUPPLY).state()?.contains("Price per dozen goes up"))

        handle(SUPPLY).performSemanticsAction(SemanticsActions.SetProgress) { it(1f) }
        assertEquals(true, handle(SUPPLY).state()?.contains("Price per dozen goes down"))

        val supply = handle(SUPPLY).fetchSemanticsNode().boundsInRoot.center
        rule.onRoot().performTouchInput { click(supply - Offset(80f, 0f)) }
        assertEquals(true, handle(SUPPLY).state()?.contains("Price per dozen goes up"))
    }

    @Test
    fun moleculeBuilderKeepsItsUndoWhenAndroidRecreatesTheScreen() {
        val restoration = StateRestorationTester(rule)
        play("moleculeBuilder", isCorrect = true, restoration = restoration)

        buildCarbonDioxide(doubleBonds = false)
        restoration.emulateSavedInstanceStateRestore()
        rule.onNodeWithContentDescription("Undo").performScrollTo().performClick()

        rule.onNodeWithContentDescription("Oxygen 2:", substring = true).assertDoesNotExist()
        rule.onNodeWithContentDescription("Oxygen 1: 1 of 2 bonds").assertExists()
    }

    private companion object {
        const val POINT = "Point on the circle"
        const val CORNER_C = "Corner C"
        const val SUPPLY = "Move the line Supply"
        const val DEMAND = "Move the line Demand"
        const val COST = "Move the line Cost"
    }
}
