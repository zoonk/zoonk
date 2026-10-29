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
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performKeyInput
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.pressKey
import androidx.compose.ui.test.swipe
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.activities.ActivityFixtures
import com.zoonk.android.feature.player.LessonPlayerHarness
import com.zoonk.android.feature.player.checkResult
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

/** Main's player tests for the geometry templates, played in the real player with core's expected end states. */
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
    ) = harness.play(listOf(ActivityFixtures.step(fixture))) {
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

    private companion object {
        const val POINT = "Point on the circle"
        const val CORNER_C = "Corner C"
    }
}
